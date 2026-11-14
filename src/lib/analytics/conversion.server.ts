import "server-only";

import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { currentOrganizationId } from "@/lib/tenancy/scope";
import type { AnalyticsRange, ConversionReport } from "./contract";
import { bookingFunnel, buildConversion, resolveStages, type CohortRow, type StageSubcategory } from "./conversion";
import { STAGE_CHANGE_EVENTS } from "./crm.server";
import { inRange, localDay, num, type QueryLimiter } from "./server";

/**
 * The conversion report. Cohort = records whose FIRST move into the
 * `interested` category (a stage-change event) fell in the range; a record
 * that is interested now but has no such event (none exist today) falls back
 * to its created_at. "Reached" is the highest stage_rank the record has
 * ever held, from the events' to_data subcategory plus its current one.
 * Three statements through the caller's limiter.
 */
export async function getConversionReport(range: AnalyticsRange, limit: QueryLimiter): Promise<ConversionReport> {
  const org = currentOrganizationId();
  const [stageRows, cohortRows, [funnel]] = await Promise.all([
    limit(() =>
      db.execute<{ key: string; name: string; stage_rank: number | null }>(sql`
        SELECT s.key, s.name, s.stage_rank FROM crm_subcategories s
        WHERE s.pipeline_id IN (SELECT id FROM crm_pipelines WHERE organization_id = ${org})`)),
    limit(() =>
      db.execute<{ day: string; max_rank: number | null; ever_customer: boolean }>(sql`
        WITH moves AS (
          SELECT e.crm_record_id, e.created_at, e.to_data->>'categoryKey' AS category, s.stage_rank
          FROM crm_events e
          LEFT JOIN crm_subcategories s ON s.id = (e.to_data->>'subcategoryId')::uuid
          WHERE e.organization_id = ${org} AND e.event_type IN ${STAGE_CHANGE_EVENTS}
        ), cohort AS (
          SELECT r.id, r.category_key, cur.stage_rank AS current_rank,
                 coalesce((SELECT min(m.created_at) FROM moves m WHERE m.crm_record_id = r.id AND m.category = 'interested'),
                          CASE WHEN r.category_key = 'interested' THEN r.created_at END) AS interested_at
          FROM crm_records r
          LEFT JOIN crm_subcategories cur ON cur.id = r.subcategory_id
          WHERE r.organization_id = ${org}
        )
        SELECT ${localDay(sql`c.interested_at`, range)} AS day,
               greatest(c.current_rank, (SELECT max(m.stage_rank) FROM moves m WHERE m.crm_record_id = c.id)) AS max_rank,
               (c.category_key = 'customer' OR EXISTS (SELECT 1 FROM moves m WHERE m.crm_record_id = c.id AND m.category = 'customer')) AS ever_customer
        FROM cohort c
        WHERE c.interested_at IS NOT NULL AND ${inRange(sql`c.interested_at`, range)}`)),
    limit(() =>
      db.execute<{ sent: number; booked: number; showed: number }>(sql`
        SELECT count(*)::int AS sent,
               count(*) FILTER (WHERE EXISTS (SELECT 1 FROM crm_meetings mt WHERE mt.crm_record_id = r.id AND mt.organization_id = ${org}))::int AS booked,
               count(*) FILTER (WHERE EXISTS (SELECT 1 FROM crm_meetings mt WHERE mt.crm_record_id = r.id AND mt.organization_id = ${org} AND mt.outcome = 'showed'))::int AS showed
        FROM crm_records r
        WHERE r.organization_id = ${org} AND ${inRange(sql`r.booking_link_first_sent_at`, range)}`)),
  ]);

  const subcategories: StageSubcategory[] = stageRows.map((r) => ({ key: r.key, name: r.name, stageRank: r.stage_rank === null ? null : num(r.stage_rank) }));
  const rows: CohortRow[] = cohortRows.map((r) => ({ cohortDay: r.day, maxRank: r.max_rank === null ? null : num(r.max_rank), everCustomer: Boolean(r.ever_customer) }));
  return buildConversion(rows, resolveStages(subcategories), range, bookingFunnel(num(funnel?.sent), num(funnel?.booked), num(funnel?.showed)));
}
