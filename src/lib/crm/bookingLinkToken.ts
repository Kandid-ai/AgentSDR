/**
 * The `{{booking_link}}` merge field of CRM messages: a draft (AI or a
 * person's) writes the token, and the send puts the record's own Cal.com link
 * in its place (src/lib/crm/bookingLink.ts). Also the booking page setting's
 * validation, shared by the settings route and its form.
 *
 * Pure and import-free, so client components may use it.
 */

/** The token as it is written: what the draft prompt tells the model to use. */
export const BOOKING_LINK_TOKEN = "{{booking_link}}";

/**
 * A CRM record's booking code is a character longer than an AI calling
 * campaign lead's (BOOKING_CODE_LENGTH, 4), so the two are told apart and
 * never collide in practice.
 */
export const CRM_BOOKING_CODE_LENGTH = 5;

export const BOOKING_URL_MAX_LENGTH = 500;

/** `{{booking_link}}`, in any case, with spaces allowed inside the braces. */
const TOKEN_SOURCE = String.raw`\{\{\s*booking_link\s*\}\}`;
const tokenPattern = () => new RegExp(TOKEN_SOURCE, "gi");
/** The token where an attribute value is expected (`href="{{booking_link}}"`): the bare URL goes there, not a link. */
const attributePattern = () => new RegExp(String.raw`(=\s*["']?)` + TOKEN_SOURCE, "gi");

export function hasBookingLinkToken(...texts: readonly (string | null | undefined)[]): boolean {
  return texts.some((text) => !!text && tokenPattern().test(text));
}

/** Every `{{booking_link}}` in a plain-text body becomes the link. */
export function replaceBookingLinkToken(text: string, link: string): string {
  return text.replace(tokenPattern(), () => link);
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/**
 * Every `{{booking_link}}` in an HTML body becomes a link to it — or, inside
 * an attribute (`<a href="{{booking_link}}">`), just the URL.
 */
export function replaceBookingLinkTokenInHtml(html: string, link: string): string {
  const escaped = escapeHtml(link);
  return html
    .replace(attributePattern(), (_, prefix: string) => `${prefix}${escaped}`)
    .replace(tokenPattern(), () => `<a href="${escaped}">${escaped}</a>`);
}

export type BookingUrlParse = { ok: true; value: string | null } | { ok: false; error: string };

/** The CRM booking page setting: an http(s) URL, or empty for none. */
export function parseBookingUrl(value: unknown): BookingUrlParse {
  if (value === null || value === undefined) return { ok: true, value: null };
  if (typeof value !== "string") return { ok: false, error: "The booking link must be text" };
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, value: null };
  if (trimmed.length > BOOKING_URL_MAX_LENGTH) {
    return { ok: false, error: `The booking link must be at most ${BOOKING_URL_MAX_LENGTH} characters` };
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, error: "The booking link must be a full URL, like https://cal.com/acme/30min" };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, error: "The booking link must start with https:// or http://" };
  }
  return { ok: true, value: trimmed };
}
