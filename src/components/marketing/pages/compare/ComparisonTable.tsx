"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { RiCheckLine, RiCloseLine, RiSubtractLine } from "@remixicon/react";
import { cn } from "@/utils/cn";
import { useReducedMotion } from "../../../landing/motion/Stage";
import type { Verdict } from "./data";

/**
 * A feature-by-feature table whose rows rise in one after another when it
 * scrolls into view. Every verdict is a mark AND a word ("Yes", "Partly",
 * "No"), so nothing depends on colour alone. Props are plain data.
 */

type TableCell = { v: Verdict; text: string };
type Column = { name: string; highlight?: boolean };
type Row = { feature: string; cells: TableCell[] };

const LABEL: Record<Verdict, string> = { yes: "Yes", partial: "Partly", no: "No", info: "", unknown: "Not compared" };

function Mark({ v }: { v: Verdict }) {
  if (v === "info") return null;
  const tone =
    v === "yes" ? "bg-[#1fc16b]/15 text-[#178c4e]" : v === "partial" ? "bg-[#fa7319]/15 text-[#c2570c]" : v === "no" ? "bg-[#fb3748]/10 text-[#c4222f]" : "bg-black/[0.05] text-[#6b6b6b]";
  return (
    <span className={cn("inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-full pl-1 pr-2 text-[12px] font-medium leading-none", tone)}>
      <span aria-hidden="true" className="flex size-4 items-center justify-center rounded-full bg-current/15">
        {v === "yes" ? <RiCheckLine className="size-3" /> : v === "no" ? <RiCloseLine className="size-3" /> : <RiSubtractLine className="size-3" />}
      </span>
      {LABEL[v]}
    </span>
  );
}

function CellView({ cell, compact }: { cell: TableCell; compact: boolean }) {
  return (
    <div className="flex flex-col items-start gap-1.5">
      <Mark v={cell.v} />
      <span className={cn("text-pretty text-[#4a4a4a]", compact ? "text-[12.5px] leading-[18px]" : "text-[14px] leading-[21px]")}>{cell.text}</span>
    </div>
  );
}

export function ComparisonTable({ caption, columns, rows, compact = false }: { caption: string; columns: Column[]; rows: Row[]; compact?: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      },
      { threshold: 0.08 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const visible = shown || reduced;
  return (
    <div ref={ref} className="overflow-x-auto rounded-3xl bg-white ring-1 ring-black/[0.07]" tabIndex={0} role="region" aria-label={caption}>
      <table className={cn("w-full border-collapse text-left", compact ? "min-w-[1040px]" : "min-w-[560px]")}>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col" className="sticky left-0 z-[1] w-[22%] bg-[#f7f7f8] px-4 py-4 text-[12px] font-medium uppercase tracking-[0.06em] text-[#6b6b6b] sm:px-6">
              Feature
            </th>
            {columns.map((c) => (
              <th key={c.name} scope="col" className={cn("px-4 py-4 text-[15px] font-medium text-[#141414] sm:px-6", c.highlight ? "bg-[#335cff]/[0.07] text-[#2547d0]" : "bg-[#f7f7f8]")}>
                {c.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.feature}
              className="border-t border-black/[0.06] align-top"
              style={
                {
                  opacity: visible ? 1 : 0,
                  transform: visible ? "none" : "translateY(10px)",
                  transition: reduced ? "none" : `opacity 500ms ease ${i * 70}ms, transform 600ms cubic-bezier(.22,1,.36,1) ${i * 70}ms`,
                } as CSSProperties
              }
            >
              <th scope="row" className="sticky left-0 z-[1] bg-white px-4 py-4 text-[14px] font-medium leading-[21px] text-[#141414] sm:px-6">
                {row.feature}
              </th>
              {row.cells.map((cell, c) => (
                <td key={c} className={cn("px-4 py-4 sm:px-6", columns[c]?.highlight && "bg-[#335cff]/[0.035]")}>
                  <CellView cell={cell} compact={compact} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
