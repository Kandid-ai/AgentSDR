"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { RiAddLine, RiCloudLine, RiLinkM, RiLoader4Line, RiPauseCircleLine, RiPencilLine, RiPlayCircleLine, RiDeleteBinLine } from "@remixicon/react";
import * as Badge from "@/components/alignui/badge";
import * as Button from "@/components/alignui/button";
import * as Modal from "@/components/alignui/modal";
import * as Select from "@/components/alignui/select";
import { Frame, FramePanel } from "@/components/analytics/kit/Frame";
import { FormError, TextField } from "@/components/calls/fields";
import { errorMessage, timeAgo } from "@/components/crm/crm-utils";
import { EmptyState } from "@/components/page/EmptyState";
import { Callout } from "@/components/settings/SettingsKit";
import { SettingsPage } from "@/components/settings/SettingsPage";
import { DocsLink } from "@/components/page/DocsLink";
import {
  cancelStationLink,
  createCallingStation,
  deleteCallingStation,
  listCallingStations,
  startStationLink,
  updateCallingStation,
} from "@/lib/calls/client";
import { STATION_LAUNCHERS, type CallingStation, type StationLauncher, type StationStatus } from "@/lib/calls/stationContract";
import { cn } from "@/utils/cn";

const LAUNCHER_LABEL: Record<StationLauncher, string> = {
  local: "Local Chromium",
  gologin_sdk: "GoLogin (this server)",
  gologin_cloud: "GoLogin Cloud",
};

const STATUS_LABEL: Record<StationStatus, string> = {
  onboarding: "Not linked yet",
  active: "Active",
  paused: "Paused",
  logged_out: "Logged out",
  banned: "Banned",
};
const STATUS_COLOR: Record<StationStatus, React.ComponentProps<typeof Badge.Root>["color"]> = {
  onboarding: "gray",
  active: "green",
  paused: "orange",
  logged_out: "red",
  banned: "red",
};

const usesGoLogin = (launcher: StationLauncher) => launcher !== "local";

/** Fast while something is happening (a link code to show, a call to follow), slow otherwise. */
const POLL_BUSY_MS = 3000;
const POLL_IDLE_MS = 15000;

type Draft = { name: string; phone: string; launcher: StationLauncher; gologinProfileId: string };
const EMPTY_DRAFT: Draft = { name: "", phone: "", launcher: "gologin_cloud", gologinProfileId: "" };

export function CallingStationsSettings() {
  const [stations, setStations] = useState<CallingStation[] | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  /** "new", or the id of the station being edited. */
  const [formFor, setFormFor] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<CallingStation | null>(null);

  const load = useCallback(async () => {
    try {
      setStations((await listCallingStations()).stations);
      setError("");
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }, []);

  const hot = stations?.some((station) => station.link !== null || station.busyCallId !== null) ?? false;
  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), hot ? POLL_BUSY_MS : POLL_IDLE_MS);
    return () => clearInterval(interval);
  }, [load, hot]);

  /** Runs one action on a station and swaps the station it returns into the list. */
  const act = async (station: CallingStation, run: () => Promise<{ station: CallingStation }>) => {
    setBusyId(station.id);
    setError("");
    try {
      const { station: next } = await run();
      setStations((current) => (current ?? []).map((item) => (item.id === next.id ? next : item)));
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusyId(null);
    }
  };

  const openAdd = () => {
    setDraft(EMPTY_DRAFT);
    setFormError("");
    setFormFor("new");
  };
  const openEdit = (station: CallingStation) => {
    setDraft({ name: station.name, phone: station.phone, launcher: station.launcher, gologinProfileId: station.gologinProfileId ?? "" });
    setFormError("");
    setFormFor(station.id);
  };

  const save = async () => {
    setSaving(true);
    setFormError("");
    const gologinProfileId = usesGoLogin(draft.launcher) ? draft.gologinProfileId.trim() || null : null;
    try {
      if (formFor === "new") {
        const { station } = await createCallingStation({
          name: draft.name.trim(),
          phone: draft.phone.trim(),
          launcher: draft.launcher,
          gologinProfileId,
        });
        setStations((current) => [...(current ?? []), station]);
      } else if (formFor) {
        const { station } = await updateCallingStation(formFor, { name: draft.name.trim(), launcher: draft.launcher, gologinProfileId });
        setStations((current) => (current ?? []).map((item) => (item.id === station.id ? station : item)));
      }
      setFormFor(null);
    } catch (cause) {
      setFormError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await deleteCallingStation(deleting.id);
      setStations((current) => (current ?? []).filter((item) => item.id !== deleting.id));
      setDeleting(null);
    } catch (cause) {
      setError(errorMessage(cause));
      setDeleting(null);
    } finally {
      setSaving(false);
    }
  };

  const addButton = (
    <Button.Root variant="primary" mode="filled" size="small" onClick={openAdd}>
      <Button.Icon as={RiAddLine} />
      Add number
    </Button.Root>
  );

  const editing = formFor && formFor !== "new" ? stations?.find((station) => station.id === formFor) : null;
  const canSave = draft.name.trim() && (formFor !== "new" || draft.phone.trim()) && (!usesGoLogin(draft.launcher) || draft.gologinProfileId.trim());

  return (
    <SettingsPage
      title="Calling numbers"
      description="WhatsApp numbers the AI agent calls from, with WhatsApp Web running in a remote browser instead of a rep's laptop."
      actions={addButton}
    >
      <div className="space-y-5">
        <Callout tone="info" title="How cloud calling works">
          A calling number is a WhatsApp number linked to a browser profile that a call worker opens for each call. It needs a call worker running
          {" "}and, for GoLogin profiles, the GoLogin integration connected in{" "}
          <Link href="/settings/whatsapp-connection" className="underline">Settings → WhatsApp → Integrations</Link>.{" "}
          <DocsLink page="whatsapp/calling#what-you-need">What you need</DocsLink>
        </Callout>
        {error && <Callout tone="error">{error}</Callout>}

        {stations === null ? (
          !error && (
            <div className="flex justify-center py-12" aria-busy="true" aria-label="Loading calling numbers">
              <RiLoader4Line className="size-5 animate-spin text-text-soft-400" aria-hidden="true" />
            </div>
          )
        ) : stations.length === 0 ? (
          <Frame>
            <FramePanel>
              <EmptyState
                icon={RiCloudLine}
                title="No calling numbers yet"
                description="Add a WhatsApp number and its browser profile, then link it to WhatsApp Web from here."
                action={addButton}
              />
            </FramePanel>
          </Frame>
        ) : (
          <div className="space-y-3">
            {stations.map((station) => (
              <StationCard
                key={station.id}
                station={station}
                busy={busyId === station.id}
                onLink={() => void act(station, () => startStationLink(station.id))}
                onCancelLink={() => void act(station, () => cancelStationLink(station.id))}
                onToggle={() => void act(station, () => updateCallingStation(station.id, { status: station.status === "paused" ? "active" : "paused" }))}
                onEdit={() => openEdit(station)}
                onDelete={() => setDeleting(station)}
              />
            ))}
          </div>
        )}
      </div>

      <Modal.Root open={formFor !== null} onOpenChange={(open) => { if (!open && !saving) setFormFor(null); }}>
        <Modal.Content>
          <Modal.Header icon={RiCloudLine}>
            <Modal.Title>{formFor === "new" ? "Add a calling number" : "Edit calling number"}</Modal.Title>
            <Modal.Description>
              {formFor === "new"
                ? "After adding it, use Link WhatsApp to sign the number into WhatsApp Web."
                : `${editing?.phone ?? "The number"} can't be changed here; delete and add it again for a different number.`}
            </Modal.Description>
          </Modal.Header>
          <Modal.Body className="space-y-3">
            {formError && <FormError>{formError}</FormError>}
            <TextField label="Name" autoFocus value={draft.name} onChange={(name) => setDraft((d) => ({ ...d, name }))} placeholder="Sales line 1" disabled={saving} />
            {formFor === "new" && (
              <TextField label="WhatsApp number" value={draft.phone} onChange={(phone) => setDraft((d) => ({ ...d, phone }))} placeholder="+91 98765 43210" disabled={saving} />
            )}
            <div>
              <label className="mb-1.5 block text-label-sm text-text-strong-950">Browser</label>
              <Select.Root size="small" value={draft.launcher} onValueChange={(launcher) => setDraft((d) => ({ ...d, launcher: launcher as StationLauncher }))} disabled={saving}>
                <Select.Trigger><Select.Value /></Select.Trigger>
                <Select.Content>
                  {STATION_LAUNCHERS.map((launcher) => (
                    <Select.Item key={launcher} value={launcher}>{LAUNCHER_LABEL[launcher]}</Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            </div>
            {usesGoLogin(draft.launcher) && (
              <TextField
                label="GoLogin profile ID"
                value={draft.gologinProfileId}
                onChange={(gologinProfileId) => setDraft((d) => ({ ...d, gologinProfileId }))}
                placeholder="The profile's ID from GoLogin"
                disabled={saving}
              />
            )}
          </Modal.Body>
          <Modal.Footer>
            <Modal.Close asChild>
              <Button.Root variant="neutral" mode="stroke" size="small" disabled={saving}>Cancel</Button.Root>
            </Modal.Close>
            <Button.Root variant="primary" mode="filled" size="small" disabled={saving || !canSave} onClick={() => void save()}>
              {saving && <RiLoader4Line className="size-4 animate-spin" aria-hidden="true" />}
              {formFor === "new" ? "Add number" : "Save"}
            </Button.Root>
          </Modal.Footer>
        </Modal.Content>
      </Modal.Root>

      <Modal.Root open={deleting !== null} onOpenChange={(open) => { if (!open && !saving) setDeleting(null); }}>
        <Modal.Content>
          <Modal.Header icon={RiDeleteBinLine}>
            <Modal.Title>Delete {deleting?.name}?</Modal.Title>
            <Modal.Description>
              {deleting?.phone} stops being available for AI agent calls. Its recordings and call history stay. The browser profile itself is not deleted.
            </Modal.Description>
          </Modal.Header>
          <Modal.Footer>
            <Modal.Close asChild>
              <Button.Root variant="neutral" mode="stroke" size="small" disabled={saving}>Cancel</Button.Root>
            </Modal.Close>
            <Button.Root variant="error" mode="filled" size="small" disabled={saving} onClick={() => void confirmDelete()}>
              {saving && <RiLoader4Line className="size-4 animate-spin" aria-hidden="true" />}
              Delete
            </Button.Root>
          </Modal.Footer>
        </Modal.Content>
      </Modal.Root>
    </SettingsPage>
  );
}

function StationCard({ station, busy, onLink, onCancelLink, onToggle, onEdit, onDelete }: {
  station: CallingStation;
  busy: boolean;
  onLink: () => void;
  onCancelLink: () => void;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const linking = station.link !== null;
  const pausable = station.status === "active" || station.status === "paused";
  return (
    <Frame>
      <FramePanel className={cn("space-y-4", busy && "opacity-60")} aria-busy={busy || undefined}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-label-md text-text-strong-950">{station.name}</h3>
              <Badge.Root variant="light" size="medium" color={STATUS_COLOR[station.status]}>{STATUS_LABEL[station.status]}</Badge.Root>
              {station.busyCallId && (
                <Badge.Root variant="light" size="medium" color="blue">
                  <RiLoader4Line className="size-3 animate-spin" aria-hidden="true" />
                  On a call
                </Badge.Root>
              )}
            </div>
            <p className="text-paragraph-sm tabular-nums text-text-sub-600">
              {station.phone} · {LAUNCHER_LABEL[station.launcher]}
              {station.gologinProfileId ? ` · ${station.gologinProfileId}` : ""}
            </p>
            <p className="text-paragraph-xs text-text-soft-400">
              {station.lastSeenAt ? `Worker seen ${timeAgo(station.lastSeenAt)}` : "No worker has opened it yet"}
              {station.lastCallAt ? ` · last call ${timeAgo(station.lastCallAt)}` : ""}
            </p>
            {station.lastError && <p className="text-paragraph-xs text-error-base">{station.lastError}</p>}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {linking ? (
              <Button.Root variant="neutral" mode="stroke" size="xsmall" disabled={busy} onClick={onCancelLink}>Cancel linking</Button.Root>
            ) : (
              <Button.Root variant="neutral" mode="stroke" size="xsmall" disabled={busy || station.busyCallId !== null} onClick={onLink}>
                <Button.Icon as={RiLinkM} />
                {station.status === "onboarding" ? "Link WhatsApp" : "Relink WhatsApp"}
              </Button.Root>
            )}
            {pausable && (
              <Button.Root variant="neutral" mode="stroke" size="xsmall" disabled={busy} onClick={onToggle}>
                <Button.Icon as={station.status === "paused" ? RiPlayCircleLine : RiPauseCircleLine} />
                {station.status === "paused" ? "Resume" : "Pause"}
              </Button.Root>
            )}
            <Button.Root variant="neutral" mode="stroke" size="xsmall" disabled={busy} onClick={onEdit}>
              <Button.Icon as={RiPencilLine} />
              Edit
            </Button.Root>
            <Button.Root variant="error" mode="stroke" size="xsmall" disabled={busy} onClick={onDelete}>
              <Button.Icon as={RiDeleteBinLine} />
              Delete
            </Button.Root>
          </div>
        </div>
        {station.link && <LinkPanel link={station.link} />}
      </FramePanel>
    </Frame>
  );
}

function LinkPanel({ link }: { link: NonNullable<CallingStation["link"]> }) {
  return (
    <div className="grid gap-4 rounded-xl bg-bg-weak-50 p-4 ring-1 ring-inset ring-stroke-soft-200 md:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
      <div className="space-y-3">
        <p className="text-label-sm text-text-strong-950">Link this number to WhatsApp Web</p>
        {link.code ? (
          <p
            aria-label={`Linking code ${link.code.split("").join(" ")}`}
            className="w-fit rounded-lg bg-bg-white-0 px-4 py-2 font-mono text-title-h4 tracking-[0.25em] text-text-strong-950 ring-1 ring-inset ring-stroke-soft-200"
          >
            {link.code}
          </p>
        ) : (
          <p className="flex items-center gap-2 text-paragraph-sm text-text-sub-600">
            <RiLoader4Line className="size-4 animate-spin" aria-hidden="true" />
            {link.screenshot ? "Waiting for a code. If WhatsApp Web shows a QR instead, scan it." : "Waiting for a call worker to open WhatsApp Web…"}
          </p>
        )}
        <p className="text-paragraph-sm text-text-sub-600">
          On the phone: WhatsApp → Settings → Linked devices → Link a device → Link with phone number instead, then type this code.
        </p>
      </div>
      {link.screenshot && (
        <div className="overflow-hidden rounded-lg bg-bg-white-0 ring-1 ring-inset ring-stroke-soft-200">
          {/* eslint-disable-next-line @next/next/no-img-element -- a data: URL screenshot from the worker */}
          <img src={link.screenshot} alt="WhatsApp Web's login screen in the cloud browser" className="block w-full" />
        </div>
      )}
    </div>
  );
}
