"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  RiAddLine,
  RiDeleteBinLine,
  RiFilterOffLine,
  RiMoreLine,
  RiPauseCircleLine,
  RiPencilLine,
  RiPercentLine,
  RiPhoneLine,
  RiPlayCircleLine,
  RiSearchLine,
  RiStarLine,
  RiTeamLine,
  RiUserReceivedLine,
} from "@remixicon/react";
import * as Button from "@/components/alignui/button";
import * as Dropdown from "@/components/alignui/dropdown";
import * as Input from "@/components/alignui/input";
import * as Modal from "@/components/alignui/modal";
import * as SegmentedControl from "@/components/alignui/segmented-control";
import * as Table from "@/components/alignui/table";
import { ErrorState } from "@/components/analytics/kit/ErrorState";
import { Frame, FrameHeader, FramePanel } from "@/components/analytics/kit/Frame";
import { KpiCell, KpiStrip } from "@/components/analytics/kit/KpiStrip";
import { CHANNEL_META, formatCompact, formatPercent } from "@/components/analytics/theme";
import { EmptyState } from "@/components/page/EmptyState";
import { PageHeader } from "@/components/page/PageHeader";
import { KpiStripSkeleton, Skeleton } from "@/components/page/Skeletons";
import { errorMessage } from "@/components/crm/crm-utils";
import { EditCampaignModal, DeleteCampaignModal } from "@/components/calling/CampaignModals";
import { CampaignStatusBadge } from "@/components/calling/callingShared";
import { FormError, TextField } from "@/components/calls/fields";
import { useRefreshOnReturn } from "@/components/calling/useRefreshOnReturn";
import CampaignProgressRing from "@/components/outreach/CampaignProgressRing";
import { createCampaign, listCampaigns, updateCampaign } from "@/lib/calls/client";
import type { CampaignSummary } from "@/lib/calls/contract";
import { cn } from "@/utils/cn";

type StatusFilter = "all" | "active" | "paused";

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
];

const WA = CHANNEL_META.whatsapp.color;
const num = "text-paragraph-sm tabular-nums text-text-strong-950";

const HINTS = {
  reached: "Contacts called at least once. Counts people, not calls.",
  connectRate: "Of the contacts called, the share who picked up at least once.",
  interested: "Contacts who picked up and whose CRM stage is now Interested or Customer.",
};

const ratio = (part: number, whole: number) => (whole > 0 ? part / whole : null);

function createdOn(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * A share of a whole, as a table cell: the percentage and a slim bar in the
 * WhatsApp colour on an absolute 0–100% scale (these are progress through a
 * list, not rankings), with the counts it comes from underneath.
 */
function ShareCell({ part, whole, of }: { part: number; whole: number; of: string }) {
  const share = ratio(part, whole);
  return (
    <div title={whole > 0 ? `${part.toLocaleString("en-US")} of ${whole.toLocaleString("en-US")} ${of}` : `No ${of} yet`}>
      <div className="flex items-center gap-2.5">
        <span className={cn("w-10", num)}>{formatPercent(share)}</span>
        <span aria-hidden="true" className="h-1.5 w-16 rounded-full bg-bg-weak-50">
          <span className="block h-full rounded-full" style={{ width: `${(share ?? 0) * 100}%`, backgroundColor: WA }} />
        </span>
      </div>
      <p className="mt-0.5 text-paragraph-xs tabular-nums text-text-soft-400">
        {part.toLocaleString("en-US")} of {whole.toLocaleString("en-US")}
      </p>
    </div>
  );
}

function RowMenu({
  campaign,
  busy,
  onEdit,
  onToggle,
  onDelete,
}: {
  campaign: CampaignSummary;
  busy: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const active = campaign.status === "active";
  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>
        <Button.Root variant="neutral" mode="ghost" size="xsmall" disabled={busy} aria-label={`More actions for ${campaign.name}`}>
          <Button.Icon as={RiMoreLine} />
        </Button.Root>
      </Dropdown.Trigger>
      <Dropdown.Content align="end">
        <Dropdown.Item onSelect={onEdit}>
          <Dropdown.ItemIcon as={RiPencilLine} />
          Edit campaign
        </Dropdown.Item>
        <Dropdown.Item onSelect={onToggle} disabled={busy}>
          <Dropdown.ItemIcon as={active ? RiPauseCircleLine : RiPlayCircleLine} />
          {active ? "Pause campaign" : "Resume campaign"}
        </Dropdown.Item>
        <Dropdown.Separator />
        <Dropdown.Item destructive onSelect={onDelete}>
          <Dropdown.ItemIcon as={RiDeleteBinLine} />
          Delete campaign
        </Dropdown.Item>
      </Dropdown.Content>
    </Dropdown.Root>
  );
}

/** Skeleton rows in the table's own shape, for the first load. */
function SkeletonRows({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-hidden="true" className="min-w-[1080px]">
      <Skeleton className="h-9 w-full rounded-lg" />
      <div className="mt-1 divide-y divide-stroke-soft-200">
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} className="flex items-center gap-6 px-4 py-4">
            <div className="flex w-80 items-center gap-3">
              <Skeleton className="size-10 shrink-0 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-3/5" />
                <Skeleton className="h-3 w-2/5" />
              </div>
            </div>
            {Array.from({ length: 6 }, (_, c) => (
              <Skeleton key={c} className="h-3.5 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CampaignsClient() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<CampaignSummary | null>(null);
  const [deleting, setDeleting] = useState<CampaignSummary | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const load = useCallback(async () => {
    try {
      const response = await listCampaigns();
      setCampaigns(response.campaigns);
      setError("");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  // Calls placed from a campaign page move these numbers; catch up on return,
  // keeping the rows on screen (dimmed) rather than blanking them.
  const refresh = useCallback(() => {
    setRefreshing(true);
    return load();
  }, [load]);
  useRefreshOnReturn(refresh);

  const statusCounts = useMemo(
    () => ({
      all: campaigns.length,
      active: campaigns.filter((campaign) => campaign.status === "active").length,
      paused: campaigns.filter((campaign) => campaign.status === "paused").length,
    }),
    [campaigns],
  );

  const totals = useMemo(
    () =>
      campaigns.reduce(
        (t, c) => ({
          leads: t.leads + c.stats.leads,
          called: t.called + c.stats.called,
          connected: t.connected + c.stats.connected,
          interested: t.interested + c.stats.interested,
          toCall: t.toCall + c.counts.to_call,
          followUp: t.followUp + c.counts.follow_up,
        }),
        { leads: 0, called: 0, connected: 0, interested: 0, toCall: 0, followUp: 0 },
      ),
    [campaigns],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return campaigns
      .filter((campaign) => statusFilter === "all" || campaign.status === statusFilter)
      .filter(
        (campaign) =>
          !term ||
          campaign.name.toLowerCase().includes(term) ||
          (campaign.description ?? "").toLowerCase().includes(term),
      );
  }, [campaigns, statusFilter, search]);

  const toggleStatus = async (campaign: CampaignSummary) => {
    const next = campaign.status === "active" ? "paused" : "active";
    setTogglingId(campaign.id);
    setToggleError("");
    // Optimistic: flip now, roll back to the previous status if the save fails.
    setCampaigns((current) => current.map((c) => (c.id === campaign.id ? { ...c, status: next } : c)));
    try {
      const updated = await updateCampaign(campaign.id, { status: next });
      setCampaigns((current) => current.map((c) => (c.id === updated.id ? updated : c)));
    } catch (cause) {
      setCampaigns((current) => current.map((c) => (c.id === campaign.id ? { ...c, status: campaign.status } : c)));
      setToggleError(errorMessage(cause));
    } finally {
      setTogglingId(null);
    }
  };

  const open = (id: string) => router.push(`/calling/campaigns/${id}`);
  const clearFilters = () => {
    setStatusFilter("all");
    setSearch("");
  };

  // Rendered twice: inline in the frame header on wide screens, stacked under
  // it on narrow ones — FrameHeader keeps its actions on one line, which would
  // push the page sideways at phone width.
  const controls = (className: string) => (
    <div className={className}>
      <SegmentedControl.Root value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
        <SegmentedControl.List className="w-full lg:w-auto">
          {FILTERS.map((filter) => (
            <SegmentedControl.Trigger key={filter.value} value={filter.value} className="gap-1.5 px-3">
              {filter.label}
              <span className="tabular-nums text-text-soft-400">{statusCounts[filter.value]}</span>
            </SegmentedControl.Trigger>
          ))}
        </SegmentedControl.List>
      </SegmentedControl.Root>
      <Input.Root size="small" className="w-full lg:w-56">
        <Input.Wrapper>
          <Input.Icon as={RiSearchLine} />
          <Input.Input type="search" aria-label="Search campaigns" placeholder="Search campaigns…" value={search} onChange={(event) => setSearch(event.target.value)} />
        </Input.Wrapper>
      </Input.Root>
    </div>
  );

  const connectRate = ratio(totals.connected, totals.called);

  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <PageHeader
        title="Call campaigns"
        description="Call a list of people over WhatsApp, then follow up on what they said."
        actions={
          <Button.Root variant="primary" mode="filled" size="small" onClick={() => setCreateOpen(true)}>
            <Button.Icon as={RiAddLine} />
            Start new campaign
          </Button.Root>
        }
      />

      {loading ? (
        <div className="mt-6"><KpiStripSkeleton cells={5} /></div>
      ) : (
        <KpiStrip className="mt-6" columns={5}>
          <KpiCell icon={RiPhoneLine} label="Active campaigns" value={formatCompact(statusCounts.active)} context={`${statusCounts.paused} paused`} />
          <KpiCell icon={RiTeamLine} label="Contacts" value={formatCompact(totals.leads)} context={`${totals.toCall.toLocaleString("en-US")} to call · ${totals.followUp.toLocaleString("en-US")} to follow up`} />
          <KpiCell icon={RiUserReceivedLine} label="Reached" value={formatCompact(totals.called)} context={totals.leads > 0 ? `${formatPercent(ratio(totals.called, totals.leads))} of contacts called` : "Nobody called yet"} hint={HINTS.reached} />
          <KpiCell icon={RiPercentLine} label="Connect rate" value={formatPercent(connectRate)} context={totals.called > 0 ? `${totals.connected.toLocaleString("en-US")} of ${totals.called.toLocaleString("en-US")} picked up` : "No calls yet"} hint={HINTS.connectRate} />
          <KpiCell icon={RiStarLine} label="Interested" value={formatCompact(totals.interested)} context={totals.connected > 0 ? `${formatPercent(ratio(totals.interested, totals.connected))} of connected` : undefined} hint={HINTS.interested} />
        </KpiStrip>
      )}

      {toggleError && <FormError className="mt-4">{toggleError}</FormError>}

      <Frame className="mt-5">
        <FrameHeader
          title="Campaigns"
          description="All time. Open a campaign to call its contacts."
          actions={controls("hidden flex-wrap items-center gap-2 lg:flex")}
        />
        {controls("flex flex-col gap-2 px-3 pb-3 lg:hidden")}
        <FramePanel
          aria-busy={loading || refreshing || undefined}
          className={cn("overflow-x-auto p-2 transition-opacity sm:p-2", refreshing && "opacity-60")}
        >
          {loading ? (
            <SkeletonRows />
          ) : error ? (
            <ErrorState message={error} onRetry={() => { setLoading(true); void load(); }} />
          ) : campaigns.length === 0 ? (
            <EmptyState
              icon={RiPhoneLine}
              title="No call campaigns yet"
              description="A campaign is a list of people to call over WhatsApp. Add contacts, work through them, and track who picked up and who to follow up."
              action={
                <Button.Root variant="primary" mode="filled" size="small" onClick={() => setCreateOpen(true)}>
                  <Button.Icon as={RiAddLine} />
                  Start new campaign
                </Button.Root>
              }
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={RiSearchLine}
              title="No campaigns match"
              description="Try another status, or a different search."
              action={
                <Button.Root variant="neutral" mode="stroke" size="xsmall" onClick={clearFilters}>
                  <Button.Icon as={RiFilterOffLine} />
                  Clear filters
                </Button.Root>
              }
            />
          ) : (
            <Table.Root className="min-w-[1080px]">
              <Table.Header>
                <Table.Row>
                  <Table.Head scope="col" className="px-4">Campaign</Table.Head>
                  <Table.Head scope="col" className="w-24 px-4 text-right">Contacts</Table.Head>
                  <Table.Head scope="col" className="w-36 px-4" title={HINTS.reached}>Reached</Table.Head>
                  <Table.Head scope="col" className="w-36 px-4" title={HINTS.connectRate}>Connect rate</Table.Head>
                  <Table.Head scope="col" className="w-36 px-4" title={HINTS.interested}>Interested</Table.Head>
                  <Table.Head scope="col" className="w-24 whitespace-nowrap px-4 text-right">To call</Table.Head>
                  <Table.Head scope="col" className="w-28 whitespace-nowrap px-4 text-right">Follow-up</Table.Head>
                  <Table.Head scope="col" className="w-20 px-4 text-right">Done</Table.Head>
                  <Table.Head scope="col" className="w-14 px-4"><span className="sr-only">Actions</span></Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body spacing={4}>
                {filtered.map((campaign) => {
                  const { leads, called, connected, interested } = campaign.stats;
                  const progress = leads > 0 ? Math.min(called / leads, 1) : null;
                  return (
                    <Table.Row
                      key={campaign.id}
                      tabIndex={0}
                      onClick={() => open(campaign.id)}
                      onKeyDown={(event) => { if (event.target === event.currentTarget && event.key === "Enter") open(campaign.id); }}
                      className="cursor-pointer outline-none focus-visible:[&>td]:bg-bg-weak-50"
                    >
                      <Table.Cell className="h-16 px-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <div title={progress === null ? "No contacts yet" : progress === 1 ? "Every contact called" : `${Math.round(progress * 100)}% of contacts called`}>
                            <CampaignProgressRing progress={progress} complete={progress === 1} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="truncate text-label-sm text-text-strong-950" title={campaign.name}>{campaign.name}</span>
                              <CampaignStatusBadge status={campaign.status} />
                            </div>
                            <p className="mt-0.5 max-w-sm truncate text-paragraph-xs text-text-sub-600" title={campaign.description ?? undefined} suppressHydrationWarning>
                              {campaign.description ? `${campaign.description} · ` : ""}Created {createdOn(campaign.createdAt)}
                            </p>
                          </div>
                        </div>
                      </Table.Cell>
                      <Table.Cell className={cn("px-4 text-right", num)}>{leads.toLocaleString("en-US")}</Table.Cell>
                      <Table.Cell className="px-4"><ShareCell part={called} whole={leads} of="contacts called" /></Table.Cell>
                      <Table.Cell className="px-4"><ShareCell part={connected} whole={called} of="called contacts picked up" /></Table.Cell>
                      <Table.Cell className="px-4"><ShareCell part={interested} whole={connected} of="connected contacts interested" /></Table.Cell>
                      <Table.Cell className={cn("px-4 text-right", num)}>{campaign.counts.to_call.toLocaleString("en-US")}</Table.Cell>
                      <Table.Cell className={cn("px-4 text-right", num)}>{campaign.counts.follow_up.toLocaleString("en-US")}</Table.Cell>
                      <Table.Cell className={cn("px-4 text-right", num)}>{campaign.counts.done.toLocaleString("en-US")}</Table.Cell>
                      <Table.Cell className="px-4" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                        <div className="flex justify-end">
                          <RowMenu
                            campaign={campaign}
                            busy={togglingId === campaign.id}
                            onEdit={() => setEditing(campaign)}
                            onToggle={() => void toggleStatus(campaign)}
                            onDelete={() => setDeleting(campaign)}
                          />
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table.Root>
          )}
        </FramePanel>
      </Frame>

      {/* Modals live outside the table: React events bubble through portals, so inside a row they would trigger its navigation. */}
      <EditCampaignModal
        open={editing !== null}
        onOpenChange={(open) => { if (!open) setEditing(null); }}
        campaign={editing}
        onUpdated={(updated) => {
          setEditing(null);
          setCampaigns((current) => current.map((c) => (c.id === updated.id ? updated : c)));
        }}
      />
      <DeleteCampaignModal
        open={deleting !== null}
        onOpenChange={(open) => { if (!open) setDeleting(null); }}
        campaign={deleting}
        onDeleted={() => {
          const id = deleting?.id;
          setDeleting(null);
          if (id) setCampaigns((current) => current.filter((c) => c.id !== id));
        }}
      />
      <CreateCampaignModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(campaign) => router.push(`/calling/campaigns/${campaign.id}`)}
      />
    </div>
  );
}

function CreateCampaignModal({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (campaign: CampaignSummary) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setName("");
      setDescription("");
      setError("");
      setSubmitting(false);
    }
  }, [open]);

  const submit = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const campaign = await createCampaign({ name: name.trim(), description: description.trim() || null });
      onOpenChange(false);
      onCreated(campaign);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal.Root open={open} onOpenChange={(next) => { if (!submitting) onOpenChange(next); }}>
      <Modal.Content>
        <Modal.Header icon={RiPhoneLine}>
          <Modal.Title>New campaign</Modal.Title>
          <Modal.Description>A campaign is a list of people to work through, one call at a time.</Modal.Description>
        </Modal.Header>
        <Modal.Body className="space-y-3">
          {error && <FormError>{error}</FormError>}
          <TextField label="Name" autoFocus value={name} onChange={setName} placeholder="September outbound" disabled={submitting} />
          <TextField label="Description (optional)" value={description} onChange={setDescription} placeholder="What this list is for" disabled={submitting} />
        </Modal.Body>
        <Modal.Footer>
          <Modal.Close asChild>
            <Button.Root variant="neutral" mode="stroke" size="small" disabled={submitting}>Cancel</Button.Root>
          </Modal.Close>
          <Button.Root variant="primary" mode="filled" size="small" disabled={submitting || !name.trim()} onClick={() => void submit()}>
            {submitting ? "Creating…" : "Create campaign"}
          </Button.Root>
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  );
}
