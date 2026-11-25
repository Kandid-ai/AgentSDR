import { describe, expect, test } from "bun:test";
import { activeHref, activeHrefFrom } from "./navConfig";

describe("sidebar active item", () => {
  test("a record opened directly lights Action required, not Leads", () => {
    expect(activeHref("/crm/records/abc")).toBe("/crm/actions");
    expect(activeHrefFrom("/crm/records/abc", undefined)).toBe("/crm/actions");
  });
  test("a record keeps the section it was opened from", () => {
    expect(activeHrefFrom("/crm/records/abc", "/crm/actions")).toBe("/crm/actions");
    expect(activeHrefFrom("/crm/records/abc", "/leads")).toBe("/leads");
    expect(activeHrefFrom("/crm/records/abc", "/crm/pipeline")).toBe("/crm/pipeline");
  });
  test("other pages light their own item whatever came before", () => {
    expect(activeHrefFrom("/leads", "/crm/actions")).toBe("/leads");
    expect(activeHrefFrom("/crm/actions", "/leads")).toBe("/crm/actions");
  });
});
