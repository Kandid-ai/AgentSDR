import type { ActionOutputDefinition, IntegrationDefinition } from "../types";

const UTM = "utm_source=agentsdr&utm_medium=integration";

const responseOutputs: ActionOutputDefinition[] = [
  { key: "creditsUsed", name: "Credits used", description: "Firecrawl credits reported for this request. Empty when the API does not report usage; not a currency amount.", columnType: "number" },
  { key: "data", name: "Full response", description: "The complete data object Firecrawl returned.", columnType: "json" },
];

export const FIRECRAWL_SUMMARY_OUTPUT_KEYS = ["summary", "companyName", "companyDescription", "products", "pricingModel", "hiringSignals"] as const;

export const FIRECRAWL_CONTACT_OUTPUT_KEYS = ["contacts", "topWorkEmail", "topEmailStatus", "topMobilePhone", "topDirectDial"] as const;

export const FIRECRAWL: IntegrationDefinition = {
  key: "firecrawl",
  name: "Firecrawl",
  description: "Search the web, read company websites as clean Markdown or a JSON summary, and find people and company data through Firecrawl Alexandria, using your Firecrawl account.",
  websiteUrl: `https://www.firecrawl.dev/?${UTM}`,
  iconText: "FC",
  iconBackground: "#FA5D19",
  auth: {
    type: "api_key",
    fields: [{ key: "apiKey", label: "API key", placeholder: "fc-..., without Bearer", inputType: "password", required: true }],
    helpUrl: `https://www.firecrawl.dev/app/api-keys?${UTM}`,
  },
  actions: [
    {
      key: "scrape-website",
      name: "Scrape company website",
      description: "Read one page, such as a company homepage, as clean Markdown. Map any summary output to also get a JSON summary of the company (description, products, pricing model, hiring signals), which uses more Firecrawl credits.",
      docsUrl: `https://docs.firecrawl.dev/api-reference/endpoint/scrape?${UTM}`,
      category: "enrich-company-info", type: "enrichment", tags: ["website", "scrape", "markdown", "company research"],
      inputs: [{ key: "url", name: "Website or URL", description: "A company domain such as example.com, or the full URL of a page such as https://example.com/pricing.", valueType: "domain", acceptedColumnTypes: ["text", "url"], required: true, example: "example.com" }],
      outputs: [
        { key: "markdown", name: "Page Markdown", columnType: "text" },
        { key: "title", name: "Page title", columnType: "text" },
        { key: "pageDescription", name: "Page meta description", columnType: "text" },
        { key: "finalUrl", name: "Final URL", description: "The page URL after redirects.", columnType: "url" },
        { key: "statusCode", name: "HTTP status", description: "The status the website answered with.", columnType: "number" },
        { key: "summary", name: "Company summary", description: "JSON summary of the company. Mapping it requests the JSON format, which uses more Firecrawl credits.", columnType: "json" },
        { key: "companyName", name: "Company name (summary)", columnType: "text" },
        { key: "companyDescription", name: "Company description (summary)", columnType: "text" },
        { key: "products", name: "Products (summary)", columnType: "json" },
        { key: "pricingModel", name: "Pricing model (summary)", columnType: "text" },
        { key: "hiringSignals", name: "Hiring signals (summary)", columnType: "text" },
        ...responseOutputs,
      ],
      handlerKey: "firecrawl.scrapeWebsite", implemented: true,
    },
    {
      key: "search-web",
      name: "Search the web",
      description: "Search the web for a query, such as a company name plus funding or hiring, and return the top results with title, URL and snippet. Optionally include each result page as Markdown, which uses more Firecrawl credits.",
      docsUrl: `https://docs.firecrawl.dev/api-reference/endpoint/search?${UTM}`,
      category: "tools", type: "enrichment", tags: ["web search", "news", "signals", "company research"],
      inputs: [
        { key: "query", name: "Search query", description: "What to search for, up to 500 characters.", valueType: "text", acceptedColumnTypes: ["text"], required: true, example: "Example Inc funding" },
        { key: "limit", name: "Number of results", description: "From 1 to 10. Defaults to 5.", valueType: "number", acceptedColumnTypes: ["number"], required: false, group: "advanced" },
        { key: "includeMarkdown", name: "Include page Markdown", description: "Also scrape each result page and return its content as Markdown. Uses more Firecrawl credits.", valueType: "boolean", acceptedColumnTypes: ["boolean"], required: false, group: "advanced" },
      ],
      outputs: [
        { key: "results", name: "Results", description: "Each result's title, url, snippet and, when requested, markdown.", columnType: "json" },
        { key: "resultCount", name: "Results returned", columnType: "number" },
        { key: "topTitle", name: "Top result title", columnType: "text" },
        { key: "topUrl", name: "Top result URL", columnType: "url" },
        { key: "topSnippet", name: "Top result snippet", columnType: "text" },
        ...responseOutputs,
      ],
      handlerKey: "firecrawl.searchWeb", implemented: true,
    },
    {
      key: "find-people-at-company",
      name: "Find people at company",
      description: "Find people at a company by domain and job title through Firecrawl Alexandria, using GetLeads.io data. Returns profiles. Map a contact output to also get work emails and phone numbers where GetLeads.io has them. Uses Firecrawl credits at the price listed for GetLeads.io, and a search that finds nobody is still charged.",
      docsUrl: `https://alexandria.firecrawl.dev/providers/getleadsio?${UTM}`,
      category: "enrich-person-info", type: "enrichment", tags: ["people", "company", "job title", "Firecrawl Alexandria"],
      inputs: [
        { key: "companyDomain", name: "Company domain", description: "Company website or domain, such as example.com.", valueType: "domain", acceptedColumnTypes: ["text", "url"], required: true, example: "example.com" },
        { key: "jobTitles", name: "Job titles", description: "Up to 10 job titles. A person matches when their title contains any of them. Accepts an array, JSON array, or comma/newline-separated text. Leave empty to list anyone at the company.", valueType: "text", acceptedColumnTypes: ["text", "json", "multiselect"], multiple: true, required: false, example: "VP Sales" },
        { key: "limit", name: "Number of people", description: "From 1 to 25. Defaults to 10.", valueType: "number", acceptedColumnTypes: ["number"], required: false, group: "advanced" },
      ],
      outputs: [
        { key: "people", name: "People", description: "Each person's name, job title, seniority, department, location, LinkedIn URL and company. No contact data.", columnType: "json" },
        { key: "resultCount", name: "People returned", columnType: "number" },
        { key: "topName", name: "Top match name", columnType: "text" },
        { key: "topTitle", name: "Top match job title", columnType: "text" },
        { key: "topLinkedinUrl", name: "Top match LinkedIn URL", columnType: "url" },
        { key: "contacts", name: "Contact data", description: "Each person's name, LinkedIn URL, work email, email status, mobile phone and direct dial, where GetLeads.io has them. Mapping any contact output requests contact data.", columnType: "json" },
        { key: "topWorkEmail", name: "Top match work email", description: "Mapping it requests contact data.", columnType: "email" },
        { key: "topEmailStatus", name: "Top match email status", description: "GetLeads.io's status for the work email, such as VALID. Mapping it requests contact data.", columnType: "text" },
        { key: "topMobilePhone", name: "Top match mobile phone", description: "Mapping it requests contact data.", columnType: "text" },
        { key: "topDirectDial", name: "Top match direct dial", description: "Mapping it requests contact data.", columnType: "text" },
        ...responseOutputs,
      ],
      handlerKey: "firecrawl.findPeopleAtCompany", implemented: true,
    },
    {
      key: "enrich-company",
      name: "Enrich company",
      description: "Get a company profile from its domain through Firecrawl Alexandria, using People Data Labs data: name, description, industry, headcount, estimated revenue, founding year, headquarters, LinkedIn page and funding. A domain with no confident match is a miss and uses no credits.",
      docsUrl: `https://alexandria.firecrawl.dev/providers/people-data-labs?${UTM}`,
      category: "enrich-company-info", type: "enrichment", tags: ["company", "domain", "firmographics", "funding", "Firecrawl Alexandria"],
      inputs: [{ key: "domain", name: "Company domain", description: "Company website or domain, such as example.com.", valueType: "domain", acceptedColumnTypes: ["text", "url"], required: true, example: "example.com" }],
      outputs: [
        { key: "companyName", name: "Company name", columnType: "text" },
        { key: "domain", name: "Domain", columnType: "text" },
        { key: "headline", name: "Headline", columnType: "text" },
        { key: "description", name: "Description", columnType: "text" },
        { key: "industry", name: "Industry", columnType: "text" },
        { key: "companyType", name: "Company type", description: "Such as private, public or nonprofit.", columnType: "text" },
        { key: "employeeRange", name: "Employee range", columnType: "text" },
        { key: "employeeCount", name: "Employee count", columnType: "number" },
        { key: "revenueRange", name: "Estimated revenue range", columnType: "text" },
        { key: "foundedYear", name: "Founded year", columnType: "number" },
        { key: "headquarters", name: "Headquarters", description: "City, region and country.", columnType: "text" },
        { key: "country", name: "Headquarters country", columnType: "text" },
        { key: "linkedinUrl", name: "Company LinkedIn URL", columnType: "url" },
        { key: "tags", name: "Tags", description: "Topics People Data Labs associates with the company.", columnType: "json" },
        { key: "totalFundingRaised", name: "Total funding raised", description: "In US dollars, as reported by People Data Labs.", columnType: "number" },
        { key: "latestFundingStage", name: "Latest funding stage", columnType: "text" },
        { key: "lastFundingDate", name: "Last funding date", columnType: "date" },
        ...responseOutputs,
      ],
      handlerKey: "firecrawl.enrichCompany", implemented: true,
    },
  ],
};
