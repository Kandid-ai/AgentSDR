import { describe, expect, test } from "bun:test";
import {
  hasBookingLinkToken,
  parseBookingUrl,
  replaceBookingLinkToken,
  replaceBookingLinkTokenInHtml,
} from "./bookingLinkToken";

const LINK = "https://cal.com/acme/30min?metadata[c]=k7p2q";

describe("{{booking_link}}", () => {
  test("is found in any case and with spaces inside the braces", () => {
    expect(hasBookingLinkToken("Book here: {{booking_link}}")).toBe(true);
    expect(hasBookingLinkToken("Book here: {{ Booking_Link }}")).toBe(true);
    expect(hasBookingLinkToken(null, undefined, "{{BOOKING_LINK}}")).toBe(true);
    expect(hasBookingLinkToken("{{bookingLink}} {booking_link} {{ booking link }}")).toBe(false);
    expect(hasBookingLinkToken(null, "")).toBe(false);
  });

  test("every occurrence in a text body becomes the link", () => {
    expect(replaceBookingLinkToken("Pick a time: {{booking_link}}\nOr here {{ booking_link }}.", LINK)).toBe(
      `Pick a time: ${LINK}\nOr here ${LINK}.`,
    );
    // `$` in a link is not a replacement pattern.
    expect(replaceBookingLinkToken("{{booking_link}}", "https://x.test/$1&$&")).toBe("https://x.test/$1&$&");
    expect(replaceBookingLinkToken("No token here.", LINK)).toBe("No token here.");
  });

  test("in HTML the token becomes a link, or the URL inside an attribute", () => {
    expect(replaceBookingLinkTokenInHtml("<p>Book: {{booking_link}}</p>", "https://cal.com/a?x=1&metadata[c]=abcde")).toBe(
      '<p>Book: <a href="https://cal.com/a?x=1&amp;metadata[c]=abcde">https://cal.com/a?x=1&amp;metadata[c]=abcde</a></p>',
    );
    expect(replaceBookingLinkTokenInHtml('<a href="{{booking_link}}">Pick a time</a>', LINK)).toBe(`<a href="${LINK}">Pick a time</a>`);
    expect(replaceBookingLinkTokenInHtml("<a href='{{ booking_link }}'>x</a> or {{booking_link}}", LINK)).toBe(
      `<a href='${LINK}'>x</a> or <a href="${LINK}">${LINK}</a>`,
    );
  });
});

describe("parseBookingUrl", () => {
  test("an http(s) URL, trimmed; empty is none", () => {
    expect(parseBookingUrl(" https://cal.com/acme/30min ")).toEqual({ ok: true, value: "https://cal.com/acme/30min" });
    expect(parseBookingUrl("")).toEqual({ ok: true, value: null });
    expect(parseBookingUrl(null)).toEqual({ ok: true, value: null });
  });

  test("anything else is refused with a reason", () => {
    expect(parseBookingUrl("cal.com/acme").ok).toBe(false);
    expect(parseBookingUrl("javascript:alert(1)").ok).toBe(false);
    expect(parseBookingUrl(42).ok).toBe(false);
    expect(parseBookingUrl(`https://cal.com/${"a".repeat(600)}`).ok).toBe(false);
  });
});
