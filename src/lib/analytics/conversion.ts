import { bucketFor, bucketStarts, ratio, type AnalyticsRange, type ConversionCohort, type ConversionReport, type ConversionStageKey } from "./contract";

/**
 * Pure half of the conversion report: stage resolution and cohort bucketing.
 * The SQL lives in conversion.server.ts; this takes its rows.
 */

export const CONVERSION_STAGES: readonly ConversionStageKey[] = ["booked", "showed", "pilot", "customer"];

/**
 * Subcategory keys that mean each stage, best match first. Organizations edit
 * their stages, so the first key that exists wins and an absent stage is null.
 * "customer" is also reached by being in the customer category, whatever its rank.
 */
export const STAGE_KEY_CANDIDATES: Record<Exclude<ConversionStageKey, "customer">, readonly string[]> = {
  booked: ["meeting_booked", "meeting_requested"],
  showed: ["meeting_done"],
  pilot: ["pilot", "trial_user"],
};

export type StageSubcategory = { key: string; name: string; stageRank: number | null };

export type ResolvedStages = ConversionReport["stages"];

/** Resolves each stage to a subcategory (by key) and its rank; customer by key `customer`, else category only. */
export function resolveStages(subcategories: readonly StageSubcategory[]): ResolvedStages {
  const find = (candidates: readonly string[]) => {
    for (const key of candidates) {
      const hit = subcategories.find((s) => s.key === key && s.stageRank !== null);
      if (hit) return { label: hit.name, rank: hit.stageRank };
    }
    return null;
  };
  const customer = subcategories.find((s) => s.key === "customer");
  return {
    booked: find(STAGE_KEY_CANDIDATES.booked),
    showed: find(STAGE_KEY_CANDIDATES.showed),
    pilot: find(STAGE_KEY_CANDIDATES.pilot),
    // Customer is always available: the category itself counts.
    customer: { label: customer?.name ?? "Customer", rank: customer?.stageRank ?? null },
  };
}

/** One lead in a cohort: when it first became interested (local day) and the furthest it has been. */
export type CohortRow = { cohortDay: string; maxRank: number | null; everCustomer: boolean };

const emptyCohort = (weekStart: string | null): ConversionCohort => ({
  weekStart,
  interested: 0,
  reached: { booked: 0, showed: 0, pilot: 0, customer: 0 },
  rates: { booked: null, showed: null, pilot: null, customer: null },
});

/** Whether a row has reached `stage`: rank-based, so skipping a stage still counts. */
export function reachedStage(row: CohortRow, stage: ConversionStageKey, stages: ResolvedStages): boolean | null {
  const resolved = stages[stage];
  if (stage === "customer") {
    return row.everCustomer || (resolved?.rank != null && row.maxRank !== null && row.maxRank >= resolved.rank);
  }
  if (!resolved || resolved.rank === null) return null;
  return row.maxRank !== null && row.maxRank >= resolved.rank;
}

function finish(cohort: ConversionCohort): ConversionCohort {
  for (const stage of CONVERSION_STAGES) {
    if (cohort.reached[stage] === null) continue;
    cohort.rates[stage] = ratio(cohort.reached[stage] as number, cohort.interested);
  }
  return cohort;
}

/** Buckets cohort rows into weekly cohorts (weeks start on the range's first day) plus a total. */
export function buildConversion(
  rows: readonly CohortRow[],
  stages: ResolvedStages,
  range: Pick<AnalyticsRange, "from" | "to">,
  bookingFunnel: ConversionReport["bookingFunnel"],
): ConversionReport {
  const weekly = { from: range.from, to: range.to, bucket: "week" as const };
  const byWeek = new Map(bucketStarts(weekly).map((start) => [start, emptyCohort(start)]));
  const total = emptyCohort(null);
  for (const stage of CONVERSION_STAGES) {
    if (stages[stage] === null) {
      for (const c of [total, ...byWeek.values()]) c.reached[stage] = null;
    }
  }
  for (const row of rows) {
    if (row.cohortDay < range.from || row.cohortDay > range.to) continue;
    const week = byWeek.get(bucketFor(row.cohortDay, weekly));
    for (const cohort of week ? [total, week] : [total]) {
      cohort.interested += 1;
      for (const stage of CONVERSION_STAGES) {
        if (reachedStage(row, stage, stages) && cohort.reached[stage] !== null) cohort.reached[stage] = (cohort.reached[stage] as number) + 1;
      }
    }
  }
  return {
    stages,
    total: finish(total),
    weeks: [...byWeek.values()].map((c) => finish(c)),
    bookingFunnel,
  };
}

/** The booking-link funnel from its three counts. */
export function bookingFunnel(linksSent: number, booked: number, showed: number): ConversionReport["bookingFunnel"] {
  return { linksSent, booked, showed, bookedRate: ratio(booked, linksSent), showedRate: ratio(showed, booked) };
}
