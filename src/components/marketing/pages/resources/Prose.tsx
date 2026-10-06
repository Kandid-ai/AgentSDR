import type { ReactNode } from "react";
import { RiAlertLine, RiInformationLine, RiLightbulbLine, RiCheckLine } from "@remixicon/react";
import { cn } from "@/utils/cn";
import { displayFont, monoFont } from "@/components/landing/ui";

/**
 * Long-form typography for guides. The repo has no @tailwindcss/typography,
 * so the element styles are descendant selectors on one wrapper.
 */
const PROSE = [
  "text-[17px] leading-[1.75] text-[#3d3d3d]",
  "[&_h2]:mt-16 [&_h2]:scroll-mt-28 [&_h2]:text-balance [&_h2]:text-[32px] [&_h2]:leading-[1.15] [&_h2]:tracking-[-0.03em] [&_h2]:text-[#141414] sm:[&_h2]:text-[38px]",
  "[&_h3]:mt-10 [&_h3]:scroll-mt-28 [&_h3]:text-[21px] [&_h3]:font-medium [&_h3]:leading-snug [&_h3]:tracking-[-0.01em] [&_h3]:text-[#141414]",
  "[&_p]:mt-5 [&_h2+p]:mt-6",
  "[&_a]:text-[#2547d0] [&_a]:underline [&_a]:decoration-[#335cff]/30 [&_a]:underline-offset-4 hover:[&_a]:decoration-[#335cff]",
  "[&_strong]:font-medium [&_strong]:text-[#141414]",
  "[&_ul]:mt-5 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6 [&_ul]:marker:text-[#b0b0b0]",
  "[&_ol]:mt-5 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6 [&_ol]:marker:text-[#8a8a8a]",
  "[&_code]:rounded-md [&_code]:bg-black/[0.05] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[0.88em]",
  "[&_pre]:mt-6 [&_pre]:overflow-x-auto [&_pre]:rounded-2xl [&_pre]:bg-[#141414] [&_pre]:p-5 [&_pre]:text-[13px] [&_pre]:leading-6 [&_pre]:text-white/85 [&_pre_code]:bg-transparent [&_pre_code]:p-0",
].join(" ");

export function Prose({ children }: { children: ReactNode }) {
  return <div className={PROSE}>{children}</div>;
}

/** An h2 in the display face. Plain `<h2>` also works; this keeps the face consistent. */
export function H2({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className={displayFont}>
      {children}
    </h2>
  );
}

const TONES = {
  note: { icon: RiInformationLine, box: "bg-[#f3f6ff] ring-[#335cff]/15", accent: "text-[#2547d0]", label: "Good to know" },
  warn: { icon: RiAlertLine, box: "bg-[#fff6ee] ring-[#fa7319]/20", accent: "text-[#c2570c]", label: "Careful" },
  agentsdr: { icon: RiCheckLine, box: "bg-[#f4fbf7] ring-[#1fc16b]/20", accent: "text-[#178c4e]", label: "In AgentSDR" },
} as const;

/** A boxed aside inside prose. `agentsdr` marks what the product does, as against general practice. */
export function Callout({ tone = "note", title, children }: { tone?: keyof typeof TONES; title?: string; children: ReactNode }) {
  const t = TONES[tone];
  const Icon = t.icon;
  return (
    <aside className={cn("mt-8 rounded-2xl p-5 ring-1 ring-inset sm:p-6", t.box)}>
      <p className={cn(monoFont, "flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.06em]", t.accent)}>
        <Icon className="size-4" aria-hidden="true" />
        {title ?? t.label}
      </p>
      <div className="mt-2 text-[15.5px] leading-[1.7] text-[#2b2b2b] [&_p]:mt-3! [&>p:first-child]:mt-0! [&_ul]:mt-3!">{children}</div>
    </aside>
  );
}

/** A scrollable table with hairlines; pass `<thead>` and `<tbody>` as children. */
export function DataTable({ caption, children }: { caption?: string; children: ReactNode }) {
  return (
    <div className="mt-6 overflow-x-auto rounded-2xl ring-1 ring-black/[0.08]">
      <table className="w-full min-w-[520px] border-collapse text-left text-[14.5px] leading-6 [&_td]:border-t [&_td]:border-black/[0.06] [&_td]:px-4 [&_td]:py-3 [&_td]:align-top [&_th]:bg-[#f7f7f8] [&_th]:px-4 [&_th]:py-3 [&_th]:text-[12px] [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-[0.05em] [&_th]:text-[#6b6b6b]">
        {caption && <caption className="sr-only">{caption}</caption>}
        {children}
      </table>
    </div>
  );
}

/** The box at the top of a guide: what to remember if you read nothing else. */
export function KeyTakeaways({ items }: { items: string[] }) {
  return (
    <aside aria-labelledby="takeaways-title" className="rounded-2xl bg-[#f7f7f8] p-6 ring-1 ring-black/[0.05] sm:p-7">
      <p id="takeaways-title" className={cn(monoFont, "flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.06em] text-[#335cff]")}>
        <RiLightbulbLine className="size-4" aria-hidden="true" />
        Key takeaways
      </p>
      <ul className="mt-4 grid gap-3">
        {items.map((item) => (
          <li key={item} className="flex gap-3 text-[15.5px] leading-[1.6] text-[#2b2b2b]">
            <span aria-hidden="true" className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[#335cff] text-white">
              <RiCheckLine className="size-3.5" />
            </span>
            {item}
          </li>
        ))}
      </ul>
    </aside>
  );
}
