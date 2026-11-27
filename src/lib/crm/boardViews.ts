/**
 * Saved views of the Funnel page (`/crm/pipeline`): a name plus everything
 * that decides what the page shows — board or list, columns by status or by
 * stage, the filters, the column order and which parts of a card show.
 * Stored per organization in `crm_board_views` (src/lib/crm/boardViews.server.ts),
 * so a team shares its views. Client-safe: no imports with runtime cost.
 *
 * A "stage" here is a board column key: a sub-stage's id, or
 * `none:<category>` for records of that category with no sub-stage
 * (`none:unclassified` for records with no category at all). The three
 * "statuses" are the pipeline's needs_action / waiting / exhausted.
 */

export const BOARD_STATUSES = ["needs_action", "waiting", "exhausted"] as const;
export type BoardStatus = (typeof BOARD_STATUSES)[number];

export const BOARD_CHANNELS = ["email", "linkedin", "whatsapp"] as const;
export type BoardChannel = (typeof BOARD_CHANNELS)[number];

/** When either side last wrote (greatest of last inbound and last outbound). */
export const LAST_CONTACT_FILTERS = {
  any: { label: "Any time" },
  "1d": { label: "In the last 24 hours" },
  "7d": { label: "In the last 7 days" },
  "30d": { label: "In the last 30 days" },
  "over_7d": { label: "More than 7 days ago" },
  "over_30d": { label: "More than 30 days ago" },
} as const;
export type LastContactFilter = keyof typeof LAST_CONTACT_FILTERS;

export const CARD_FIELDS = [
  { key: "company", label: "Company", detail: "Domain or company name under the lead's name" },
  { key: "stage", label: "Stage", detail: "The stage picker, and the AI's proposed change" },
  { key: "reply", label: "Their last reply", detail: "Or the call a call-only lead follows" },
  { key: "draft", label: "Draft reply", detail: "The waiting draft, with Edit and Send" },
  { key: "lastContact", label: "Last contact", detail: "When either side last wrote, and who" },
  { key: "status", label: "Status", detail: "What is due or scheduled next" },
  { key: "sequence", label: "Follow-ups", detail: "How many of the sequence's follow-ups have gone out" },
] as const;
export type CardField = (typeof CARD_FIELDS)[number]["key"];

export type BoardFilters = {
  /** Column keys; empty = every stage. */
  stages: string[];
  /** Empty = every status. */
  statuses: BoardStatus[];
  /** Empty = every channel. */
  channels: BoardChannel[];
  search: string;
  lastContact: LastContactFilter;
};

/** The icons a view can wear (src/components/crm/viewIcons.tsx draws them). */
export const VIEW_ICON_KEYS = [
  "kanban", "target", "fire", "rocket", "star", "flag", "calendar", "handshake", "trophy", "money",
  "briefcase", "mail", "phone", "chat", "user", "team", "lightbulb", "time", "bookmark", "heart",
] as const;
export type ViewIconKey = (typeof VIEW_ICON_KEYS)[number];

export type BoardViewConfig = {
  /** Empty = picked from the view's id, so views differ until someone chooses. */
  icon: ViewIconKey | "";
  layout: "board" | "list";
  groupBy: "status" | "stage";
  filters: BoardFilters;
  /** Column keys in the order last arranged; columns it does not name follow, in funnel order. */
  columnOrder: string[];
  hiddenFields: CardField[];
  showEmptyColumns: boolean;
};

export type BoardView = {
  id: string;
  name: string;
  position: number;
  config: BoardViewConfig;
  createdAt: string;
  updatedAt: string;
};

export const EMPTY_FILTERS: BoardFilters = { stages: [], statuses: [], channels: [], search: "", lastContact: "any" };

export const DEFAULT_VIEW_CONFIG: BoardViewConfig = {
  icon: "",
  layout: "board",
  groupBy: "stage",
  filters: EMPTY_FILTERS,
  columnOrder: [],
  hiddenFields: [],
  showEmptyColumns: false,
};

export const VIEW_NAME_MAX = 60;
export const COLUMN_KEY_PATTERN = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|none:(?:customer|interested|not_interested|other|unclassified))$/i;

function strings(value: unknown, limit = 200): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string"))].slice(0, limit) : [];
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

const CARD_FIELD_KEYS = CARD_FIELDS.map((field) => field.key);

/** Any stored or posted value as a valid filter set; unknown entries are dropped. */
export function normalizeFilters(value: unknown): BoardFilters {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    stages: strings(raw.stages).filter((key) => COLUMN_KEY_PATTERN.test(key)),
    statuses: strings(raw.statuses).filter((key): key is BoardStatus => oneOf(key, BOARD_STATUSES)),
    channels: strings(raw.channels).filter((key): key is BoardChannel => oneOf(key, BOARD_CHANNELS)),
    search: typeof raw.search === "string" ? raw.search.slice(0, 200) : "",
    lastContact: oneOf(raw.lastContact, Object.keys(LAST_CONTACT_FILTERS) as LastContactFilter[]) ? raw.lastContact : "any",
  };
}

/** Any stored or posted value as a valid view config; what is missing takes the default. */
export function normalizeViewConfig(value: unknown): BoardViewConfig {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    icon: oneOf(raw.icon, VIEW_ICON_KEYS) ? raw.icon : "",
    layout: raw.layout === "list" ? "list" : "board",
    groupBy: raw.groupBy === "status" ? "status" : "stage",
    filters: normalizeFilters(raw.filters),
    columnOrder: strings(raw.columnOrder).filter((key) => COLUMN_KEY_PATTERN.test(key)),
    hiddenFields: strings(raw.hiddenFields).filter((key): key is CardField => oneOf(key, CARD_FIELD_KEYS)),
    showEmptyColumns: raw.showEmptyColumns === true,
  };
}

export function normalizeViewName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.replace(/\s+/g, " ").trim().slice(0, VIEW_NAME_MAX);
  return name || null;
}

/**
 * The filters as `/api/crm/actions` query parameters (comma-separated
 * lists); `parseBoardFilterParams` reads them back. Empty lists are left out.
 */
export function boardFilterParams(filters: BoardFilters, params = new URLSearchParams()): URLSearchParams {
  if (filters.stages.length) params.set("stages", filters.stages.join(","));
  if (filters.statuses.length) params.set("statuses", filters.statuses.join(","));
  if (filters.channels.length) params.set("channels", filters.channels.join(","));
  if (filters.search.trim()) params.set("search", filters.search.trim());
  if (filters.lastContact !== "any") params.set("lastContact", filters.lastContact);
  return params;
}

export function parseBoardFilterParams(params: URLSearchParams): BoardFilters {
  const list = (name: string) => (params.get(name) ?? "").split(",").map((item) => item.trim()).filter(Boolean);
  return normalizeFilters({
    stages: list("stages"),
    statuses: list("statuses"),
    channels: list("channels"),
    search: params.get("search") ?? "",
    lastContact: params.get("lastContact") ?? "any",
  });
}

/** Two configs are the same view (for "unsaved changes"). */
export function sameViewConfig(a: BoardViewConfig, b: BoardViewConfig): boolean {
  return JSON.stringify(normalizeViewConfig(a)) === JSON.stringify(normalizeViewConfig(b));
}

/**
 * The views a new organization starts with, by sub-stage key so they fit
 * any organization's pipeline: leads who are interested but have not booked
 * a call, and everyone from a booked call onwards. A key the organization
 * does not have is skipped; a view left with no stage at all is not created.
 */
export const DEFAULT_VIEWS: ReadonlyArray<{ name: string; icon: ViewIconKey; subcategoryKeys: readonly string[]; noSubStage: readonly string[] }> = [
  {
    name: "Interested – not booked",
    icon: "target",
    subcategoryKeys: ["information_requested", "case_study", "demo_requested", "meeting_requested"],
    noSubStage: ["interested"],
  },
  {
    name: "Booked onwards",
    icon: "calendar",
    subcategoryKeys: ["meeting_booked", "meeting_no_show", "meeting_done", "trial_requested", "trial_user", "pilot", "customer"],
    noSubStage: ["customer"],
  },
];

/** A view's icon: its own, or one picked from its id so that views differ. */
export function viewIconKey(view: { id: string; config?: { icon?: string } }): ViewIconKey {
  const own = view.config?.icon;
  if (own && (VIEW_ICON_KEYS as readonly string[]).includes(own)) return own as ViewIconKey;
  let hash = 0;
  for (const character of view.id) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return VIEW_ICON_KEYS[hash % VIEW_ICON_KEYS.length];
}

/** The default views' configs for an organization's sub-stages (key → id). */
export function defaultViewConfigs(subcategoryIdsByKey: ReadonlyMap<string, string>): Array<{ name: string; config: BoardViewConfig }> {
  return DEFAULT_VIEWS.flatMap((view) => {
    const ids = view.subcategoryKeys.map((key) => subcategoryIdsByKey.get(key)).filter((id): id is string => Boolean(id));
    if (!ids.length) return [];
    const stages = [...ids, ...view.noSubStage.map((category) => `none:${category}`)];
    return [{ name: view.name, config: { ...DEFAULT_VIEW_CONFIG, icon: view.icon, filters: { ...EMPTY_FILTERS, stages }, columnOrder: stages } }];
  });
}
