import { afterEach, describe, expect, spyOn, test } from "bun:test";

import { getIntegrationAction } from "../catalog";
import { getIntegrationActionHandler } from "../server/registry";
import type { IntegrationActionContext } from "../server/types";
import { verifyIntegrationCredentials } from "../verification";
import { PermanentRunError, RetryableRunError } from "@/lib/grid/runners/types";

const spies: ReturnType<typeof spyOn>[] = [];
afterEach(() => { for (const spy of spies.splice(0)) spy.mockRestore(); });

function fetchResponse(body: string, status = 200, headers: Record<string, string> = {}) {
  const spy = spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(body, { status, headers: { "content-type": "application/json", ...headers } }));
  spies.push(spy);
  return spy;
}

function context(actionKey: string, inputs: Record<string, unknown>, outputKeys?: string[]): IntegrationActionContext {
  const action = getIntegrationAction("firecrawl", actionKey);
  if (!action) throw new Error(`Action not registered: ${actionKey}`);
  const keys = outputKeys ?? action.outputs.map((output) => output.key);
  return {
    action, inputs, credentials: { apiKey: "fc-fictional-key" }, connectionId: "fictional-org-connection", timeoutMs: 30_000,
    config: {
      integrationKey: "firecrawl", actionKey, handlerKey: action.handlerKey, inputs: {},
      outputs: Object.fromEntries(keys.map((key) => [key, `mapped_${key}`])),
      connectionId: "fictional-org-connection",
    },
  };
}

async function run(ctx: IntegrationActionContext) {
  const handler = getIntegrationActionHandler(ctx.action.handlerKey);
  if (!handler) throw new Error("Handler not registered");
  const result = await handler(ctx);
  if ("pending" in result) throw new Error("Firecrawl must not poll");
  return result;
}

function sentBody(fetch: ReturnType<typeof fetchResponse>) {
  return JSON.parse(String(fetch.mock.calls[0][1]?.body));
}

const page = {
  markdown: "# Example Inc\n\nWe make fictional widgets.",
  metadata: { title: "Example Inc", description: "Fictional widgets", url: "https://www.example.com/", sourceURL: "https://example.com", statusCode: 200, creditsUsed: 1 },
};

describe("Firecrawl table actions", () => {
  test("scrapes a domain as Markdown only when no summary output is mapped", async () => {
    const fetch = fetchResponse(JSON.stringify({ success: true, data: page }));
    const result = await run(context("scrape-website", { url: "example.com" }, ["markdown", "title", "finalUrl", "statusCode", "creditsUsed"]));
    const [url, init] = fetch.mock.calls[0];
    expect(String(url)).toBe("https://api.firecrawl.dev/v2/scrape");
    expect(init).toMatchObject({ method: "POST", redirect: "error", cache: "no-store", headers: { Authorization: "Bearer fc-fictional-key" } });
    expect(sentBody(fetch)).toEqual({ url: "https://example.com/", formats: ["markdown"], onlyMainContent: true, timeout: 28_000, origin: "agentsdr" });
    expect(result.outputs).toEqual({ mapped_markdown: page.markdown, mapped_title: "Example Inc", mapped_finalUrl: "https://www.example.com/", mapped_statusCode: 200, mapped_creditsUsed: 1 });
    expect(result.outcome).toBe("hit");
    expect(result.costCents).toBe(0);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(result)).not.toContain("fc-fictional-key");
  });

  test("keeps the path of a full URL", async () => {
    const fetch = fetchResponse(JSON.stringify({ success: true, data: page }));
    await run(context("scrape-website", { url: "https://example.com/pricing?plan=team" }, ["markdown"]));
    expect(sentBody(fetch).url).toBe("https://example.com/pricing?plan=team");
  });

  test("requests and maps the JSON summary when a summary output is mapped", async () => {
    const json = { companyName: "Example Inc", description: "Fictional widgets for testing.", products: ["Widget"], pricingModel: "Per seat", hiringSignals: "Hiring engineers" };
    const fetch = fetchResponse(JSON.stringify({ success: true, data: { ...page, json, metadata: { ...page.metadata, creditsUsed: 5 } } }));
    const result = await run(context("scrape-website", { url: "example.com" }));
    const formats = sentBody(fetch).formats;
    expect(formats[0]).toBe("markdown");
    expect(formats[1]).toMatchObject({ type: "json", schema: { type: "object" } });
    expect(result.outputs).toMatchObject({
      mapped_summary: json, mapped_companyName: "Example Inc", mapped_companyDescription: json.description,
      mapped_products: ["Widget"], mapped_pricingModel: "Per seat", mapped_hiringSignals: "Hiring engineers", mapped_creditsUsed: 5,
    });
  });

  test("requests the JSON summary for a response pointer under /json", async () => {
    const fetch = fetchResponse(JSON.stringify({ success: true, data: { ...page, json: { pricingModel: "Free" } } }));
    const ctx = context("scrape-website", { url: "example.com" }, []);
    ctx.config.outputs = { "response:/json/pricingModel": "pricing" };
    const result = await run(ctx);
    expect(sentBody(fetch).formats).toHaveLength(2);
    expect(result.outputs).toEqual({ pricing: "Free" });
  });

  test("reports a website that answered with an error status as a miss", async () => {
    fetchResponse(JSON.stringify({ success: true, data: { markdown: "Not Found", metadata: { statusCode: 404, creditsUsed: 1 } } }));
    const result = await run(context("scrape-website", { url: "example.com/missing" }));
    expect(result.outcome).toBe("miss");
    expect(result.value).toBe("Not found");
  });

  test("searches with defaults and maps title, url and snippet", async () => {
    const web = [
      { url: "https://example.com/news", title: "Example Inc raises a fictional round", description: "A fictional funding story.", position: 1 },
      { url: "https://example.org/jobs", title: "Example Inc is hiring", description: "Fictional job posts.", position: 2 },
    ];
    const fetch = fetchResponse(JSON.stringify({ success: true, data: { web }, creditsUsed: 2 }));
    const result = await run(context("search-web", { query: "  Example Inc funding " }));
    expect(String(fetch.mock.calls[0][0])).toBe("https://api.firecrawl.dev/v2/search");
    expect(sentBody(fetch)).toEqual({ query: "Example Inc funding", limit: 5, timeout: 28_000, origin: "agentsdr" });
    expect(result.outputs).toMatchObject({
      mapped_results: [
        { title: web[0].title, url: web[0].url, snippet: web[0].description },
        { title: web[1].title, url: web[1].url, snippet: web[1].description },
      ],
      mapped_resultCount: 2, mapped_topTitle: web[0].title, mapped_topUrl: web[0].url, mapped_topSnippet: web[0].description, mapped_creditsUsed: 2,
    });
    expect(result.outcome).toBe("hit");
  });

  test("includes page Markdown only when asked", async () => {
    const fetch = fetchResponse(JSON.stringify({ success: true, data: { web: [{ url: "https://example.com/", title: "Example", description: "Snippet", markdown: "# Example" }] } }));
    const result = await run(context("search-web", { query: "example", limit: 1, includeMarkdown: true }));
    expect(sentBody(fetch)).toMatchObject({ limit: 1, scrapeOptions: { formats: ["markdown"], onlyMainContent: true } });
    expect(result.outputs?.mapped_results).toEqual([{ title: "Example", url: "https://example.com/", snippet: "Snippet", markdown: "# Example" }]);
    expect(result.outputs?.mapped_creditsUsed).toBeNull();
  });

  test("returns a miss for an empty result list", async () => {
    fetchResponse(JSON.stringify({ success: true, data: { web: [] }, creditsUsed: 1 }));
    const result = await run(context("search-web", { query: "nothing matches this" }));
    expect(result.outcome).toBe("miss");
    expect(result.outputs?.mapped_resultCount).toBe(0);
  });

  test.each([
    ["scrape-website", { url: "ftp://example.com" }],
    ["scrape-website", { url: "https://user:password@example.com" }],
    ["scrape-website", { url: "localhost" }],
    ["scrape-website", { url: "" }],
    ["search-web", { query: "" }],
    ["search-web", { query: "x".repeat(501) }],
    ["search-web", { query: "test", limit: 0 }],
    ["search-web", { query: "test", limit: 11 }],
    ["search-web", { query: "test", limit: 2.5 }],
  ] as const)("rejects invalid %s input before spending", async (action, inputs) => {
    const fetch = fetchResponse("{}");
    await expect(run(context(action, inputs))).rejects.toBeInstanceOf(PermanentRunError);
    expect(fetch).not.toHaveBeenCalled();
  });

  test.each([400, 401, 402, 403, 408, 500, 302])("fails without retrying for HTTP %i", async (status) => {
    const fetch = fetchResponse(JSON.stringify({ success: false, error: "Something went wrong" }), status);
    await expect(run(context("search-web", { query: "test" }))).rejects.toBeInstanceOf(PermanentRunError);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test("passes Firecrawl's own error message through, trimmed", async () => {
    fetchResponse(JSON.stringify({ success: false, code: "SCRAPE_DNS_RESOLUTION_ERROR", error: "DNS resolution failed for hostname \"missing.example\"." }), 200);
    await expect(run(context("scrape-website", { url: "missing.example" }))).rejects.toThrow("DNS resolution failed");
  });

  test("lets the queue retry a rate limit, which uses no credits", async () => {
    fetchResponse(JSON.stringify({ success: false, error: "Rate limit exceeded" }), 429);
    await expect(run(context("search-web", { query: "test" }))).rejects.toBeInstanceOf(RetryableRunError);
  });

  test("turns network failures into permanent errors so the queue cannot replay a paid call", async () => {
    const fetch = spyOn(globalThis, "fetch").mockRejectedValue(new Error("sensitive transport details"));
    spies.push(fetch);
    const error = await run(context("scrape-website", { url: "example.com" })).catch((caught) => caught);
    expect(error).toBeInstanceOf(PermanentRunError);
    expect(String(error)).not.toContain("sensitive");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test("does not spend if the caller has already cancelled the job", async () => {
    const fetch = fetchResponse("{}");
    const ctx = context("search-web", { query: "test" });
    ctx.signal = AbortSignal.abort();
    await expect(run(ctx)).rejects.toBeInstanceOf(PermanentRunError);
    expect(fetch).not.toHaveBeenCalled();
  });

  test.each([true, false])("bounds response bytes, with content-length=%s", async (withHeader) => {
    const body = JSON.stringify({ success: true, data: { markdown: "x".repeat(5 * 1024 * 1024) } });
    fetchResponse(body, 200, withHeader ? { "content-length": String(body.length) } : {});
    await expect(run(context("scrape-website", { url: "example.com" }))).rejects.toBeInstanceOf(PermanentRunError);
  });

  test.each(["not JSON", "null", '{"success":true}', '{"success":true,"data":{"web":"nope"}}'])("rejects malformed successful responses: %s", async (body) => {
    fetchResponse(body);
    await expect(run(context("search-web", { query: "test" }))).rejects.toBeInstanceOf(PermanentRunError);
  });

  test("uses each connection's own key", async () => {
    const fetch = fetchResponse(JSON.stringify({ success: true, data: { web: [] } }));
    const first = context("search-web", { query: "test" });
    first.credentials = { apiKey: "fc-org-a" };
    await run(first);
    fetch.mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: { web: [] } })));
    const second = context("search-web", { query: "test" });
    second.credentials = { apiKey: "fc-org-b" };
    await run(second);
    expect(fetch.mock.calls.map(([, init]) => new Headers(init?.headers).get("Authorization"))).toEqual(["Bearer fc-org-a", "Bearer fc-org-b"]);
  });

  test.each(["", "Bearer fc-fictional-key", "fc-fictional\r\nheader", "fc-ключ"])("rejects an invalid key format before making a request", async (key) => {
    const fetch = fetchResponse("{}");
    await expect(verifyIntegrationCredentials("firecrawl", { apiKey: key })).rejects.toBeInstanceOf(PermanentRunError);
    expect(fetch).not.toHaveBeenCalled();
  });

  test("verifies credentials through the free credit-usage endpoint and discards account data", async () => {
    const fetch = fetchResponse('{"success":true,"data":{"remainingCredits":100}}');
    expect(await verifyIntegrationCredentials("firecrawl", { apiKey: "fc-fictional-key" })).toBeUndefined();
    expect(String(fetch.mock.calls[0][0])).toBe("https://api.firecrawl.dev/v2/team/credit-usage");
    expect(fetch.mock.calls[0][1]).toMatchObject({ method: "GET", redirect: "error", cache: "no-store" });
  });

  test("does not accept a credit-usage answer that reports a failure", async () => {
    fetchResponse('{"success":false,"error":"Unknown team"}');
    await expect(verifyIntegrationCredentials("firecrawl", { apiKey: "fc-fictional-key" })).rejects.toBeInstanceOf(PermanentRunError);
  });

  const person = {
    full_name: "Ada Example", first_name: "Ada", last_name: "Example", current_title: "VP Sales", seniority_level: "vp",
    department: "Sales", contact_location: "Springfield, United States", linkedin_url: "https://www.linkedin.com/in/ada-example-fictional",
    company_name: "Example Inc", company_domain: "example.com",
  };
  const contact = { work_email: "ada@example.com", email_status: "VALID", mobile_phone: "+15555550100", direct_dial: "" };
  const alexandria = (provider: string, capability: string, result: Record<string, unknown>, creditsCost = 5) =>
    JSON.stringify({ success: true, data: { alexandria: [{ provider, capability, creditsCost, ...result }], creditsCost } });
  const peopleResponse = (contacts: Record<string, unknown>[]) =>
    alexandria("getleadsio", "people/search", { data: { ok: true, contacts, returned: contacts.length, has_more: false, next_offset: null } });

  test("finds people at a company through Firecrawl Alexandria without asking for contact data", async () => {
    const fetch = fetchResponse(peopleResponse([person]));
    const result = await run(context("find-people-at-company", { companyDomain: "https://www.example.com/about", jobTitles: "VP Sales, Head of Sales" }, ["people", "resultCount", "topName", "topTitle", "topLinkedinUrl", "creditsUsed"]));
    expect(String(fetch.mock.calls[0][0])).toBe("https://api.firecrawl.dev/v2/scrape");
    const body = sentBody(fetch);
    expect(body).toMatchObject({
      alexandria: { provider: "getleadsio", capability: "people/search", options: { filters: { domains: ["example.com"], job_titles: ["VP Sales", "Head of Sales"] }, limit: 10 } },
      timeout: 28_000, origin: "agentsdr",
    });
    expect(body.alexandria.options.columns).not.toContain("work_email");
    expect(body.alexandria.options.columns).not.toContain("mobile_phone");
    expect(result.outputs).toEqual({
      mapped_people: [{
        name: "Ada Example", firstName: "Ada", lastName: "Example", title: "VP Sales", seniority: "vp", department: "Sales",
        location: "Springfield, United States", linkedinUrl: person.linkedin_url, companyName: "Example Inc", companyDomain: "example.com",
      }],
      mapped_resultCount: 1, mapped_topName: "Ada Example", mapped_topTitle: "VP Sales", mapped_topLinkedinUrl: person.linkedin_url, mapped_creditsUsed: 5,
    });
    expect(result.outcome).toBe("hit");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test("requests contact data only when a contact output is mapped, and keeps it in its own outputs", async () => {
    const fetch = fetchResponse(peopleResponse([{ ...person, ...contact }]));
    const result = await run(context("find-people-at-company", { companyDomain: "example.com", jobTitles: ["VP Sales"], limit: 3 }, ["people", "contacts", "topWorkEmail", "topEmailStatus", "topMobilePhone", "topDirectDial"]));
    const options = sentBody(fetch).alexandria.options;
    expect(options.limit).toBe(3);
    expect(options.columns).toEqual(expect.arrayContaining(["work_email", "email_status", "mobile_phone", "direct_dial"]));
    expect(JSON.stringify(result.outputs?.mapped_people)).not.toContain("ada@example.com");
    expect(result.outputs).toMatchObject({
      mapped_contacts: [{ name: "Ada Example", linkedinUrl: person.linkedin_url, workEmail: "ada@example.com", emailStatus: "VALID", mobilePhone: "+15555550100", directDial: null }],
      mapped_topWorkEmail: "ada@example.com", mapped_topEmailStatus: "VALID", mapped_topMobilePhone: "+15555550100", mapped_topDirectDial: null,
    });
  });

  test("requests contact data for a response pointer to a contact field", async () => {
    const fetch = fetchResponse(peopleResponse([{ ...person, ...contact }]));
    const ctx = context("find-people-at-company", { companyDomain: "example.com" }, []);
    ctx.config.outputs = { "response:/contacts/0/work_email": "email" };
    const result = await run(ctx);
    const options = sentBody(fetch).alexandria.options;
    expect(options.columns).toContain("work_email");
    expect(options.filters).toEqual({ domains: ["example.com"] });
    expect(result.outputs).toEqual({ email: "ada@example.com" });
  });

  test("leaves contact outputs empty when the provider has no contact data for a person", async () => {
    fetchResponse(peopleResponse([{ ...person, work_email: "", email_status: "", mobile_phone: "", direct_dial: "" }]));
    const result = await run(context("find-people-at-company", { companyDomain: "example.com" }, ["contacts", "topWorkEmail", "topEmailStatus", "topMobilePhone", "topDirectDial"]));
    expect(result.outputs).toEqual({
      mapped_contacts: [{ name: "Ada Example", linkedinUrl: person.linkedin_url, workEmail: null, emailStatus: null, mobilePhone: null, directDial: null }],
      mapped_topWorkEmail: null, mapped_topEmailStatus: null, mapped_topMobilePhone: null, mapped_topDirectDial: null,
    });
    expect(result.outcome).toBe("hit");
  });

  test("tolerates missing and odd person fields", async () => {
    fetchResponse(peopleResponse([{ first_name: "Ada", last_name: "Example", current_title: 42, linkedin_url: null, unexpected: { nested: true } }, "not a person" as unknown as Record<string, unknown>]));
    const result = await run(context("find-people-at-company", { companyDomain: "example.com" }, ["people", "resultCount", "topName", "topTitle", "topLinkedinUrl"]));
    expect(result.outputs?.mapped_resultCount).toBe(2);
    expect(result.outputs?.mapped_topName).toBe("Ada Example");
    expect(result.outputs?.mapped_topTitle).toBeNull();
    expect(result.outputs?.mapped_topLinkedinUrl).toBeNull();
    expect((result.outputs?.mapped_people as Record<string, unknown>[])[1]).toMatchObject({ name: null, title: null, linkedinUrl: null });
  });

  test("returns a miss when nobody matches", async () => {
    fetchResponse(peopleResponse([]));
    const result = await run(context("find-people-at-company", { companyDomain: "example.com", jobTitles: "Chief Fictional Officer" }));
    expect(result.outcome).toBe("miss");
    expect(result.outputs?.mapped_resultCount).toBe(0);
    expect(result.outputs?.mapped_contacts).toEqual([]);
  });

  test("enriches a company from its domain through Firecrawl Alexandria", async () => {
    const company = {
      status: 200, likelihood: 6, name: "Example Inc", display_name: "Example Inc", website: "example.com",
      headline: "Widgets for testing", summary: "example inc makes fictional widgets.", industry: "Internet", industry_v2: "Technology, Information and Internet",
      type: "private", size: "51-200", employee_count: 120, inferred_revenue: "$10m-$25m", founded: 2015,
      location: { name: "Springfield, Illinois, United States", locality: "Springfield", country: "United States" },
      linkedin_url: "linkedin.com/company/example-fictional", tags: ["Widgets", "Saas"],
      total_funding_raised: 12000000, latest_funding_stage: "series_a", last_funding_date: "2024-05-01",
    };
    const fetch = fetchResponse(alexandria("people-data-labs", "company/enrich", { data: company }, 0));
    const result = await run(context("enrich-company", { domain: "https://www.example.com/about" }));
    expect(sentBody(fetch)).toEqual({
      alexandria: { provider: "people-data-labs", capability: "company/enrich", options: { website: "example.com", titlecase: true, min_likelihood: 5 } },
      timeout: 28_000, origin: "agentsdr",
    });
    expect(result.outputs).toMatchObject({
      mapped_companyName: "Example Inc", mapped_domain: "example.com", mapped_headline: "Widgets for testing",
      mapped_description: company.summary, mapped_industry: "Technology, Information and Internet", mapped_companyType: "private",
      mapped_employeeRange: "51-200", mapped_employeeCount: 120, mapped_revenueRange: "$10m-$25m", mapped_foundedYear: 2015,
      mapped_headquarters: "Springfield, Illinois, United States", mapped_country: "United States",
      mapped_linkedinUrl: "https://linkedin.com/company/example-fictional", mapped_tags: ["Widgets", "Saas"],
      mapped_totalFundingRaised: 12000000, mapped_latestFundingStage: "series_a", mapped_lastFundingDate: "2024-05-01",
      mapped_creditsUsed: 0, mapped_data: company,
    });
    expect(result.outcome).toBe("hit");
  });

  test("tolerates missing and odd company fields", async () => {
    fetchResponse(alexandria("people-data-labs", "company/enrich", { data: { name: "example inc", website: "example.com", employee_count: "many", location: null, tags: "widgets", linkedin_url: "https://www.linkedin.com/company/example-fictional", founded: null } }, 0));
    const result = await run(context("enrich-company", { domain: "example.com" }, ["companyName", "employeeCount", "headquarters", "country", "tags", "linkedinUrl", "foundedYear", "totalFundingRaised"]));
    expect(result.outputs).toEqual({
      mapped_companyName: "example inc", mapped_employeeCount: null, mapped_headquarters: null, mapped_country: null,
      mapped_tags: null, mapped_linkedinUrl: "https://www.linkedin.com/company/example-fictional", mapped_foundedYear: null, mapped_totalFundingRaised: null,
    });
    expect(result.outcome).toBe("hit");
  });

  test("reports a company record without a name as a miss", async () => {
    fetchResponse(alexandria("people-data-labs", "company/enrich", { data: {} }, 0));
    const result = await run(context("enrich-company", { domain: "example.com" }));
    expect(result.outcome).toBe("miss");
  });

  test("reports a provider's not-found answer inside HTTP 200 as a miss", async () => {
    fetchResponse(alexandria("people-data-labs", "company/enrich", { error: { code: "not_found", message: "No matching records were found.", status: 404 } }, 0));
    const result = await run(context("enrich-company", { domain: "example.com" }));
    expect(result.outcome).toBe("miss");
    expect(result.value).toBe("Not found");
    expect(result.outputs?.mapped_creditsUsed).toBe(0);
  });

  test("fails without retrying on a provider error inside HTTP 200", async () => {
    const fetch = fetchResponse(alexandria("getleadsio", "people/search", { error: { code: "invalid_option", message: "GetLeads.io rejected the input. Check the filters and required fields.", status: 400 } }, 0));
    const error = await run(context("find-people-at-company", { companyDomain: "example.com" })).catch((caught) => caught);
    expect(error).toBeInstanceOf(PermanentRunError);
    expect(String(error)).toContain("GetLeads.io rejected the input.");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test("links to the terms page when a provider's terms need accepting", async () => {
    const termsUrl = "https://www.firecrawl.dev/app/settings?tab=data-sources&provider=getleadsio";
    fetchResponse(JSON.stringify({ success: false, code: "THIRD_PARTY_DATA_TERMS_REQUIRED", error: "Terms required", requiresAction: { url: termsUrl } }), 403);
    const error = await run(context("find-people-at-company", { companyDomain: "example.com" })).catch((caught) => caught);
    expect(error).toBeInstanceOf(PermanentRunError);
    expect(String(error)).toContain(termsUrl);
    expect(String(error)).toContain("organization admin");
    expect(String(error)).not.toContain("No automatic retry");
  });

  test("lets the queue retry a provider rate limit inside HTTP 200", async () => {
    fetchResponse(alexandria("getleadsio", "people/search", { error: { code: "rate_limited", message: "GetLeads.io is rate limiting requests.", status: 429 } }, 0));
    await expect(run(context("find-people-at-company", { companyDomain: "example.com" }))).rejects.toBeInstanceOf(RetryableRunError);
  });

  test("names the error code when a provider error has no message", async () => {
    fetchResponse(alexandria("getleadsio", "people/search", { error: { code: "upstream_error", status: 502 } }, 0));
    const error = await run(context("find-people-at-company", { companyDomain: "example.com" })).catch((caught) => caught);
    expect(error).toBeInstanceOf(PermanentRunError);
    expect(String(error)).toContain("(upstream_error)");
    expect(String(error)).not.toContain("HTTP 0");
  });

  test("links to Firecrawl's own settings when the terms link is not a Firecrawl URL", async () => {
    fetchResponse(alexandria("people-data-labs", "company/enrich", { error: { code: "THIRD_PARTY_DATA_TERMS_REQUIRED", message: "Terms required", status: 403, requiresAction: { url: "https://attacker.example/terms" } } }, 0));
    const error = await run(context("enrich-company", { domain: "example.com" })).catch((caught) => caught);
    expect(error).toBeInstanceOf(PermanentRunError);
    expect(String(error)).toContain("https://www.firecrawl.dev/app/settings?tab=data-sources");
    expect(String(error)).not.toContain("attacker.example");
  });

  test.each([
    '{"success":true,"data":{}}',
    '{"success":true,"data":{"alexandria":[]}}',
    '{"success":true,"data":{"alexandria":[{"provider":"other","capability":"people/search","data":{}}]}}',
    '{"success":true,"data":{"alexandria":[{"provider":"getleadsio","capability":"people/search","data":{"ok":true,"contacts":"nope"}}]}}',
  ])("rejects malformed Firecrawl Alexandria responses: %s", async (body) => {
    fetchResponse(body);
    await expect(run(context("find-people-at-company", { companyDomain: "example.com" }))).rejects.toBeInstanceOf(PermanentRunError);
  });

  test.each([
    ["find-people-at-company", { companyDomain: "" }],
    ["find-people-at-company", { companyDomain: "localhost" }],
    ["find-people-at-company", { companyDomain: "https://user:password@example.com" }],
    ["find-people-at-company", { companyDomain: "example.com:8080" }],
    ["find-people-at-company", { companyDomain: "x..com" }],
    ["find-people-at-company", { companyDomain: ".com" }],
    ["find-people-at-company", { companyDomain: "-bad-.com" }],
    ["find-people-at-company", { companyDomain: "1.2.3.4" }],
    ["find-people-at-company", { companyDomain: "example.com", jobTitles: Array.from({ length: 11 }, (_, index) => `Title ${index}`) }],
    ["find-people-at-company", { companyDomain: "example.com", jobTitles: "[not json" }],
    ["find-people-at-company", { companyDomain: "example.com", jobTitles: "x".repeat(101) }],
    ["find-people-at-company", { companyDomain: "example.com", limit: 0 }],
    ["find-people-at-company", { companyDomain: "example.com", limit: 26 }],
    ["enrich-company", { domain: "ftp://example.com" }],
    ["enrich-company", { domain: 42 }],
  ] as const)("rejects invalid %s input before spending", async (action, inputs) => {
    const fetch = fetchResponse("{}");
    await expect(run(context(action, inputs))).rejects.toBeInstanceOf(PermanentRunError);
    expect(fetch).not.toHaveBeenCalled();
  });

  test("rejects a key Firecrawl does not accept", async () => {
    fetchResponse('{"success":false,"error":"Unauthorized: Invalid token"}', 401);
    await expect(verifyIntegrationCredentials("firecrawl", { apiKey: "fc-wrong" })).rejects.toThrow("The API key was rejected.");
  });
});
