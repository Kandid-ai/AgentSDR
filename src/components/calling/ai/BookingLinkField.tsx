"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { RiExternalLinkLine } from "@remixicon/react";
import * as Select from "@/components/alignui/select";
import { TextField } from "@/components/calls/fields";
import { bookingLinkLabel, type BookingLinksResponse } from "@/lib/calls/aiCampaigns/bookingLinks";
import { listBookingLinks } from "@/lib/calls/aiCampaigns/client";

const OTHER = "__other";

/**
 * A campaign's booking link: picked from the organization's Cal.com event
 * types when the Cal.com integration has an API key, typed otherwise (or
 * with "Another link…"). The value is always the link itself, so a saved
 * campaign does not depend on Cal.com answering later.
 */
export function BookingLinkField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const id = useId();
  const [state, setState] = useState<BookingLinksResponse | null>(null);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    let live = true;
    listBookingLinks()
      .then((response) => live && setState(response))
      .catch((error: unknown) => live && setState({ status: "error", error: error instanceof Error ? error.message : "Could not load your Cal.com links" }));
    return () => {
      live = false;
    };
  }, []);

  const links = state?.status === "ok" ? state.links : [];
  const trimmed = value.trim();
  const matches = links.some((link) => link.url === trimmed);
  const picking = links.length > 0;
  const showInput = !picking || typing || (trimmed !== "" && !matches);

  const hint =
    state === null
      ? "Loading your Cal.com links…"
      : state.status === "no_api_key"
        ? "add_key"
        : state.status === "not_connected"
          ? "connect"
          : state.status === "error"
            ? `${state.error}, so type the link instead.`
            : links.length === 0
              ? "Your Cal.com account has no event types with a booking link; type one instead."
              : null;

  return (
    <div className="space-y-2">
      {picking ? (
        <div>
          <label htmlFor={id} className="mb-1.5 block text-label-sm text-text-strong-950">{label}</label>
          <Select.Root
            size="small"
            value={showInput ? OTHER : trimmed}
            onValueChange={(next) => {
              if (next === OTHER) {
                setTyping(true);
                if (matches) onChange("");
              } else {
                setTyping(false);
                onChange(next);
              }
            }}
          >
            <Select.Trigger id={id} aria-label={label}><Select.Value placeholder="Choose a Cal.com event type" /></Select.Trigger>
            <Select.Content>
              {links.map((link) => <Select.Item key={link.id} value={link.url}>{bookingLinkLabel(link)}</Select.Item>)}
              <Select.Item value={OTHER}>Another link…</Select.Item>
            </Select.Content>
          </Select.Root>
        </div>
      ) : null}
      {showInput && (
        <TextField
          label={picking ? "Link" : label}
          value={value}
          onChange={onChange}
          placeholder="https://cal.com/acme/30min"
          inputMode="url"
        />
      )}
      {trimmed && /^https?:\/\//i.test(trimmed) && (
        <a href={trimmed} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-paragraph-xs text-text-sub-600 underline">
          Open the booking page <RiExternalLinkLine className="size-3.5" />
        </a>
      )}
      {hint === "add_key" ? (
        <p className="text-paragraph-xs text-text-sub-600">
          Add a Cal.com API key in <Link href="/settings/whatsapp-connection" className="underline">Settings → WhatsApp → Integrations</Link> to pick from your event types.
        </p>
      ) : hint === "connect" ? (
        <p className="text-paragraph-xs text-text-sub-600">
          <Link href="/settings/whatsapp-connection" className="underline">Connect Cal.com</Link> (with an API key) to pick from your event types and see who booked.
        </p>
      ) : hint ? (
        <p className="text-paragraph-xs text-text-sub-600">{hint}</p>
      ) : null}
    </div>
  );
}
