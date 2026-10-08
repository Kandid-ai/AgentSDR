import { describe, expect, test } from "bun:test";
import { slugify } from "./slug";
import { validateSetupInput } from "./setupInput";

const good = { name: " Ada ", organizationName: " Acme Inc ", email: " Ada@Example.COM ", password: "longenough" };

describe("validateSetupInput", () => {
  test("trims and lowercases", () => {
    expect(validateSetupInput(good)).toEqual({
      ok: true,
      value: { name: "Ada", organizationName: "Acme Inc", email: "ada@example.com", password: "longenough" },
    });
  });
  test("rejects bad fields", () => {
    expect(validateSetupInput({ ...good, name: "  " }).ok).toBe(false);
    expect(validateSetupInput({ ...good, organizationName: "" }).ok).toBe(false);
    expect(validateSetupInput({ ...good, email: "nope" }).ok).toBe(false);
    expect(validateSetupInput({ ...good, password: "short" }).ok).toBe(false);
    expect(validateSetupInput({ ...good, password: "x".repeat(129) }).ok).toBe(false);
    expect(validateSetupInput(null).ok).toBe(false);
    expect(validateSetupInput({ ...good, email: 5 }).ok).toBe(false);
  });
});

describe("slugify", () => {
  test("makes a URL name", () => {
    expect(slugify("Acme, Inc. Ünited")).toBe("acme-inc-united");
  });
});
