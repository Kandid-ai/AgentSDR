import { NextRequest, NextResponse } from "next/server";
import {
  getCampaign,
  updateCampaignName,
  updateCampaignSequence,
  setCampaignStatus,
  updateCampaignMailboxes,
  updateCampaignPriority,
  deleteCampaign,
  getCampaignStats,
} from "@/lib/outreach/campaigns";
import type { SequenceStep, CampaignStatus } from "@/lib/outreach/schema";
import { parseCampaignMailboxIds } from "@/lib/outreach/campaignMailboxes";
import { withOrgContext, authContextErrorResponse } from "@/lib/auth/context";
import { parseCampaignPriority, type CampaignPriority } from "@/lib/campaigns/priority";
import { requestSameDayQueueRefresh } from "@/lib/outreach/queueRefresh";

// GET /api/outreach/campaigns/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    return await withOrgContext(_req, async () => {
      const { id } = await params;
      const campaign = await getCampaign(id);
      if (!campaign) return NextResponse.json({ error: "not found" }, { status: 404 });
      const stats = await getCampaignStats(id);
      return NextResponse.json({ campaign, stats });
    });
  } catch (error) {
    const response = authContextErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

// PATCH /api/outreach/campaigns/[id]: { name?, sequence?, status?, mailboxIds?, priority? }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    return await withOrgContext(req, async () => {
      const { id } = await params;
      const campaign = await getCampaign(id);
      if (!campaign) return NextResponse.json({ error: "not found" }, { status: 404 });

      let body: { name?: string; sequence?: SequenceStep[]; status?: CampaignStatus; mailboxIds?: unknown; priority?: unknown };
      try {
        body = await req.json();
      } catch {
        return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
      }

      // Checked before anything is written, so a bad list changes nothing.
      let mailboxIds: string[] | null | undefined;
      if (body.mailboxIds !== undefined) {
        const parsed = parseCampaignMailboxIds(body.mailboxIds);
        if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
        mailboxIds = parsed.mailboxIds;
      }
      let priority: CampaignPriority | undefined;
      if (body.priority !== undefined) {
        const parsed = parseCampaignPriority(body.priority);
        if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
        priority = parsed.priority;
      }

      if (body.name !== undefined) {
        if (!body.name.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });
        await updateCampaignName(id, body.name);
      }
      if (body.sequence) await updateCampaignSequence(id, body.sequence);
      if (mailboxIds !== undefined && !(await updateCampaignMailboxes(id, mailboxIds))) {
        return NextResponse.json({ error: "One of those mailboxes is not connected to this organization" }, { status: 400 });
      }
      // A campaign whose chosen mailboxes were all removed would sit active
      // and send nothing; say so instead of launching it.
      const finalMailboxIds = mailboxIds !== undefined ? mailboxIds : campaign.mailboxIds;
      if (body.status === "active" && finalMailboxIds?.length === 0) {
        return NextResponse.json({ error: "Choose at least one mailbox for this campaign first" }, { status: 400 });
      }
      if (body.status) await setCampaignStatus(id, body.status);
      if (priority !== undefined) await updateCampaignPriority(id, priority);
      // Starting an Urgent/High campaign, or raising a running one to that,
      // starts its leads today instead of at the next morning's queue build.
      const started = body.status === "active" && campaign.status !== "active";
      if (started || (priority !== undefined && priority !== campaign.priority)) await requestSameDayQueueRefresh([id]);

      const updated = await getCampaign(id);
      return NextResponse.json({ campaign: updated });
    });
  } catch (error) {
    const response = authContextErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

// DELETE /api/outreach/campaigns/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    return await withOrgContext(_req, async () => {
      const { id } = await params;
      await deleteCampaign(id);
      return NextResponse.json({ ok: true });
    });
  } catch (error) {
    const response = authContextErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
