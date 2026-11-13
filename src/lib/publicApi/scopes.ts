/**
 * What an outside application may do with AgentSDR, as OAuth-style scopes.
 * One list for both ways in: OAuth access tokens (MCP clients such as Claude
 * or Cursor, scopes granted on the consent screen) and API keys (scopes
 * chosen when the key is created). Every MCP tool and public API route names
 * the one scope it needs; a caller without it is refused.
 *
 * Client-safe: Settings and the consent screen render these labels.
 * Adding an area (campaigns for MCP, say) is a new entry here plus the tools
 * or routes that require it.
 */

export const API_SCOPES = {
  "crm:read": {
    label: "Read the CRM",
    description: "See the Action required queue and lead records: conversations, details and calls.",
  },
  "crm:write": {
    label: "Work the CRM",
    description: "Edit and rewrite drafts, change stages, snooze or close records, and mark leads Do Not Contact.",
  },
  "crm:send": {
    label: "Send messages",
    description: "Send replies to leads by email, LinkedIn or WhatsApp as you.",
  },
  "campaigns:read": {
    label: "Read campaigns",
    description: "List email campaigns.",
  },
  "campaigns:write": {
    label: "Manage campaign leads",
    description: "Add leads to email campaigns and stop their sequences.",
  },
} as const satisfies Record<string, { label: string; description: string }>;

export type ApiScope = keyof typeof API_SCOPES;

export const ALL_API_SCOPES = Object.keys(API_SCOPES) as ApiScope[];

/** The scopes an MCP client can ask for (the rest belong to the REST API). */
export const MCP_SCOPES = ["crm:read", "crm:write", "crm:send"] as const satisfies readonly ApiScope[];

export function isApiScope(value: unknown): value is ApiScope {
  return typeof value === "string" && value in API_SCOPES;
}

/** Keep the known scopes of a list, in registry order, without duplicates. */
export function normalizeScopes(values: readonly unknown[]): ApiScope[] {
  const wanted = new Set(values.filter(isApiScope));
  return ALL_API_SCOPES.filter((scope) => wanted.has(scope));
}

/** Parse an OAuth `scope` claim ("openid crm:read crm:send") into the API scopes it grants. */
export function scopesFromClaim(claim: unknown): ApiScope[] {
  return typeof claim === "string" ? normalizeScopes(claim.split(/\s+/)) : [];
}
