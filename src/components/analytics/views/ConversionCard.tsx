"use client";

import * as Table from "@/components/alignui/table";
import { CONVERSION_STAGES } from "@/lib/analytics/conversion";
import type { ConversionCohort, ConversionReport, ConversionStageKey } from "@/lib/analytics/contract";
import { cn } from "@/utils/cn";
import { Frame, FrameFooter, FrameHeader, FramePanel } from "../kit/Frame";
import { formatPercent } from "../theme";

const STAGE_HEADING: Record<ConversionStageKey, string> = { booked: "Meeting booked", showed: "Showed up", pilot: "Pilot", customer: "Customer" };

function cell(cohort: ConversionCohort, stage: ConversionStageKey) {
  const reached = cohort.reached[stage];
  if (reached === null) return "n/a";
  // Counts first; the percentage only once there is a cohort to divide by.
  return cohort.interested > 0 ? `${reached} (${formatPercent(cohort.rates[stage])})` : "0";
}

const weekLabel = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** Cohort conversion by week of first becoming interested, then the booking-link funnel. */
export function ConversionCard({ value, loading, className }: { value: ConversionReport; loading: boolean; className?: string }) {
  const { stages, total, weeks, bookingFunnel: funnel } = value;
  const rows: ConversionCohort[] = [...weeks.filter((w) => w.interested > 0), total];
  return (
    <Frame className={className}>
      <FrameHeader title="Conversion" description="Of the leads that became interested, how many went on to each stage. Each lead is followed after the period ends." />
      <FramePanel className={cn("p-2 transition-opacity sm:p-3", loading && "opacity-60")}>
        <Table.Root>
          <Table.Caption className="sr-only">Conversion by cohort</Table.Caption>
          <Table.Header>
            <Table.Row>
              <Table.Head scope="col">Became interested</Table.Head>
              <Table.Head scope="col" className="text-right">Leads</Table.Head>
              {CONVERSION_STAGES.map((stage) => (
                <Table.Head key={stage} scope="col" className="text-right">{STAGE_HEADING[stage]}</Table.Head>
              ))}
            </Table.Row>
          </Table.Header>
          <Table.Body spacing={4}>
            {rows.map((cohort) => (
              <Table.Row key={cohort.weekStart ?? "total"}>
                <Table.Cell className={cn("h-10 text-label-sm text-text-strong-950", cohort.weekStart === null && "font-medium")}>
                  {cohort.weekStart === null ? "Whole period" : `Week of ${weekLabel(cohort.weekStart)}`}
                </Table.Cell>
                <Table.Cell className="h-10 text-right text-paragraph-sm tabular-nums text-text-strong-950">{cohort.interested}</Table.Cell>
                {CONVERSION_STAGES.map((stage) => (
                  <Table.Cell key={stage} className="h-10 text-right text-paragraph-sm tabular-nums text-text-strong-950">{cell(cohort, stage)}</Table.Cell>
                ))}
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
        <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-stroke-soft-200 px-2 pt-4 sm:px-3">
          <div>
            <dt className="text-paragraph-xs text-text-sub-600">Booking links sent</dt>
            <dd className="text-label-md tabular-nums text-text-strong-950">{funnel.linksSent}</dd>
          </div>
          <div>
            <dt className="text-paragraph-xs text-text-sub-600">Booked</dt>
            <dd className="text-label-md tabular-nums text-text-strong-950">
              {funnel.booked}{funnel.bookedRate !== null && <span className="ml-1.5 text-paragraph-xs text-text-sub-600">{formatPercent(funnel.bookedRate)} of links</span>}
            </dd>
          </div>
          <div>
            <dt className="text-paragraph-xs text-text-sub-600">Showed up</dt>
            <dd className="text-label-md tabular-nums text-text-strong-950">
              {funnel.showed}{funnel.showedRate !== null && <span className="ml-1.5 text-paragraph-xs text-text-sub-600">{formatPercent(funnel.showedRate)} of booked</span>}
            </dd>
          </div>
        </dl>
      </FramePanel>
      <FrameFooter>
        Stages are matched by name and counted when a lead reached them or any later one:
        {" "}{CONVERSION_STAGES.map((s) => `${STAGE_HEADING[s]} = ${stages[s]?.label ?? "not in your pipeline"}`).join(", ")}.
      </FrameFooter>
    </Frame>
  );
}
