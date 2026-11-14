import { describe, expect, test } from "bun:test";
import { bookingLinkLabel, parseCalcomEventTypes } from "./bookingLinks";

describe("parseCalcomEventTypes", () => {
  test("keeps event types with a booking link, visible ones first", () => {
    const links = parseCalcomEventTypes({
      status: "success",
      data: [
        { id: 1, title: "Secret meeting", lengthInMinutes: 15, hidden: true, bookingUrl: "https://cal.com/acme/secret" },
        { id: 2, title: "Call with founder", lengthInMinutes: 30, hidden: false, bookingUrl: "https://cal.com/acme/30min" },
        { id: 3, title: "No link", lengthInMinutes: 30, hidden: false },
        { id: 4, title: "Odd link", hidden: false, bookingUrl: "javascript:alert(1)" },
      ],
    });
    expect(links).toEqual([
      { id: 2, title: "Call with founder", minutes: 30, url: "https://cal.com/acme/30min", hidden: false },
      { id: 1, title: "Secret meeting", minutes: 15, url: "https://cal.com/acme/secret", hidden: true },
    ]);
  });
  test("anything else is no links", () => {
    expect(parseCalcomEventTypes(null)).toEqual([]);
    expect(parseCalcomEventTypes({ data: "x" })).toEqual([]);
  });
});

describe("bookingLinkLabel", () => {
  test("title, length, path, and whether it is hidden", () => {
    expect(bookingLinkLabel({ id: 1, title: "Call", minutes: 30, url: "https://cal.com/acme/30min", hidden: false })).toBe("Call · 30 min · /acme/30min");
    expect(bookingLinkLabel({ id: 1, title: "Secret", minutes: null, url: "https://cal.com/acme/s", hidden: true })).toBe("Secret · /acme/s · hidden");
  });
});
