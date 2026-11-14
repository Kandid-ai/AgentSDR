import "server-only";

import { getPlatformCredentials } from "@/lib/platform/credentials";
import { parseCalcomEventTypes, type BookingLinksResponse } from "./bookingLinks";

/**
 * The organization's Cal.com event types with their booking links, for the
 * campaign's Booking link picker. Needs the Cal.com integration's optional
 * API key; without it (or when Cal.com fails) the picker lets a person type
 * the link instead, so this never throws for those cases.
 */
export async function listCalcomBookingLinks(): Promise<BookingLinksResponse> {
  const credentials = await getPlatformCredentials("calcom");
  if (!credentials) return { status: "not_connected" };
  if (!credentials.apiKey) return { status: "no_api_key" };
  let response: Response;
  try {
    response = await fetch("https://api.cal.com/v2/event-types", {
      headers: { Authorization: `Bearer ${credentials.apiKey}`, "cal-api-version": "2024-06-14", accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
  } catch {
    return { status: "error", error: "Could not reach Cal.com" };
  }
  if (response.status === 401 || response.status === 403) return { status: "error", error: "Cal.com didn't accept the saved API key" };
  if (!response.ok) return { status: "error", error: `Cal.com answered ${response.status}` };
  const body = await response.json().catch(() => null);
  return { status: "ok", links: parseCalcomEventTypes(body) };
}
