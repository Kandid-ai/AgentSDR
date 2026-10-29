import { describe, expect, test } from "bun:test";
import { CrmConfigurationValidationError } from "@/lib/crm/categories";
import { MAX_RTC_SDP_CHARS } from "./contract";
import { assertRtcAnswerAllowed, parseRemoteRep, parseRtcAnswerRequest, parseSdp } from "./remoteRep";
import { CallApiError, rtcAnswerFor } from "./sessions";

const SDP = "v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n";

function expectApiError(fn: () => unknown, status: number) {
  try {
    fn();
    throw new Error("expected fn() to throw");
  } catch (error) {
    expect(error).toBeInstanceOf(CallApiError);
    expect((error as CallApiError).status).toBe(status);
  }
}

describe("parseSdp", () => {
  test("accepts a session description as given", () => {
    expect(parseSdp(SDP, "offer")).toBe(SDP);
  });

  test("refuses non-strings, blanks, non-SDP and oversized text", () => {
    expectApiError(() => parseSdp(42, "offer"), 400);
    expectApiError(() => parseSdp("   ", "offer"), 400);
    expectApiError(() => parseSdp("hello", "offer"), 400);
    expectApiError(() => parseSdp(`v=0\r\n${"a".repeat(MAX_RTC_SDP_CHARS)}`, "offer"), 400);
  });
});

describe("parseRemoteRep", () => {
  test("null or absent is not a rep call", () => {
    expect(parseRemoteRep(null)).toBeNull();
    expect(parseRemoteRep(undefined)).toBeNull();
  });

  test("keeps only the offer, and refuses other fields", () => {
    expect(parseRemoteRep({ offer: SDP })).toEqual({ offer: SDP });
    expect(() => parseRemoteRep({ offer: SDP, answer: SDP })).toThrow(CrmConfigurationValidationError);
    expect(() => parseRemoteRep("v=0")).toThrow(CrmConfigurationValidationError);
    expectApiError(() => parseRemoteRep({ offer: "" }), 400);
  });
});

describe("parseRtcAnswerRequest", () => {
  test("returns the answer", () => {
    expect(parseRtcAnswerRequest({ answer: SDP })).toBe(SDP);
  });

  test("refuses a missing answer or extra fields", () => {
    expectApiError(() => parseRtcAnswerRequest({}), 400);
    expect(() => parseRtcAnswerRequest({ answer: SDP, offer: SDP })).toThrow(CrmConfigurationValidationError);
  });
});

describe("assertRtcAnswerAllowed", () => {
  test("stores the first answer to an open rep call", () => {
    expect(assertRtcAnswerAllowed({ remoteRep: { offer: SDP, answer: null }, status: "pending" }, SDP)).toBe("store");
    expect(assertRtcAnswerAllowed({ remoteRep: { offer: SDP, answer: null }, status: "in_progress" }, SDP)).toBe("store");
  });

  test("a repeat of the same answer is a no-op; a different one is refused", () => {
    expect(assertRtcAnswerAllowed({ remoteRep: { offer: SDP, answer: SDP }, status: "pending" }, SDP)).toBe("repeat");
    expectApiError(() => assertRtcAnswerAllowed({ remoteRep: { offer: SDP, answer: SDP }, status: "pending" }, `${SDP}a=x\r\n`), 409);
  });

  test("refuses a call nobody talks on from AgentSDR, or one that is over", () => {
    expectApiError(() => assertRtcAnswerAllowed({ remoteRep: null, status: "pending" }, SDP), 409);
    expectApiError(() => assertRtcAnswerAllowed({ remoteRep: { offer: SDP, answer: null }, status: "failed" }, SDP), 409);
  });
});

describe("rtcAnswerFor", () => {
  test("only an open rep call's answer is read back", () => {
    expect(rtcAnswerFor({ remoteRep: { offer: SDP, answer: SDP }, status: "pending" })).toBe(SDP);
    expect(rtcAnswerFor({ remoteRep: { offer: SDP, answer: null }, status: "pending" })).toBeNull();
    expect(rtcAnswerFor({ remoteRep: { offer: SDP, answer: SDP }, status: "recorded" })).toBeNull();
    expect(rtcAnswerFor({ remoteRep: null, status: "in_progress" })).toBeNull();
  });
});
