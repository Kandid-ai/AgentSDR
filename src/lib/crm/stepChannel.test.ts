import { describe, expect, test } from "bun:test";
import { decideStepChannel, otherChannelOf, type StepChannelFacts } from "./stepChannel";

function facts(overrides: Partial<StepChannelFacts> = {}): StepChannelFacts {
  return {
    runChannel: "linkedin",
    doNotContact: false,
    email: {
      address: "Lead@Example.com",
      suppressed: false,
      doNotContact: false,
      conversations: [],
      lastOutreach: { mailbox: "rep@ours.com", connected: true, threadId: "gmail-thread-1" },
    },
    linkedin: {
      conversations: [],
      chat: { accountRef: "li-account", chatId: "chat-1", providerId: "ACo123", accountConnected: true },
    },
    ...overrides,
  };
}

const email = (patch: Partial<StepChannelFacts["email"]>) => ({ ...facts().email, ...patch });
const linkedin = (patch: Partial<StepChannelFacts["linkedin"]>) => ({ ...facts().linkedin, ...patch });

describe("otherChannelOf", () => {
  test("pairs email with LinkedIn; WhatsApp has none", () => {
    expect(otherChannelOf("email")).toBe("linkedin");
    expect(otherChannelOf("linkedin")).toBe("email");
    expect(otherChannelOf("whatsapp")).toBeNull();
  });
});

describe("decideStepChannel", () => {
  test("a 'same' step stays on the run's conversation without a reason", () => {
    expect(decideStepChannel("same", facts())).toEqual({ use: "same", reason: null });
  });

  test("WhatsApp and Do Not Contact fall back", () => {
    expect(decideStepChannel("other", facts({ runChannel: "whatsapp" }))).toEqual({ use: "same", reason: "no_other_channel" });
    expect(decideStepChannel("other", facts({ doNotContact: true }))).toEqual({ use: "same", reason: "do_not_contact" });
  });

  describe("LinkedIn run → email", () => {
    test("opens a conversation from the mailbox that last emailed them, on that thread, to their own address", () => {
      expect(decideStepChannel("other", facts())).toEqual({
        use: "create",
        channel: "email",
        accountRef: "rep@ours.com",
        providerThreadId: "gmail-thread-1",
        providerContactId: "lead@example.com",
      });
    });

    test("prefers an existing email conversation whose mailbox is still connected", () => {
      const decision = decideStepChannel("other", facts({
        email: email({
          conversations: [
            { id: "conv-old-mailbox", accountRef: "gone@ours.com", providerThreadId: "t0", accountConnected: false },
            { id: "conv-live", accountRef: "rep@ours.com", providerThreadId: "t1", accountConnected: true },
          ],
        }),
      }));
      expect(decision).toEqual({ use: "existing", channel: "email", conversationId: "conv-live" });
    });

    test("never emails a missing, suppressed or Do Not Contact address", () => {
      expect(decideStepChannel("other", facts({ email: email({ address: null }) }))).toEqual({ use: "same", reason: "no_email_address" });
      expect(decideStepChannel("other", facts({ email: email({ address: "  " }) }))).toEqual({ use: "same", reason: "no_email_address" });
      expect(decideStepChannel("other", facts({ email: email({ suppressed: true }) }))).toEqual({ use: "same", reason: "email_suppressed" });
      expect(decideStepChannel("other", facts({ email: email({ doNotContact: true }) }))).toEqual({ use: "same", reason: "email_do_not_contact" });
      // Even with a usable conversation already open.
      expect(decideStepChannel("other", facts({
        email: email({ suppressed: true, conversations: [{ id: "c", accountRef: "rep@ours.com", providerThreadId: null, accountConnected: true }] }),
      }))).toEqual({ use: "same", reason: "email_suppressed" });
    });

    test("needs a mailbox that emailed them and is still connected", () => {
      expect(decideStepChannel("other", facts({ email: email({ lastOutreach: null }) }))).toEqual({ use: "same", reason: "no_mailbox_emailed_them" });
      expect(decideStepChannel("other", facts({
        email: email({ lastOutreach: { mailbox: "rep@ours.com", connected: false, threadId: null } }),
      }))).toEqual({ use: "same", reason: "mailbox_not_connected" });
      expect(decideStepChannel("other", facts({
        email: email({ lastOutreach: null, conversations: [{ id: "c", accountRef: "gone@ours.com", providerThreadId: "t", accountConnected: false }] }),
      }))).toEqual({ use: "same", reason: "mailbox_not_connected" });
    });

    test("a mailbox email with no thread starts a new one", () => {
      const decision = decideStepChannel("other", facts({
        email: email({ lastOutreach: { mailbox: "rep@ours.com", connected: true, threadId: null } }),
      }));
      expect(decision).toMatchObject({ use: "create", channel: "email", providerThreadId: null });
    });
  });

  describe("email run → LinkedIn", () => {
    const run = { runChannel: "email" as const };

    test("opens a conversation on their outreach chat", () => {
      expect(decideStepChannel("other", facts(run))).toEqual({
        use: "create",
        channel: "linkedin",
        accountRef: "li-account",
        providerThreadId: "chat-1",
        providerContactId: "ACo123",
      });
    });

    test("prefers an existing LinkedIn conversation that has a chat on a connected account", () => {
      const decision = decideStepChannel("other", facts({
        ...run,
        linkedin: linkedin({
          conversations: [
            { id: "no-chat", accountRef: "li-account", providerThreadId: null, accountConnected: true },
            { id: "with-chat", accountRef: "li-account", providerThreadId: "chat-9", accountConnected: true },
          ],
        }),
      }));
      expect(decision).toEqual({ use: "existing", channel: "linkedin", conversationId: "with-chat" });
    });

    test("not connected, or no chat, means no other channel", () => {
      expect(decideStepChannel("other", facts({ ...run, linkedin: linkedin({ chat: null }) })))
        .toEqual({ use: "same", reason: "no_linkedin_chat" });
      expect(decideStepChannel("other", facts({
        ...run,
        linkedin: linkedin({ chat: { accountRef: "li-account", chatId: "chat-1", providerId: "ACo123", accountConnected: false } }),
      }))).toEqual({ use: "same", reason: "linkedin_account_not_connected" });
      expect(decideStepChannel("other", facts({
        ...run,
        linkedin: linkedin({ chat: null, conversations: [{ id: "c", accountRef: "li-old", providerThreadId: "chat-2", accountConnected: false }] }),
      }))).toEqual({ use: "same", reason: "linkedin_account_not_connected" });
    });

    test("ignores the email facts", () => {
      const decision = decideStepChannel("other", facts({ ...run, email: email({ address: null, suppressed: true }) }));
      expect(decision).toMatchObject({ use: "create", channel: "linkedin" });
    });
  });
});
