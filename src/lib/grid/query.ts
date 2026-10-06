import { sql, type SQL } from "drizzle-orm";
import { gridRows } from "./schema";
import type { ColumnType } from "./types";

/**
 * Filtering and sorting over the JSONB value plane.
 *
 * Nothing here is string-interpolated into SQL: column keys and user values
 * alike are bound as parameters by drizzle's sql template, so `cells ->> $1`
 * is injection-safe on its own. assertKnownColumns() is defence in depth and
 * a correctness check — it rejects a saved view naming a column that has since
 * been deleted, rather than silently returning no rows.
 */

/** Matches Clay's operator dropdown, in its order. */
export const FILTER_OPERATORS = [
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "empty",
  "notEmpty",
  "contains",
  "notContains",
] as const;

export type FilterOperator = (typeof FILTER_OPERATORS)[number];

export const OPERATOR_LABELS: Record<FilterOperator, string> = {
  eq: "equal to",
  neq: "not equal to",
  gt: "greater than",
  gte: "greater or equal to",
  lt: "less than",
  lte: "less or equal to",
  empty: "is empty",
  notEmpty: "is not empty",
  contains: "contains",
  notContains: "does not contain",
};

/** Operators that ignore the value box — the UI hides it for these. */
export const VALUELESS_OPERATORS: ReadonlySet<FilterOperator> = new Set(["empty", "notEmpty"]);

export type FilterCondition = {
  columnKey: string;
  operator: FilterOperator;
  value?: string;
  /** Muted by the eye toggle — kept in the view but not applied. */
  disabled?: boolean;
};

export type FilterGroup = {
  conjunction: "and" | "or";
  conditions: (FilterCondition | FilterGroup)[];
};

export type SortSpec = { columnKey: string; direction: "asc" | "desc" };

export type GridQuery = {
  filters?: FilterGroup;
  sorts?: SortSpec[];
  /** Free-text search across every visible column. */
  search?: string;
};

export function isFilterGroup(c: FilterCondition | FilterGroup): c is FilterGroup {
  return (c as FilterGroup).conditions !== undefined;
}

/* -------------------------------------------------------------------------- */

/**
 * Numbers are the only type needing a cast, and the cast has to be guarded:
 * a single non-numeric string in the column would otherwise abort the whole
 * query with "invalid input syntax for type numeric".
 *
 * Dates deliberately compare as text. Values are stored ISO-8601, which sorts
 * and compares lexicographically in the right order, so a cast buys nothing
 * and would carry the same failure mode.
 */
function valueExpr(columnKey: string, type: ColumnType): SQL {
  const raw = sql`${gridRows.cells} ->> ${columnKey}`;
  if (type === "number" || type === "currency") {
    return sql`(CASE WHEN ${raw} ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN (${raw})::numeric END)`;
  }
  return raw;
}

/** Bind the comparison value in the same shape as the column expression. */
function boundValue(value: string, type: ColumnType): SQL {
  if (type === "number" || type === "currency") {
    const n = Number(String(value).replace(/,/g, ""));
    return sql`${Number.isFinite(n) ? n : null}::numeric`;
  }
  return sql`${value}`;
}

function conditionSql(
  c: FilterCondition,
  types: Map<string, ColumnType>,
): SQL | null {
  const type = types.get(c.columnKey);
  if (!type) return null; // column deleted since the view was saved — ignore it

  const left = valueExpr(c.columnKey, type);
  const raw = sql`${gridRows.cells} ->> ${c.columnKey}`;

  switch (c.operator) {
    case "empty":
      return sql`(${raw} IS NULL OR ${raw} = '')`;
    case "notEmpty":
      return sql`(${raw} IS NOT NULL AND ${raw} <> '')`;
    default:
      break;
  }

  // Every other operator needs a value; a blank one is treated as "no filter"
  // rather than as an empty-string comparison, which is almost never intended
  // and would silently hide every row while the user is still typing.
  const value = c.value ?? "";
  if (value === "") return null;

  switch (c.operator) {
    case "eq":
      return sql`${left} = ${boundValue(value, type)}`;
    case "neq":
      // NULL <> x is NULL, not true, so an unset cell would drop out of a
      // "not equal to" result. Treat unset as not-equal, which is what the
      // filter plainly means.
      return sql`(${left} IS DISTINCT FROM ${boundValue(value, type)})`;
    case "gt":
      return sql`${left} > ${boundValue(value, type)}`;
    case "gte":
      return sql`${left} >= ${boundValue(value, type)}`;
    case "lt":
      return sql`${left} < ${boundValue(value, type)}`;
    case "lte":
      return sql`${left} <= ${boundValue(value, type)}`;
    case "contains":
      return sql`${raw} ILIKE ${"%" + value + "%"}`;
    case "notContains":
      return sql`(${raw} IS NULL OR ${raw} NOT ILIKE ${"%" + value + "%"})`;
    default:
      return null;
  }
}

function groupSql(group: FilterGroup, types: Map<string, ColumnType>): SQL | null {
  const parts = group.conditions
    .filter((c) => isFilterGroup(c) || !c.disabled)
    .map((c) => (isFilterGroup(c) ? groupSql(c, types) : conditionSql(c, types)))
    .filter((p): p is SQL => p !== null);

  if (!parts.length) return null;
  if (parts.length === 1) return parts[0];

  const joiner = group.conjunction === "or" ? sql` OR ` : sql` AND `;
  return sql`(${sql.join(parts, joiner)})`;
}

/** Case-insensitive match on any of the given columns. */
function searchSql(term: string, columnKeys: string[]): SQL | null {
  const t = term.trim();
  if (!t || !columnKeys.length) return null;

  const parts = columnKeys.map(
    (k) => sql`${gridRows.cells} ->> ${k} ILIKE ${"%" + t + "%"}`,
  );
  return sql`(${sql.join(parts, sql` OR `)})`;
}

/**
 * The WHERE fragment for a query, or null when nothing narrows the result.
 * Callers AND this with the table-id predicate.
 */
export function buildWhere(
  query: GridQuery,
  columns: { key: string; type: ColumnType }[],
): SQL | null {
  const types = new Map(columns.map((c) => [c.key, c.type]));
  const parts: SQL[] = [];

  if (query.filters) {
    const f = groupSql(query.filters, types);
    if (f) parts.push(f);
  }

  if (query.search) {
    const s = searchSql(
      query.search,
      columns.map((c) => c.key),
    );
    if (s) parts.push(s);
  }

  if (!parts.length) return null;
  return parts.length === 1 ? parts[0] : sql`(${sql.join(parts, sql` AND `)})`;
}

/**
 * ORDER BY for a query. Always ends with `position` so the result is stable:
 * without a tiebreaker, rows with equal sort values can come back in a
 * different order on every request and appear to shuffle as the user scrolls.
 */
export function buildOrderBy(
  sorts: SortSpec[] | undefined,
  columns: { key: string; type: ColumnType }[],
): SQL {
  const types = new Map(columns.map((c) => [c.key, c.type]));
  const parts: SQL[] = [];

  for (const s of sorts ?? []) {
    const type = types.get(s.columnKey);
    if (!type) continue;
    const expr = valueExpr(s.columnKey, type);
    // NULLS LAST in both directions: an unset cell is "no value", and pushing
    // those to the top of a descending sort buries the rows that matter.
    parts.push(
      s.direction === "desc" ? sql`${expr} DESC NULLS LAST` : sql`${expr} ASC NULLS LAST`,
    );
  }

  parts.push(sql`${gridRows.position} ASC`);
  return sql.join(parts, sql`, `);
}

/* -------------------------------------------------------------------------- */

/**
 * Rejects a query naming a column the table does not have.
 *
 * This is the check that lets valueExpr() interpolate a key into SQL: by the
 * time a key gets there it has been matched against the table's own columns.
 */
export function assertKnownColumns(query: GridQuery, known: Set<string>): void {
  const visit = (c: FilterCondition | FilterGroup): void => {
    if (isFilterGroup(c)) {
      c.conditions.forEach(visit);
      return;
    }
    if (!known.has(c.columnKey)) {
      throw new Error(`Unknown column in filter: "${c.columnKey}"`);
    }
    if (!FILTER_OPERATORS.includes(c.operator)) {
      throw new Error(`Unknown filter operator: "${c.operator}"`);
    }
  };

  if (query.filters) visit(query.filters);

  for (const s of query.sorts ?? []) {
    if (!known.has(s.columnKey)) {
      throw new Error(`Unknown column in sort: "${s.columnKey}"`);
    }
    if (s.direction !== "asc" && s.direction !== "desc") {
      throw new Error(`Sort direction must be asc or desc`);
    }
  }
}
