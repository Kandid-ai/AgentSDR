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
});
