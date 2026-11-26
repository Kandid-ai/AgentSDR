import { describe, expect, test } from "bun:test";
import { barTone, callTabTitle, glowState, isPickupTransition, leadLine, pickupNotification, PICKUP_FLASH_MS, PICKUP_PULSE_MS } from "./pickupAlert";

describe("isPickupTransition", () => {
  test("fires only when the call arrives at on-call", () => {
    expect(isPickupTransition("ringing", "on-call")).toBe(true);
    expect(isPickupTransition("dialing", "on-call")).toBe(true);
    expect(isPickupTransition(null, "on-call")).toBe(true);
    expect(isPickupTransition("on-call", "on-call")).toBe(false);
    expect(isPickupTransition("on-call", "ended")).toBe(false);
    expect(isPickupTransition("ringing", "ended")).toBe(false);
  });
});

describe("callTabTitle", () => {
  test("names the lead while ringing and on the call, else leaves the title", () => {
    expect(callTabTitle("on-call", "Vivaan")).toBe("● Picked up — Vivaan");
    expect(callTabTitle("ringing", "Vivaan")).toBe("Ringing… Vivaan");
    expect(callTabTitle("dialing", "Vivaan")).toBeNull();
    expect(callTabTitle("ended", "Vivaan")).toBeNull();
    expect(callTabTitle(null, "Vivaan")).toBeNull();
  });
});

describe("glowState", () => {
  test("flash, pulse, then steady, only while on call", () => {
    expect(glowState("on-call", 0, false)).toBe("flash");
    expect(glowState("on-call", PICKUP_FLASH_MS, false)).toBe("pulse");
    expect(glowState("on-call", PICKUP_FLASH_MS + PICKUP_PULSE_MS, false)).toBe("steady");
    expect(glowState("ringing", 0, false)).toBe("none");
    expect(glowState("ended", 10, false)).toBe("none");
    expect(glowState(null, 10, false)).toBe("none");
  });
  test("reduced motion is steady from the start", () => {
    expect(glowState("on-call", 0, true)).toBe("steady");
    expect(glowState("on-call", 2000, true)).toBe("steady");
    expect(glowState("ended", 0, true)).toBe("none");
  });
});

describe("pickupNotification", () => {
  const call = { leadName: "Vivaan Joshi", leadCompany: "Kesar Labs" };
  test("only for a hidden tab with permission", () => {
    expect(pickupNotification(call, true, "granted")).toEqual({ title: "Vivaan Joshi picked up", body: "Kesar Labs" });
    expect(pickupNotification(call, false, "granted")).toBeNull();
    expect(pickupNotification(call, true, "default")).toBeNull();
    expect(pickupNotification(call, true, "denied")).toBeNull();
    expect(pickupNotification(call, true, "unsupported")).toBeNull();
  });
  test("falls back when no company", () => {
    expect(pickupNotification({ leadName: "A", leadCompany: null }, true, "granted")?.body).toBeTruthy();
  });
});

describe("barTone and leadLine", () => {
  test("tone", () => {
    expect(barTone("on-call")).toBe("live");
    expect(barTone("ended")).toBe("over");
    expect(barTone("error")).toBe("over");
    expect(barTone("ringing")).toBe("normal");
  });
  test("lead line", () => {
    expect(leadLine("Vivaan Joshi", "Kesar Labs")).toBe("Vivaan Joshi · Kesar Labs");
    expect(leadLine("Vivaan Joshi", null)).toBe("Vivaan Joshi");
    expect(leadLine("Vivaan Joshi", "  ")).toBe("Vivaan Joshi");
  });
});
