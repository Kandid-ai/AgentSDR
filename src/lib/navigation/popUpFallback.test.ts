import { describe, expect, test } from "bun:test";
import { isPopUpPath, popUpFallbackSource, type PageLoad } from "./popUpFallback";

const origin = "https://app.agentsdr.ai";
const fellBack: PageLoad = {
  origin,
  pathname: "/crm/records/7fc3a0f0-84a7-4616-9759-dc380d23c867",
  referrer: `${origin}/crm/actions?group=reply`,
  navigationType: "navigate",
  historyLength: 4,
};

describe("isPopUpPath", () => {
  test("records and settings pages have pop-ups", () => {
    expect(isPopUpPath("/crm/records/abc")).toBe(true);
    expect(isPopUpPath("/settings/members")).toBe(true);
  });
  test("lists and the settings index do not", () => {
    expect(isPopUpPath("/crm/actions")).toBe(false);
    expect(isPopUpPath("/settings")).toBe(false);
    expect(isPopUpPath("/crm/records/abc/edit")).toBe(false);
  });
});

describe("popUpFallbackSource", () => {
  test("a click from a list that fell back: put the list back, query kept", () => {
    expect(popUpFallbackSource(fellBack)).toBe("/crm/actions?group=reply");
  });
  test("settings from any app page", () => {
    expect(popUpFallbackSource({ ...fellBack, pathname: "/settings/ai", referrer: `${origin}/crm/pipeline` })).toBe("/crm/pipeline");
  });
  test("a new tab (ctrl/cmd-click) stays a full page", () => {
    expect(popUpFallbackSource({ ...fellBack, historyLength: 1 })).toBeNull();
  });
  test("a reload or back/forward stays a full page", () => {
    expect(popUpFallbackSource({ ...fellBack, navigationType: "reload" })).toBeNull();
    expect(popUpFallbackSource({ ...fellBack, navigationType: "back_forward" })).toBeNull();
  });
  test("a shared link or bookmark stays a full page", () => {
    expect(popUpFallbackSource({ ...fellBack, referrer: "" })).toBeNull();
    expect(popUpFallbackSource({ ...fellBack, referrer: "https://mail.google.com/" })).toBeNull();
  });
  test("Open full page, followed from the pop-up's own URL, stays a full page", () => {
    expect(popUpFallbackSource({ ...fellBack, referrer: `${origin}${fellBack.pathname}` })).toBeNull();
    expect(popUpFallbackSource({ ...fellBack, referrer: `${origin}/crm/records/another` })).toBeNull();
    expect(popUpFallbackSource({ ...fellBack, pathname: "/settings/ai", referrer: `${origin}/settings/members` })).toBeNull();
  });
  test("never over sign-in or other pages outside the app", () => {
    expect(popUpFallbackSource({ ...fellBack, referrer: `${origin}/sign-in?from=%2Fcrm%2Factions` })).toBeNull();
    expect(popUpFallbackSource({ ...fellBack, referrer: `${origin}/oauth/organization` })).toBeNull();
  });
  test("pages without a pop-up are left alone", () => {
    expect(popUpFallbackSource({ ...fellBack, pathname: "/crm/pipeline" })).toBeNull();
  });
});
