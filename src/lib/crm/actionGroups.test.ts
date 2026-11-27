import { describe, expect, test } from "bun:test";
import { PgDialect } from "drizzle-orm/pg-core";
import { crmActionGroupSql } from "./actionGroups.server";
import { crmRecords } from "./schema";

describe("crmActionGroupSql", () => {
  test("correlated subqueries reference the record's qualified id", () => {
    const { sql } = new PgDialect().sqlToQuery(crmActionGroupSql(crmRecords));
    expect(sql).toContain('c.crm_record_id = "crm_records"."id"');
    expect(sql).toContain('d.crm_record_id = "crm_records"."id"');
  });

  test("a pending referral puts a record in the queue, as its own group right after the meeting outcome", () => {
    const { sql } = new PgDialect().sqlToQuery(crmActionGroupSql(crmRecords));
    expect(sql).toContain("from crm_referrals pending_referral");
    expect(sql).toContain("pending_referral.status = 'pending'");
    expect(sql).toContain('"crm_records"."id" in (select pending_referral.crm_record_id');
    expect(sql.indexOf("then 'meeting_outcome'")).toBeLessThan(sql.indexOf("then 'referral'"));
    expect(sql.indexOf("then 'referral'")).toBeLessThan(sql.indexOf("= 'proposed' then 'classification'"));
  });
});
