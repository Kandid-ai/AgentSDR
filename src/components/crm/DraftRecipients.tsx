"use client";

import * as Badge from "@/components/alignui/badge";
import { draftRecipientView } from "@/lib/crm/draftRecipients";

/**
 * The To and Cc an email draft goes out with, above its subject, so whoever
 * approves it sees who receives it — above all when the thread handed us to a
 * new point of contact and the draft goes to them with the Person copied.
 *
 * Given `subject` (the field itself), it becomes the last row of the same
 * box, the way a mail client's header reads, instead of a labelled field of
 * its own below — one compact block where height is short.
 */
export function DraftRecipients({ draft, personEmail, subject }: {
  draft: { toEmail?: unknown; ccEmails?: unknown };
  personEmail: string | null;
  subject?: React.ReactNode;
}) {
  const view = draftRecipientView({
    toEmail: typeof draft.toEmail === "string" ? draft.toEmail : null,
    ccEmails: Array.isArray(draft.ccEmails) ? draft.ccEmails.filter((item): item is string => typeof item === "string") : null,
  }, personEmail);
  const wide = subject != null;
  const missing = <p className="text-paragraph-xs text-error-base">This person has no email address, so the reply cannot be sent by email.</p>;
  if (!view.to && !wide) return missing;
  if (!view.to) {
    return <div className="space-y-2">{missing}<Box><Row label="Subject" wide>{subject}</Row></Box></div>;
  }
  return (
    <Box>
      <Row label="To" wide={wide}>
        <span className="truncate text-text-strong-950" title={view.to}>{view.to}</span>
        {view.redirected && <Badge.Root variant="lighter" size="small" color="blue" className="shrink-0">New contact</Badge.Root>}
      </Row>
      {view.cc.length > 0 && (
        <Row label="Cc" wide={wide}>
          <span className="truncate text-text-sub-600" title={view.cc.join(", ")}>{view.cc.join(", ")}</span>
        </Row>
      )}
      {view.redirected && (
        <p className="text-paragraph-xs text-text-soft-400">
          The thread handed us to a new contact, so this goes to them with {personEmail} copied. To send it to {personEmail} instead, regenerate and say so.
        </p>
      )}
      {wide && <div className="-mx-3 border-t border-stroke-soft-200 px-3 pt-1"><Row label="Subject" wide>{subject}</Row></div>}
    </Box>
  );
}

function Box({ children }: { children: React.ReactNode }) {
  return <div className="space-y-1 rounded-lg bg-bg-weak-50 px-3 py-2 ring-1 ring-inset ring-stroke-soft-200 focus-within:ring-stroke-sub-300">{children}</div>;
}

function Row({ label, wide = false, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-2 text-paragraph-sm">
      <span className={`${wide ? "w-12" : "w-6"} shrink-0 text-label-xs text-text-soft-400`}>{label}</span>
      {children}
    </div>
  );
}
