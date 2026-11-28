"use client";

/**
 * The campaign priority control and badge, shared by email, LinkedIn and
 * WhatsApp campaigns (src/lib/campaigns/priority.ts holds the rules).
 */
import * as Badge from "@/components/alignui/badge";
import * as Select from "@/components/alignui/select";
import {
  CAMPAIGN_PRIORITIES,
  CAMPAIGN_PRIORITY_HINTS,
  CAMPAIGN_PRIORITY_LABELS,
  campaignPriorityOf,
  type CampaignPriority,
} from "@/lib/campaigns/priority";

const PRIORITY_COLOR: Record<CampaignPriority, React.ComponentProps<typeof Badge.Root>["color"]> = {
  urgent: "red",
  high: "orange",
  medium: "gray",
  low: "gray",
};

/** A small badge for lists and headers. Medium is the default, so it shows nothing unless `showMedium`. */
export function CampaignPriorityBadge({ priority, showMedium = false, className }: { priority: unknown; showMedium?: boolean; className?: string }) {
  const value = campaignPriorityOf(priority);
  if (value === "medium" && !showMedium) return null;
  return (
    <Badge.Root size="small" variant="lighter" color={PRIORITY_COLOR[value]} className={className} title={CAMPAIGN_PRIORITY_HINTS[value]}>
      {`${CAMPAIGN_PRIORITY_LABELS[value]} priority`}
    </Badge.Root>
  );
}

/** Labelled select with the chosen priority's one-line explanation under it. */
export function CampaignPrioritySelect({
  value,
  onChange,
  disabled,
  id = "campaign-priority",
  size = "medium",
  hideLabel = false,
  hideHint = false,
}: {
  value: CampaignPriority;
  onChange: (priority: CampaignPriority) => void;
  disabled?: boolean;
  id?: string;
  size?: "medium" | "small" | "xsmall";
  hideLabel?: boolean;
  hideHint?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      {!hideLabel && (
        <label htmlFor={id} className="text-label-sm text-text-strong-950">
          Priority
        </label>
      )}
      <Select.Root size={size} value={value} onValueChange={(next) => onChange(campaignPriorityOf(next))} disabled={disabled}>
        <Select.Trigger id={id} aria-label="Priority">
          <Select.Value />
        </Select.Trigger>
        <Select.Content>
          {CAMPAIGN_PRIORITIES.map((priority) => (
            <Select.Item key={priority} value={priority}>
              {hideLabel ? `${CAMPAIGN_PRIORITY_LABELS[priority]} priority` : CAMPAIGN_PRIORITY_LABELS[priority]}
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Root>
      {!hideHint && <p className="text-paragraph-xs text-text-sub-600">{CAMPAIGN_PRIORITY_HINTS[value]}</p>}
    </div>
  );
}
