import type { NextRequest } from "next/server";
import { withOrgContext } from "@/lib/auth/context";
import { callApiErrorResponse } from "@/lib/calls/sessions";
import { listCalcomBookingLinks } from "@/lib/calls/aiCampaigns/bookingLinks.server";

/** The organization's Cal.com event types, for a campaign's Booking link picker. */
export async function GET(request: NextRequest) {
  try {
    return await withOrgContext(request, async () => Response.json(await listCalcomBookingLinks()));
  } catch (error) {
    return callApiErrorResponse(error);
  }
}
