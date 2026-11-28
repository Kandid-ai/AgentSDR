import "server-only";

import { responsePointerFromOutputKey } from "@/lib/grid/json-pointer";
import { PermanentRunError, RetryableRunError } from "@/lib/grid/runners/types";
import type { CellResult } from "@/lib/grid/types";
import { asRecord, mapConfiguredOutputs, truncate } from "../server/helpers";
import type { IntegrationActionContext, IntegrationActionHandlers } from "../server/types";
import { FIRECRAWL_CONTACT_OUTPUT_KEYS, FIRECRAWL_SUMMARY_OUTPUT_KEYS } from "./definition";
import { firecrawlFailureDetail, firecrawlTimeout, requestFirecrawl } from "./transport";

const SUMMARY_PROMPT = "Summarize this company website for sales research: what the company does, its products, its pricing model and any hiring signals.";
const SUMMARY_SCHEMA = {
  type: "object",
  properties: {
    companyName: { type: "string" },
    description: { type: "string" },
    products: { type: "array", items: { type: "string" } },
    pricingModel: { type: "string" },
    hiringSignals: { type: "string" },
  },
};
const SUMMARY_KEYS = new Set<string>(FIRECRAWL_SUMMARY_OUTPUT_KEYS);

export function websiteUrl(value: unknown): string {
  const invalid = () => { throw new PermanentRunError("Website or URL: provide an http(s) website or domain such as example.com, without a username or password."); };
  if (typeof value !== "string" || !value.trim() || value.length > 2048) return invalid();
  try {
    const trimmed = value.trim();
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || !url.hostname.includes(".")) return invalid();
    return url.toString();
  } catch {
    return invalid();
  }
}

function wantsSummary(outputs: Record<string, string>): boolean {
  return Object.keys(outputs).some((key) => SUMMARY_KEYS.has(key) || responsePointerFromOutputKey(key)?.startsWith("/json") === true);
}

function bodyTimeout(timeoutMs: number): number {
  return Math.max(1_000, firecrawlTimeout(timeoutMs) - 2_000);
}

function credits(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

async function scrapeWebsite(context: IntegrationActionContext): Promise<CellResult> {
  const { config, inputs, credentials, timeoutMs, signal } = context;
  const url = websiteUrl(inputs.url);
  const summary = wantsSummary(config.outputs);
  const formats: unknown[] = ["markdown"];
  if (summary) formats.push({ type: "json", prompt: SUMMARY_PROMPT, schema: SUMMARY_SCHEMA });
  const response = await requestFirecrawl("/v2/scrape", credentials.apiKey, {
    body: { url, formats, onlyMainContent: true, timeout: bodyTimeout(timeoutMs) },
    timeoutMs, signal,
  });
  const data = asRecord(response.body.data);
  if (!response.body.data || (typeof data.markdown !== "string" && !summary)) {
    throw new PermanentRunError("Firecrawl returned an unexpected response. No automatic retry was made.");
  }
  const metadata = asRecord(data.metadata);
  const json = asRecord(data.json);
  const statusCode = typeof metadata.statusCode === "number" ? metadata.statusCode : null;
  const markdown = text(data.markdown);
  const found = (statusCode === null || statusCode < 400) && (markdown !== null || Object.keys(json).length > 0);
  const logicalOutputs = {
    markdown, title: text(metadata.title), pageDescription: text(metadata.description),
    finalUrl: text(metadata.url) ?? text(metadata.sourceURL), statusCode,
    summary: data.json ?? null, companyName: json.companyName, companyDescription: json.description,
    products: Array.isArray(json.products) ? json.products : null, pricingModel: json.pricingModel, hiringSignals: json.hiringSignals,
    creditsUsed: credits(metadata.creditsUsed), data,
  };
  return {
    value: found ? "Found" : "Not found",
    outputs: mapConfiguredOutputs(config, logicalOutputs, data),
    provider: "firecrawl", outcome: found ? "hit" : "miss", costCents: 0,
    latencyMs: response.latencyMs,
    request: { method: "POST", endpoint: "/v2/scrape", inputKeys: Object.keys(inputs), formats: summary ? ["markdown", "json"] : ["markdown"] },
    response: truncate(data),
  };
}

function searchLimit(value: unknown): number {
  if (value === undefined || value === null || value === "") return 5;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 10) {
    throw new PermanentRunError("Number of results: use a whole number from 1 to 10.");
  }
  return value;
}

async function searchWeb(context: IntegrationActionContext): Promise<CellResult> {
  const { config, inputs, credentials, timeoutMs, signal } = context;
  const query = typeof inputs.query === "string" ? inputs.query.trim() : "";
  if (!query || query.length > 500) throw new PermanentRunError("Search query: provide up to 500 characters.");
  const limit = searchLimit(inputs.limit);
  const includeMarkdown = inputs.includeMarkdown === true;
  const response = await requestFirecrawl("/v2/search", credentials.apiKey, {
    body: {
      query, limit, timeout: bodyTimeout(timeoutMs),
      ...(includeMarkdown ? { scrapeOptions: { formats: ["markdown"], onlyMainContent: true } } : {}),
    },
    timeoutMs, signal,
  });
  const data = asRecord(response.body.data);
  if (!Array.isArray(data.web)) {
    throw new PermanentRunError("Firecrawl returned an unexpected response. No automatic retry was made.");
  }
  const results = data.web.map((item) => {
    const result = asRecord(item);
    return {
      title: text(result.title), url: text(result.url), snippet: text(result.description),
      ...(includeMarkdown ? { markdown: text(result.markdown) } : {}),
    };
  });
  const top = results[0];
  const logicalOutputs = {
    results, resultCount: results.length,
    topTitle: top?.title ?? null, topUrl: top?.url ?? null, topSnippet: top?.snippet ?? null,
    creditsUsed: credits(response.body.creditsUsed), data,
  };
  return {
    value: results.length ? "Found" : "Not found",
    outputs: mapConfiguredOutputs(config, logicalOutputs, data),
    provider: "firecrawl", outcome: results.length ? "hit" : "miss", costCents: 0,
    latencyMs: response.latencyMs,
    request: { method: "POST", endpoint: "/v2/search", inputKeys: Object.keys(inputs), limit, includeMarkdown },
    response: truncate(data),
  };
}

const PROFILE_COLUMNS = ["full_name", "first_name", "last_name", "current_title", "seniority_level", "department", "contact_location", "linkedin_url", "company_name", "company_domain"];
const CONTACT_COLUMNS = ["work_email", "email_status", "mobile_phone", "direct_dial"];
const CONTACT_KEYS = new Set<string>(FIRECRAWL_CONTACT_OUTPUT_KEYS);

export function companyDomain(value: unknown): string {
  const invalid = () => { throw new PermanentRunError("Company domain: provide a website or domain such as example.com, without a username, password or port."); };
  if (typeof value !== "string" || !value.trim() || value.length > 1024) return invalid();
  try {
    const trimmed = value.trim();
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    const domain = url.hostname.replace(/^www\./, "").replace(/\.$/, "");
    const labels = domain.split(".");
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.port || domain.length > 253 || labels.length < 2
      || !labels.every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label)) || /^\d+$/.test(labels[labels.length - 1])) return invalid();
    return domain;
  } catch {
    return invalid();
  }
}

function jobTitles(value: unknown): string[] {
  if (value === undefined || value === null || value === "") return [];
  const invalid = () => { throw new PermanentRunError("Job titles: provide up to 10 titles of at most 100 characters each, as a list or comma-separated text."); };
  let list: unknown = value;
  if (typeof value === "string") {
    if (value.trim().startsWith("[")) {
      try { list = JSON.parse(value); } catch { return invalid(); }
    } else list = value.split(/[,\n]/);
  }
  if (!Array.isArray(list) || !list.every((item) => typeof item === "string")) return invalid();
  const titles = list.map((item: string) => item.trim()).filter(Boolean);
  if (titles.length > 10 || titles.some((title) => title.length > 100)) return invalid();
  return titles;
}

function peopleLimit(value: unknown): number {
  if (value === undefined || value === null || value === "") return 10;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 25) {
    throw new PermanentRunError("Number of people: use a whole number from 1 to 25.");
  }
  return value;
}

function wantsContacts(outputs: Record<string, string>): boolean {
  return Object.keys(outputs).some((key) => CONTACT_KEYS.has(key) || CONTACT_COLUMNS.some((column) => responsePointerFromOutputKey(key)?.endsWith(`/${column}`) === true));
}

type AlexandriaResult = { found: boolean; data: Record<string, unknown>; creditsUsed: number | null; latencyMs: number };

async function runAlexandria(context: IntegrationActionContext, provider: string, capability: string, options: Record<string, unknown>): Promise<AlexandriaResult> {
  const { credentials, timeoutMs, signal } = context;
  const response = await requestFirecrawl("/v2/scrape", credentials.apiKey, {
    body: { alexandria: { provider, capability, options }, timeout: bodyTimeout(timeoutMs) },
    timeoutMs, signal,
  });
  const body = asRecord(response.body.data);
  const result = asRecord(Array.isArray(body.alexandria) ? body.alexandria[0] : null);
  const creditsUsed = credits(body.creditsCost);
  const error = asRecord(result.error);
  if (result.error) {
    if (error.code === "not_found" || error.status === 404) return { found: false, data: {}, creditsUsed, latencyMs: response.latencyMs };
    const audit = { provider: "firecrawl", request: { path: "/v2/scrape", provider, capability }, response: { status: error.status ?? null, code: error.code ?? null } };
    const detail = text(error.message) || error.code === "THIRD_PARTY_DATA_TERMS_REQUIRED"
      ? firecrawlFailureDetail(0, error)
      : `The data provider returned an error${typeof error.code === "string" ? ` (${error.code})` : ""}.`;
    if (error.status === 429) throw new RetryableRunError(`Firecrawl Alexandria: ${detail}`, audit);
    if (error.code === "THIRD_PARTY_DATA_TERMS_REQUIRED") throw new PermanentRunError(`Firecrawl Alexandria: ${detail}`, audit);
    throw new PermanentRunError(`Firecrawl Alexandria: ${detail} No automatic retry was made.`, audit);
  }
  if (result.provider !== provider || !result.data || typeof result.data !== "object" || Array.isArray(result.data)) {
    throw new PermanentRunError("Firecrawl returned an unexpected response. No automatic retry was made.");
  }
  const data = asRecord(result.data);
  return { found: Object.keys(data).length > 0, data, creditsUsed, latencyMs: response.latencyMs };
}

async function findPeopleAtCompany(context: IntegrationActionContext): Promise<CellResult> {
  const { config, inputs } = context;
  const domain = companyDomain(inputs.companyDomain);
  const titles = jobTitles(inputs.jobTitles);
  const limit = peopleLimit(inputs.limit);
  const contactData = wantsContacts(config.outputs);
  const result = await runAlexandria(context, "getleadsio", "people/search", {
    filters: { domains: [domain], ...(titles.length ? { job_titles: titles } : {}) },
    limit, columns: contactData ? [...PROFILE_COLUMNS, ...CONTACT_COLUMNS] : PROFILE_COLUMNS,
  });
  if (result.found && (result.data.ok === false || !Array.isArray(result.data.contacts))) {
    throw new PermanentRunError("Firecrawl returned an unexpected response. No automatic retry was made.");
  }
  const records = Array.isArray(result.data.contacts) ? result.data.contacts.map(asRecord) : [];
  const name = (person: Record<string, unknown>) => text(person.full_name) ?? ([text(person.first_name), text(person.last_name)].filter(Boolean).join(" ") || null);
  const people = records.map((person) => ({
    name: name(person), firstName: text(person.first_name), lastName: text(person.last_name),
    title: text(person.current_title), seniority: text(person.seniority_level), department: text(person.department),
    location: text(person.contact_location), linkedinUrl: text(person.linkedin_url),
    companyName: text(person.company_name), companyDomain: text(person.company_domain),
  }));
  const contacts = contactData ? records.map((person) => ({
    name: name(person), linkedinUrl: text(person.linkedin_url),
    workEmail: text(person.work_email), emailStatus: text(person.email_status),
    mobilePhone: text(person.mobile_phone), directDial: text(person.direct_dial),
  })) : null;
  const top = people[0];
  const topContact = contacts?.[0];
  const logicalOutputs = {
    people, resultCount: people.length,
    topName: top?.name ?? null, topTitle: top?.title ?? null, topLinkedinUrl: top?.linkedinUrl ?? null,
    contacts, topWorkEmail: topContact?.workEmail ?? null, topEmailStatus: topContact?.emailStatus ?? null,
    topMobilePhone: topContact?.mobilePhone ?? null, topDirectDial: topContact?.directDial ?? null,
    creditsUsed: result.creditsUsed, data: result.data,
  };
  return {
    value: people.length ? "Found" : "Not found",
    outputs: mapConfiguredOutputs(config, logicalOutputs, result.data),
    provider: "firecrawl", outcome: people.length ? "hit" : "miss", costCents: 0,
    latencyMs: result.latencyMs,
    request: { method: "POST", endpoint: "/v2/scrape", alexandria: "getleadsio/people/search", inputKeys: Object.keys(inputs), limit, contactData },
    response: truncate(result.data),
  };
}

function profileUrl(value: unknown): string | null {
  const url = text(value);
  if (!url) return null;
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

async function enrichCompany(context: IntegrationActionContext): Promise<CellResult> {
  const { config, inputs } = context;
  const result = await runAlexandria(context, "people-data-labs", "company/enrich", { website: companyDomain(inputs.domain), titlecase: true, min_likelihood: 5 });
  const company = result.data;
  const location = asRecord(company.location);
  const found = result.found && (text(company.display_name) ?? text(company.name)) !== null;
  const number = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : null;
  const logicalOutputs = {
    companyName: text(company.display_name) ?? text(company.name), domain: text(company.website),
    headline: text(company.headline), description: text(company.summary),
    industry: text(company.industry_v2) ?? text(company.industry), companyType: text(company.type),
    employeeRange: text(company.size), employeeCount: number(company.employee_count),
    revenueRange: text(company.inferred_revenue), foundedYear: number(company.founded),
    headquarters: text(location.name), country: text(location.country),
    linkedinUrl: profileUrl(company.linkedin_url), tags: Array.isArray(company.tags) ? company.tags : null,
    totalFundingRaised: number(company.total_funding_raised), latestFundingStage: text(company.latest_funding_stage),
    lastFundingDate: text(company.last_funding_date),
    creditsUsed: result.creditsUsed, data: company,
  };
  return {
    value: found ? "Found" : "Not found",
    outputs: mapConfiguredOutputs(config, logicalOutputs, company),
    provider: "firecrawl", outcome: found ? "hit" : "miss", costCents: 0,
    latencyMs: result.latencyMs,
    request: { method: "POST", endpoint: "/v2/scrape", alexandria: "people-data-labs/company/enrich", inputKeys: Object.keys(inputs) },
    response: truncate(company),
  };
}

export const FIRECRAWL_HANDLERS: IntegrationActionHandlers = {
  "firecrawl.scrapeWebsite": scrapeWebsite,
  "firecrawl.searchWeb": searchWeb,
  "firecrawl.findPeopleAtCompany": findPeopleAtCompany,
  "firecrawl.enrichCompany": enrichCompany,
};
