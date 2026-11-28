# Firecrawl

[Firecrawl](https://www.firecrawl.dev/?utm_source=agentsdr&utm_medium=integration) reads web pages and searches the web through one API, and [Firecrawl Alexandria](https://alexandria.firecrawl.dev/?utm_source=agentsdr&utm_medium=integration) adds structured people and company data through the same API. This provider has the two web actions proposed in [#16](https://github.com/Kandid-ai/AgentSDR/issues/16), scrape a company website and search the web, and the two Firecrawl Alexandria lookups agreed in [#19](https://github.com/Kandid-ai/AgentSDR/issues/19), find people at a company and enrich a company. It is optional and does nothing until an organization connects its own Firecrawl API key.

## Connect and run

1. Open a table's enrichment dialog, select **Firecrawl**, and choose an action. Under **Account**, choose **Add account**, paste an API key from the [Firecrawl dashboard](https://www.firecrawl.dev/app/api-keys?utm_source=agentsdr&utm_medium=integration) without the `Bearer` prefix, and select **Verify & connect**. AgentSDR stores it through the existing organization-scoped encrypted connection system. The key check calls `GET /v2/team/credit-usage`, which uses no credits, and discards the response.
2. Bind the input columns and map the outputs you want to table columns.
3. Run a row or a selection. Every execution makes one Firecrawl request.

| Action | Inputs | Outputs |
| --- | --- | --- |
| [Scrape company website](https://docs.firecrawl.dev/api-reference/endpoint/scrape?utm_source=agentsdr&utm_medium=integration) | A domain (`example.com`) or a full page URL (`https://example.com/pricing`) | The page's main content as Markdown, title, meta description, final URL and HTTP status. Mapping any summary output (company summary, name, description, products, pricing model, hiring signals) also requests a JSON summary of the company, which uses more Firecrawl credits. |
| [Search the web](https://docs.firecrawl.dev/api-reference/endpoint/search?utm_source=agentsdr&utm_medium=integration) | A query, plus optional number of results (1 to 10, default 5) and **Include page Markdown** | A JSON list of results with `title`, `url`, `snippet` and, when requested, `markdown`; the count; and the top result's title, URL and snippet. Including page Markdown scrapes each result and uses more Firecrawl credits. |

The web actions report **Credits used** as Firecrawl returns it (empty when the API does not report it) and keep the complete data object in **Full response**, so JSON-pointer output mappings work too. Firecrawl credits are not currency, so AgentSDR's monetary cost stays zero. See [pricing](https://www.firecrawl.dev/pricing?utm_source=agentsdr&utm_medium=integration) for what each request costs.

A website that answers with an error status (for example 404) is a miss, not an error. A domain that does not resolve fails with Firecrawl's own message.

## Firecrawl Alexandria lookups

Each lookup is one `POST /v2/scrape` request with an `alexandria` body naming the provider, the capability and its options. It runs on the same organization key, connection and request rules as the web actions. Each one is backed by a data provider chosen for coverage AgentSDR does not already have natively:

| Action | Backed by | Inputs | Outputs |
| --- | --- | --- | --- |
| **Find people at company** | [GetLeads.io](https://alexandria.firecrawl.dev/providers/getleadsio?utm_source=agentsdr&utm_medium=integration) contact search (`getleadsio`, `people/search`) | A company domain, optional job titles (up to 10; a title matches when it contains any of them) and an optional number of people (1 to 25, default 10) | **People**: each person's name, job title, seniority, department, location, LinkedIn URL and company; the count; and the top match's name, job title and LinkedIn URL. Contact data has its own outputs, described below. |
| **Enrich company** | [People Data Labs](https://alexandria.firecrawl.dev/providers/people-data-labs?utm_source=agentsdr&utm_medium=integration) company enrichment (`people-data-labs`, `company/enrich`) | A company domain | Name, domain, headline, description, industry, company type, employee range and count, estimated revenue range, founded year, headquarters and country, LinkedIn URL, tags, total funding raised, latest funding stage and last funding date. |

Neither provider has a native integration in AgentSDR, so these actions add coverage rather than repeat it. GetLeads.io was picked because one search returns a page of people at a domain filtered by job title, with work emails and phone numbers available on the same call. People Data Labs was picked for its coverage of small and large companies and for its funding and headcount data. People Data Labs is asked for title-cased values and a match confidence of at least 5 out of 10, so a weak guess comes back as a miss instead of the wrong company.

Both lookups report **Credits used** from the `creditsCost` Firecrawl returns, and keep the provider's record in **Full response** for JSON-pointer mappings. Each provider's price in Firecrawl credits is on its Firecrawl Alexandria page linked above. A company or domain the provider has no record for is a miss, not an error. A company miss uses no Firecrawl credits, but GetLeads.io charges for every search, including one that finds nobody.

A people search can take around 20 seconds for a large company, against the default 30-second cell timeout. If searches time out, raise `GRID_CELL_TIMEOUT_MS` (Firecrawl is asked to finish within 60 seconds at most).

### Contact data

**Find people at company** asks GetLeads.io for contact data only when you map one of its contact outputs: **Contact data** (each person's name, LinkedIn URL, work email, email status, mobile phone and direct dial), or the top match's work email, email status, mobile phone or direct dial. Mapping a JSON pointer to `work_email`, `email_status`, `mobile_phone` or `direct_dial` under **Full response** does the same. When none of those is mapped, no email address or phone number is requested, stored or shown. Many profiles have no contact data, and those outputs stay empty.

You are the controller of the personal data you enrich. Before you map contact outputs, read [Responsible use](../../../../docs/responsible-use.md): email, call and privacy rules differ by country, and you decide who AgentSDR contacts.

### Provider errors and terms

A Firecrawl Alexandria provider can report an error inside an HTTP 200 response. The handler reads each result's `error` and fails the cell with the provider's message, with no automatic retry. A provider rate limit (status 429) goes back to the queue as retryable, like a Firecrawl rate limit. Some providers need an organization admin to accept their terms once in Firecrawl before they run. That comes back as a permanent error with the link to accept them (a link outside `firecrawl.dev` is replaced by Firecrawl's data-sources settings page). Accept the terms there, then run the row again.

## Failure handling

Requests go only to `https://api.firecrawl.dev`, refuse redirects, stop at the cell timeout (Firecrawl is asked to finish two seconds earlier) and read at most 5 MiB of response. The key is sent only in the `Authorization` header and never appears in results, audit rows or error messages. Inputs are checked before any request is made.

Requests carry `origin: "agentsdr"`. The handler never retries on its own. A rate limit (HTTP 429) is handed to the queue as retryable because Firecrawl does not process a rate-limited request. Every other failure, including a timeout or a dropped connection, is permanent so the queue cannot replay a request that may already have used Firecrawl credits. Check account usage before retrying by hand.

## Validation

The TypeScript fixtures call the registered handlers and verifier with mocked HTTP responses. They cover request bodies, output mapping, when the JSON summary, page Markdown and contact data are requested, Firecrawl Alexandria errors inside HTTP 200, terms that need accepting, missing and odd provider fields, input validation before any request, response-size limits, cancelled jobs, error handling and retry behavior, per-connection keys and credential verification. They use no real key and make no paid calls.

```sh
bun test --conditions=react-server src/lib/integrations/firecrawl/actions.test.ts
bun run typecheck
bun run lint
bun run test
bun run build
```
