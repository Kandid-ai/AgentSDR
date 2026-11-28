/**
 * A LinkedIn campaign request's optional `priority` (create and edit,
 * src/app/api/linkedin/campaigns). Absent means "leave it": the database
 * default on create, the stored value on edit. Anything present must be a
 * valid priority (src/lib/campaigns/priority.ts), else the route answers 400
 * with `error`. Client-safe and pure.
 */
import { parseCampaignPriority, type CampaignPriority } from "@/lib/campaigns/priority";

export type OptionalCampaignPriority =
  | { ok: true; priority: CampaignPriority | undefined }
  | { ok: false; error: string };

export function readOptionalCampaignPriority(value: unknown): OptionalCampaignPriority {
  if (value === undefined) return { ok: true, priority: undefined };
  const parsed = parseCampaignPriority(value);
  return parsed.ok ? { ok: true, priority: parsed.priority } : parsed;
}
