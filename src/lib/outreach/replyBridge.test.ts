import assert from "node:assert/strict";
import { test } from "node:test";
import { createStepLogger } from "@/lib/debugLog";
import { ingestGmailReply } from "./replyBridge";

test("Gmail warm-up mail is ignored before Master Inbox and CRM ingestion", async () => {
  let stored = false;
  const log = createStepLogger();
  const result = await ingestGmailReply("sender@example.com", {
    gmailMessageId: "warmup-message",
    threadId: "warmup-thread",
    fromEmail: "warmup@example.net",
    fromName: "Warmup Sender",
    toEmail: "sender@example.com",
    ccEmails: [],
    subject: "Re: checking in",
    bodyText: "A realistic-looking takes-backs warm-up message.",
    messageId: "<warmup-message@example.net>",
    inReplyTo: null,
    internalDate: new Date("2026-09-02T00:00:00.000Z"),
  }, log, {
    isKnownOutreachRecipient: async () => false,
    storeInMasterInbox: async () => {
      stored = true;
      throw new Error("Warm-up mail must never be stored");
    },
  });

  assert.deepEqual(result, { leadId: null, skipped: true });
  assert.equal(stored, false);
  assert.match(log.steps.map((step) => step.message).join("\n"), /warm-up identifier detected/);
});

test("unknown Gmail senders are stored in Master Inbox without creating CRM work", async () => {
  let storedMessageKey = "";
  const log = createStepLogger();
  const result = await ingestGmailReply("sender@example.com", {
    gmailMessageId: "first-contact-message",
    threadId: "first-contact-thread",
    fromEmail: "new.person@example.net",
    fromName: "New Person",
    toEmail: "sender@example.com",
    ccEmails: [],
    subject: "Introduction",
    bodyText: "Could we schedule a conversation?",
    messageId: "<first-contact-message@example.net>",
    inReplyTo: null,
    internalDate: new Date("2026-09-02T00:00:00.000Z"),
  }, log, {
    isKnownOutreachRecipient: async () => false,
    storeInMasterInbox: async (_mailbox, _message, _bodyText, durableMessageKey) => {
      storedMessageKey = durableMessageKey;
      return { leadId: "inbox-contact-1", created: true };
    },
  });

  assert.deepEqual(result, { leadId: "inbox-contact-1", skipped: false });
  assert.equal(storedMessageKey, "gmail:sender@example.com:first-contact-message");
  assert.match(log.steps.map((step) => step.message).join("\n"), /kept in Master Inbox without creating CRM work/);
});

test("a retried unknown Gmail message remains inbox-only and is reported as skipped", async () => {
  const result = await ingestGmailReply("sender@example.com", {
    gmailMessageId: "existing-first-contact",
    threadId: "existing-thread",
    fromEmail: "new.person@example.net",
    fromName: "New Person",
    toEmail: "sender@example.com",
    ccEmails: [],
    subject: "Following up",
    bodyText: "Did you see my earlier note?",
    messageId: "<existing-first-contact@example.net>",
    inReplyTo: null,
    internalDate: new Date("2026-09-02T00:00:00.000Z"),
  }, createStepLogger(), {
    isKnownOutreachRecipient: async () => false,
    storeInMasterInbox: async () => ({ leadId: "inbox-contact-1", created: false }),
  });

  assert.deepEqual(result, { leadId: "inbox-contact-1", skipped: true });
});

test("a postmaster delivery report suppresses the failed recipient instead of becoming a reply", async () => {
  let stored = false;
  const suppressed: string[] = [];
  const log = createStepLogger();
  const result = await ingestGmailReply("rep@sender-one.example.com", {
    gmailMessageId: "ndr-message",
    threadId: "ndr-thread",
    fromEmail: "postmaster@prospect-one.example.com",
    fromName: null,
    toEmail: "rep@sender-one.example.com",
    ccEmails: [],
    subject: "Undeliverable: Re: Quick question Sandeep?",
    bodyText: [
      "Your message to alex@prospect-one.example.com couldn't be delivered.",
      "alex wasn't found at prospect-one.example.com.",
      "Status code: 550 5.1.10",
    ].join("\n"),
    messageId: "<ndr@prospect-one.example.com>",
    inReplyTo: null,
    internalDate: new Date("2026-09-08T09:49:03.000Z"),
  }, log, {
    isKnownOutreachRecipient: async () => false,
    storeInMasterInbox: async () => {
      stored = true;
      throw new Error("A bounce must never become a Master Inbox contact");
    },
    suppress: async (email) => { suppressed.push(email); },
  });

  assert.deepEqual(result, { leadId: null, skipped: false });
  assert.equal(stored, false);
  assert.deepEqual(suppressed, ["alex@prospect-one.example.com"]);
});

test("an unreadable delivery report is kept in Master Inbox rather than dropped", async () => {
  let stored = false;
  const suppressed: string[] = [];
  const log = createStepLogger();
  await ingestGmailReply("rep@sender-one.example.com", {
    gmailMessageId: "opaque-ndr",
    threadId: null,
    fromEmail: "postmaster@example.com",
    fromName: null,
    toEmail: "rep@sender-one.example.com",
    ccEmails: [],
    subject: "Undeliverable: something",
    bodyText: "Delivery failed. No address anywhere in this report.",
    messageId: "<opaque@example.com>",
    inReplyTo: null,
    internalDate: new Date("2026-09-08T09:49:03.000Z"),
  }, log, {
    isKnownOutreachRecipient: async () => false,
    storeInMasterInbox: async () => {
      stored = true;
      return { leadId: "inbox-lead", created: true };
    },
    suppress: async (email) => { suppressed.push(email); },
  });

  assert.equal(stored, true);
  assert.deepEqual(suppressed, []);
});

test("a Gmail final-failure report suppresses the failed recipient", async () => {
  let stored = false;
  const suppressed: string[] = [];
  const log = createStepLogger();
  const result = await ingestGmailReply("rep@sender-two.example.com", {
    gmailMessageId: "gmail-failure",
    threadId: "gmail-failure-thread",
    fromEmail: "mailer-daemon@googlemail.com",
    fromName: "Mail Delivery Subsystem",
    toEmail: "rep@sender-two.example.com",
    ccEmails: [],
    subject: "Delivery Status Notification (Failure)",
    bodyText: [
      "** Message not delivered **",
      "There was a problem delivering your message to sam@prospect-two.example.org. See the technical details below.",
    ].join("\n"),
    messageId: "<gmail-failure@googlemail.com>",
    inReplyTo: null,
    internalDate: new Date("2026-09-16T07:21:36.000Z"),
  }, log, {
    isKnownOutreachRecipient: async () => false,
    storeInMasterInbox: async () => {
      stored = true;
      throw new Error("A bounce must never become a Master Inbox contact");
    },
    suppress: async (email) => { suppressed.push(email); },
  });

  assert.deepEqual(result, { leadId: null, skipped: false });
  assert.equal(stored, false);
  assert.deepEqual(suppressed, ["sam@prospect-two.example.org"]);
});

test("a Gmail delay notice is recognized but does not suppress yet", async () => {
  let stored = false;
  const suppressed: string[] = [];
  const log = createStepLogger();
  const result = await ingestGmailReply("rep@sender-two.example.com", {
    gmailMessageId: "gmail-delay",
    threadId: "gmail-delay-thread",
    fromEmail: "mailer-daemon@googlemail.com",
    fromName: "Mail Delivery Subsystem",
    toEmail: "rep@sender-two.example.com",
    ccEmails: [],
    subject: "Delivery Status Notification (Delay)",
    bodyText: [
      "** Delivery incomplete **",
      "There was a temporary problem delivering your message to j.doe@mail.example.net. Gmail will retry for 47 more hours.",
    ].join("\n"),
    messageId: "<gmail-delay@googlemail.com>",
    inReplyTo: null,
    internalDate: new Date("2026-09-16T10:18:28.000Z"),
  }, log, {
    isKnownOutreachRecipient: async () => false,
    storeInMasterInbox: async () => {
      stored = true;
      throw new Error("A delay notice must never become a Master Inbox contact");
    },
    suppress: async (email) => { suppressed.push(email); },
  });

  assert.deepEqual(result, { leadId: null, skipped: true });
  assert.equal(stored, false);
  assert.deepEqual(suppressed, []);
});

test("a Gmail policy-block report suppresses the failed recipient", async () => {
  const suppressed: string[] = [];
  const log = createStepLogger();
  await ingestGmailReply("rep@sender-two.example.com", {
    gmailMessageId: "gmail-blocked",
    threadId: "gmail-blocked-thread",
    fromEmail: "mailer-daemon@googlemail.com",
    fromName: "Mail Delivery Subsystem",
    toEmail: "rep@sender-two.example.com",
    ccEmails: [],
    subject: "Delivery Status Notification (Failure)",
    bodyText: [
      "** Message blocked **",
      "Your message to pat.lee@prospect-three.example.com has been blocked. See technical details below for more information.",
    ].join("\n"),
    messageId: "<gmail-blocked@googlemail.com>",
    inReplyTo: null,
    internalDate: new Date("2026-09-16T06:46:03.000Z"),
  }, log, {
    isKnownOutreachRecipient: async () => false,
    storeInMasterInbox: async () => { throw new Error("A bounce must never become a Master Inbox contact"); },
    suppress: async (email) => { suppressed.push(email); },
  });

  assert.deepEqual(suppressed, ["pat.lee@prospect-three.example.com"]);
});

test("a Gmail 'address(es) failed' list report suppresses the failed recipient", async () => {
  const suppressed: string[] = [];
  const log = createStepLogger();
  await ingestGmailReply("rep@sender-two.example.com", {
    gmailMessageId: "gmail-mailbox-full",
    threadId: "gmail-mailbox-full-thread",
    fromEmail: "mailer-daemon@googlemail.com",
    fromName: "Mail Delivery Subsystem",
    toEmail: "rep@sender-two.example.com",
    ccEmails: [],
    subject: "Delivery Status Notification (Failure)",
    bodyText: [
      "This message was created automatically by mail delivery software.",
      "",
      "A message that you sent could not be delivered to one or more of its",
      "recipients. This is a permanent error. The following address(es) failed:",
      "",
      "  casey.morgan@prospect-four.example.net",
      "    mailbox is full: retry timeout exceeded",
    ].join("\n"),
    messageId: "<gmail-mailbox-full@googlemail.com>",
    inReplyTo: null,
    internalDate: new Date("2026-09-16T00:00:00.000Z"),
  }, log, {
    isKnownOutreachRecipient: async () => false,
    storeInMasterInbox: async () => { throw new Error("A bounce must never become a Master Inbox contact"); },
    suppress: async (email) => { suppressed.push(email); },
  });

  assert.deepEqual(suppressed, ["casey.morgan@prospect-four.example.net"]);
});

test("a GoDaddy/secureserver.net 'failed permanently' report suppresses the failed recipient", async () => {
  const suppressed: string[] = [];
  const log = createStepLogger();
  await ingestGmailReply("rep@sender-three.example.com", {
    gmailMessageId: "secureserver-failure",
    threadId: "secureserver-failure-thread",
    fromEmail: "mailer-daemon@secureserver.net",
    fromName: null,
    toEmail: "rep@sender-three.example.com",
    ccEmails: [],
    subject: "Message Delivery Failure",
    bodyText: [
      "This is an automatically generated Delivery Status Notification.",
      "",
      "Delivery to the following recipients failed permanently:",
      "",
      "   * jordan.rivera@prospect-five.example.org",
      "",
      "Reason: There was an error while attempting to deliver your message...",
    ].join("\n"),
    messageId: "<secureserver-failure@secureserver.net>",
    inReplyTo: null,
    internalDate: new Date("2026-09-16T00:00:00.000Z"),
  }, log, {
    isKnownOutreachRecipient: async () => false,
    storeInMasterInbox: async () => { throw new Error("A bounce must never become a Master Inbox contact"); },
    suppress: async (email) => { suppressed.push(email); },
  });

  assert.deepEqual(suppressed, ["jordan.rivera@prospect-five.example.org"]);
});

test("a human writing about an undeliverable message is not treated as a bounce", async () => {
  const suppressed: string[] = [];
  let stored = false;
  const log = createStepLogger();
  await ingestGmailReply("rep@sender-one.example.com", {
    gmailMessageId: "human-message",
    threadId: null,
    fromEmail: "alex@example.com",
    fromName: "Sandeep",
    toEmail: "rep@sender-one.example.com",
    ccEmails: [],
    subject: "Undeliverable: your last note bounced for me",
    bodyText: "Your message to alex@example.com couldn't be delivered, try my other address.",
    messageId: "<human@example.com>",
    inReplyTo: null,
    internalDate: new Date("2026-09-08T09:49:03.000Z"),
  }, log, {
    isKnownOutreachRecipient: async () => false,
    storeInMasterInbox: async () => { stored = true; return { leadId: "inbox-lead", created: true }; },
    suppress: async (email) => { suppressed.push(email); },
  });

  assert.equal(stored, true);
  assert.deepEqual(suppressed, []);
});
