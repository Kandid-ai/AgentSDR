import { describe, expect, test } from "bun:test";
import { composeAgentBrief } from "./brief";

describe("composeAgentBrief", () => {
  test("campaign instructions, then this call, then the lead's own instructions", () => {
    const brief = composeAgentBrief({
      campaignInstructions: "We sell storefronts.",
      purpose: "reach",
      stepInstructions: "Second try.",
      leadInstructions: "Met at the Mumbai meetup.",
    });
    expect(brief).toBe("We sell storefronts.\n\nThis call: Second try.\n\nFor this person in particular: Met at the Mumbai meetup.");
  });
  test("no lead instructions, no extra section", () => {
    expect(composeAgentBrief({ campaignInstructions: "X", purpose: "reach", stepInstructions: "Y", leadInstructions: "  " })).toBe("X\n\nThis call: Y");
  });
});
