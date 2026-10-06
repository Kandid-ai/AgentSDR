"use client";

import SequenceComposer from "./SequenceComposer";
import type { SequenceStep } from "@/lib/outreach/schema";

export default function SequenceTab({
  campaignId,
  initialSequence,
}: {
  campaignId: string;
  initialSequence: SequenceStep[];
}) {
  return <SequenceComposer campaignId={campaignId} initialSequence={initialSequence} />;
}
