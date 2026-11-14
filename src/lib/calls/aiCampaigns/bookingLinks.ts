/**
 * The booking links a campaign can pick from: the organization's Cal.com
 * event types, read with the Cal.com integration's API key. Client-safe
 * (shapes and the pure parser); the call itself is bookingLinks.server.ts.
 */

/** One Cal.com event type, as the campaign's Booking link picker shows it. */
export type BookingLinkOption = {
  id: number;
  title: string;
  minutes: number | null;
  url: string;
  /** Hidden from the Cal.com profile page; still bookable by its link. */
  hidden: boolean;
};

/**
 * `not_connected`: no Cal.com integration; `no_api_key`: connected without
 * the optional API key; `error`: Cal.com refused or could not be reached.
 * In every case but `ok` the picker falls back to typing a link.
 */
export type BookingLinksResponse =
  | { status: "ok"; links: BookingLinkOption[] }
  | { status: "not_connected" }
  | { status: "no_api_key" }
  | { status: "error"; error: string };

/**
 * Cal.com's GET /v2/event-types (cal-api-version 2024-06-14) answer, as
 * options: only entries with an http(s) bookingUrl, visible ones first, each
 * group in Cal.com's own order.
 */
export function parseCalcomEventTypes(body: unknown): BookingLinkOption[] {
  const data = (body as { data?: unknown } | null)?.data;
  if (!Array.isArray(data)) return [];
  const links: BookingLinkOption[] = [];
  for (const item of data) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    const url = typeof entry.bookingUrl === "string" ? entry.bookingUrl.trim() : "";
    if (!/^https?:\/\//i.test(url) || typeof entry.id !== "number") continue;
    const title = typeof entry.title === "string" && entry.title.trim() ? entry.title.trim() : url;
    const minutes = typeof entry.lengthInMinutes === "number" ? entry.lengthInMinutes : null;
    links.push({ id: entry.id, title, minutes, url, hidden: entry.hidden === true });
  }
  return [...links.filter((link) => !link.hidden), ...links.filter((link) => link.hidden)];
}

/** "Call with founder · 30 min · /30mins" — what the picker shows for one link. */
export function bookingLinkLabel(link: BookingLinkOption): string {
  const path = link.url.replace(/^https?:\/\/[^/]+/i, "") || link.url;
  return [link.title, link.minutes ? `${link.minutes} min` : null, path, link.hidden ? "hidden" : null].filter(Boolean).join(" · ");
}
