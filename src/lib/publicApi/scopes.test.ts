import { describe, expect, test } from "bun:test";
import { ALL_API_SCOPES, MCP_SCOPES, normalizeScopes, scopesFromClaim } from "./scopes";

describe("API scopes", () => {
  test("parses an OAuth scope claim, dropping identity and unknown scopes", () => {
    expect(scopesFromClaim("openid offline_access crm:send crm:read bogus")).toEqual(["crm:read", "crm:send"]);
    expect(scopesFromClaim(undefined)).toEqual([]);
  });
  test("normalizes to registry order without duplicates", () => {
    expect(normalizeScopes(["campaigns:write", "crm:read", "crm:read", 7])).toEqual(["crm:read", "campaigns:write"]);
  });
  test("MCP scopes are API scopes", () => {
    for (const scope of MCP_SCOPES) expect(ALL_API_SCOPES).toContain(scope);
  });
});
