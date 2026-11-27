import { describe, expect, test } from "bun:test";
import {
  boardFilterParams,
  defaultViewConfigs,
  normalizeViewConfig,
  normalizeViewName,
  parseBoardFilterParams,
} from "./boardViews";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("normalizeViewConfig", () => {
  test("drops junk and keeps valid entries", () => {
    const config = normalizeViewConfig({
      layout: "list",
      groupBy: "nonsense",
      filters: {
        stages: [A, "none:interested", "none:bogus", "x", 5, A],
        statuses: ["waiting", "done"],
        channels: ["email", "fax"],
        search: "acme",
        lastContact: "7d",
      },
      columnOrder: [B, "junk"],
      hiddenFields: ["draft", "nope"],
      showEmptyColumns: true,
    });
    expect(config.layout).toBe("list");
    expect(config.groupBy).toBe("stage");
    expect(config.filters).toEqual({ stages: [A, "none:interested"], statuses: ["waiting"], channels: ["email"], search: "acme", lastContact: "7d" });
    expect(config.columnOrder).toEqual([B]);
    expect(config.hiddenFields).toEqual(["draft"]);
    expect(config.showEmptyColumns).toBe(true);
  });

  test("garbage input gives the defaults", () => {
    expect(normalizeViewConfig(null).filters.lastContact).toBe("any");
    expect(normalizeViewConfig("x").layout).toBe("board");
  });

  test("names are trimmed, collapsed and required", () => {
    expect(normalizeViewName("  A   B ")).toBe("A B");
    expect(normalizeViewName("   ")).toBeNull();
    expect(normalizeViewName(3)).toBeNull();
  });
});

describe("filter params", () => {
  test("round trip", () => {
    const filters = { stages: [A, "none:customer"], statuses: ["needs_action" as const], channels: ["email" as const, "whatsapp" as const], search: "jo", lastContact: "over_30d" as const };
    expect(parseBoardFilterParams(boardFilterParams(filters))).toEqual(filters);
  });

  test("empty filters leave no params and parse back empty", () => {
    const params = boardFilterParams(parseBoardFilterParams(new URLSearchParams()));
    expect([...params.keys()]).toEqual([]);
  });
});

describe("defaultViewConfigs", () => {
  test("skips missing keys and appends the no-sub-stage columns", () => {
    const views = defaultViewConfigs(new Map([["demo_requested", A], ["customer", B]]));
    expect(views).toHaveLength(2);
    expect(views[0].config.filters.stages).toEqual([A, "none:interested"]);
    expect(views[1].config.filters.stages).toEqual([B, "none:customer"]);
  });

  test("a view with no matching key is not created", () => {
    const views = defaultViewConfigs(new Map([["demo_requested", A]]));
    expect(views.map((view) => view.name)).toEqual(["Interested – not booked"]);
    expect(defaultViewConfigs(new Map())).toEqual([]);
  });
});
