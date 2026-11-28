import { describe, expect, test } from "bun:test";
import {
  newCcParticipants,
  parseReferralCreate,
  parseReferralStart,
  parseReferralUpdate,
  parseExtractionOutput,
  referralMergeFields,
  referralStillIdentified,
  shouldExtractReferrals,
  validateExtractedReferrals,
  isSuggestedReferralCampaign,
  type ReferralOwnIdentity,
  type ReferralValidationContext,
} from "./referralRules";

const own: ReferralOwnIdentity = {
  email: "priya@brand.in",
  phone: "+919876543210",
  linkedinSlug: "priya-shah",
  fullName: "Priya Shah",
  ourAddresses: ["sales@us.example.com"],
};

const context = (text: string, overrides: Partial<ReferralValidationContext> = {}): ReferralValidationContext => ({
  text,
  participants: [],
  own,
  phoneCountry: "IN",
  ...overrides,
});

describe("shouldExtractReferrals", () => {
  const base = { subcategoryKey: null, text: "Thanks, not now.", own, newCc: [] as string[] };
  test("a plain reply is not worth a model call", () => {
    expect(shouldExtractReferrals(base)).toBe(false);
  });
  test("the classifier's different-point-of-contact reading always is", () => {
    expect(shouldExtractReferrals({ ...base, subcategoryKey: "connected_to_different_poc" })).toBe(true);
  });
  test("another person's email, phone or LinkedIn profile is", () => {
    expect(shouldExtractReferrals({ ...base, text: "Write to arjun@toldyouso.in" })).toBe(true);
    expect(shouldExtractReferrals({ ...base, text: "Call my manager +91 95370 19872" })).toBe(true);
    expect(shouldExtractReferrals({ ...base, text: "See linkedin.com/in/arjun-k" })).toBe(true);
  });
  test("the sender's own and our own details are not", () => {
    expect(shouldExtractReferrals({ ...base, text: "priya@brand.in / +91 98765 43210 / linkedin.com/in/priya-shah" })).toBe(false);
    expect(shouldExtractReferrals({ ...base, text: "from the team at sales@us.example.com or hello@us.example.com" })).toBe(false);
  });
  test("someone newly copied in is, unless it is us or the sender", () => {
    expect(shouldExtractReferrals({ ...base, newCc: ["ravi@brand.in"] })).toBe(true);
    expect(shouldExtractReferrals({ ...base, newCc: ["priya@brand.in", "sales@us.example.com"] })).toBe(false);
  });
});

describe("newCcParticipants", () => {
  test("keeps only addresses no earlier message carried", () => {
    const earlier = [{ from: "sales@us.example.com", to: ["priya@brand.in"], cc: ["boss@brand.in"] }];
    expect(newCcParticipants({ cc: ["Boss@brand.in", "ravi@brand.in"] }, earlier)).toEqual(["ravi@brand.in"]);
    expect(newCcParticipants(undefined, earlier)).toEqual([]);
  });
});

describe("validateExtractedReferrals", () => {
  test("keeps an email that is written in the reply", () => {
    const [referral] = validateExtractedReferrals(
      [{ name: "Arjun", email: "Arjun@toldyouso.in", context: "speak to Arjun at arjun@toldyouso.in, he runs our ads" }],
      context("Please speak to Arjun at arjun@toldyouso.in, he runs our ads."),
    );
    expect(referral).toMatchObject({ name: "Arjun", email: "arjun@toldyouso.in", anonymous: false });
  });

  test("never believes an email the reply does not contain", () => {
    expect(validateExtractedReferrals([{ name: "Arjun", email: "arjun@toldyouso.in" }], context("Please speak to Arjun about it."))).toEqual([
      expect.objectContaining({ name: "Arjun", email: null }),
    ]);
    expect(validateExtractedReferrals([{ name: "Zed", email: "zed@x.com" }], context("Please speak to Arjun about it."))).toEqual([]);
  });

  test("believes an email that is only on the Cc", () => {
    const [referral] = validateExtractedReferrals([{ name: "Ravi", email: "ravi@brand.in" }], context("Copying Ravi, he handles this.", { participants: ["ravi@brand.in"] }));
    expect(referral.email).toBe("ravi@brand.in");
  });

  test("drops the sender's own and our details, whole entry", () => {
    expect(validateExtractedReferrals([{ name: "Priya", email: "priya@brand.in" }], context("Reach me at priya@brand.in"))).toEqual([]);
    expect(validateExtractedReferrals([{ name: "Us", email: "sales@us.example.com" }], context("Writing to sales@us.example.com"))).toEqual([]);
    expect(validateExtractedReferrals([{ name: "Colleague", email: "other@us.example.com" }], context("also other@us.example.com"))).toEqual([]);
    expect(validateExtractedReferrals([{ name: "Me", phone: "098765 43210" }], context("my number 098765 43210"))).toEqual([]);
    expect(validateExtractedReferrals([{ name: "Me", linkedinUrl: "https://www.linkedin.com/in/priya-shah/" }], context("see https://www.linkedin.com/in/priya-shah/"))).toEqual([]);
  });

  test("a phone must be written in the text; it is stored as E.164 when it can be", () => {
    const text = "Call my manager +91 95370 19872 tomorrow";
    const [referral] = validateExtractedReferrals([{ name: "Manager", phone: "9537019872" }], context(text));
    expect(referral.phone).toBe("+919537019872");
    // A number the reply never wrote is dropped; the name it did write keeps the entry.
    expect(validateExtractedReferrals([{ name: "Manager", phone: "9999900000" }], context(text))).toEqual([
      expect.objectContaining({ name: "Manager", phone: null }),
    ]);
  });

  test("a made-up phone leaves a name-only entry only when the name is in the text", () => {
    expect(validateExtractedReferrals([{ name: "Kiran", phone: "9999900000" }], context("Ask Kiran, call 95370 19872"))).toEqual([
      expect.objectContaining({ name: "Kiran", phone: null }),
    ]);
    expect(validateExtractedReferrals([{ name: "Kiran", phone: "9999900000" }], context("Ask someone else, call 95370 19872"))).toEqual([]);
  });

  test("a LinkedIn profile must be written in the text, and is normalized", () => {
    const [referral] = validateExtractedReferrals(
      [{ name: "Arjun K", linkedinUrl: "linkedin.com/in/Arjun-K" }],
      context("He is on https://in.linkedin.com/in/arjun-k?trk=x"),
    );
    expect(referral.linkedinUrl).toBe("https://www.linkedin.com/in/arjun-k");
    expect(validateExtractedReferrals([{ name: "Someone Else", linkedinUrl: "linkedin.com/in/nobody" }], context("no links here"))).toEqual([]);
  });

  test("a name alone must appear in the text and not be the sender's", () => {
    expect(validateExtractedReferrals([{ name: "@Ghaliah Alawi" }], context("@Ghaliah Alawi handles durex"))).toHaveLength(1);
    expect(validateExtractedReferrals([{ name: "Invented Person" }], context("Thanks"))).toEqual([]);
    expect(validateExtractedReferrals([{ name: "Priya Shah" }], context("This is Priya Shah"))).toEqual([]);
  });

  test("dedupes within a reply and carries anonymity and trimmed context", () => {
    const result = validateExtractedReferrals(
      [
        { name: "Arjun", email: "arjun@toldyouso.in", anonymous: true, context: "  speak to   Arjun " },
        { name: "Arjun K", email: "ARJUN@toldyouso.in" },
      ],
      context("speak to Arjun arjun@toldyouso.in, don't mention me"),
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ anonymous: true, context: "speak to Arjun" });
  });
});

describe("parseExtractionOutput", () => {
  test("reads the tool arguments and rejects a wrong shape", () => {
    expect(parseExtractionOutput(JSON.stringify({ referrals: [{ name: "A", email: null, anonymous: true }] }))).toEqual([
      expect.objectContaining({ name: "A", email: null, anonymous: true }),
    ]);
    expect(() => parseExtractionOutput("{}")).toThrow();
    expect(() => parseExtractionOutput("not json")).toThrow();
  });
});

describe("request parsing", () => {
  test("create needs one way to identify them and validates each field", () => {
    expect(parseReferralCreate({ name: " Arjun ", email: "A@B.IN", phone: null, linkedinUrl: null })).toMatchObject({ name: "Arjun", email: "a@b.in", anonymous: false });
    expect(() => parseReferralCreate({ name: null, email: null, phone: null, linkedinUrl: null })).toThrow();
    expect(() => parseReferralCreate({ email: "nope" })).toThrow();
    expect(() => parseReferralCreate({ name: "A", extra: 1 })).toThrow();
    expect(() => parseReferralCreate({ linkedinUrl: "https://example.com/x" })).toThrow();
    expect(parseReferralCreate({ linkedinUrl: "linkedin.com/in/Arj" }).linkedinUrl).toBe("https://www.linkedin.com/in/arj");
  });

  test("update takes any editable field, null clears, and an empty patch is refused", () => {
    expect(parseReferralUpdate({ phone: "+91 95370 19872", role: null, anonymous: true })).toEqual({ phone: "+91 95370 19872", role: null, anonymous: true });
    expect(() => parseReferralUpdate({})).toThrow();
    expect(() => parseReferralUpdate({ status: "started" })).toThrow();
    expect(() => parseReferralUpdate({ anonymous: "yes" })).toThrow();
  });

  test("an edit that clears the last identifier is caught against the stored row", () => {
    const row = { name: "Arjun", email: null, phone: null, linkedinUrl: null };
    expect(referralStillIdentified(row, { name: null })).toBe(false);
    expect(referralStillIdentified(row, { name: null, email: "a@b.in" })).toBe(true);
    expect(referralStillIdentified(row, { role: "CMO" })).toBe(true);
  });

  test("start needs a campaign for at least one known channel", () => {
    const id = "6f1c2d3e-4b5a-4c6d-8e9f-0a1b2c3d4e5f";
    expect(parseReferralStart({ channels: { email: id, linkedin: "cm0abc123def456" } })).toEqual({ email: id, linkedin: "cm0abc123def456" });
    expect(() => parseReferralStart({ channels: {} })).toThrow();
    expect(() => parseReferralStart({ channels: { fax: id } })).toThrow();
    expect(() => parseReferralStart({ channels: { email: "nope" } })).toThrow();
    expect(() => parseReferralStart({})).toThrow();
  });
});

describe("merge fields and suggestions", () => {
  const referrer = { referrerName: "Priya Shah", referrerFirstName: "Priya", referrerCompany: "Brand", referrerPersonId: "p1" };
  test("an anonymous referral never carries the referrer's name", () => {
    expect(referralMergeFields({ ...referrer, anonymous: false })).toEqual({ referredByPersonId: "p1", referrerName: "Priya Shah", referrerFirstName: "Priya", referrerCompany: "Brand", referrerBrand: "Brand" });
    expect(referralMergeFields({ ...referrer, anonymous: true })).toEqual({ referredByPersonId: "p1", referrerCompany: "Brand", referrerBrand: "Brand" });
    // The brand our outreach was about wins over the legal company name; blank falls back.
    expect(referralMergeFields({ ...referrer, referrerCompany: "RB", referrerBrand: "Durex", anonymous: false }).referrerBrand).toBe("Durex");
    expect(referralMergeFields({ ...referrer, referrerBrand: "  ", anonymous: false }).referrerBrand).toBe("Brand");
    expect(referralMergeFields({ ...referrer, referrerCompany: null, referrerBrand: null, anonymous: false })).not.toHaveProperty("referrerBrand");
  });
  test("a campaign named for referrals is suggested", () => {
    expect(isSuggestedReferralCampaign("Warm Referrals Q4")).toBe(true);
    expect(isSuggestedReferralCampaign("Beauty D2C")).toBe(false);
  });
});
