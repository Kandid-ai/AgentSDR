"use client";

import { useEffect, useState } from "react";
import { cn } from "@/utils/cn";

export type TocItem = { id: string; label: string };

/** Sticky "on this page" list; highlights the section being read. Desktop only. */
export function Toc({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState(items[0]?.id ?? "");

  useEffect(() => {
    const els = items.map((i) => document.getElementById(i.id)).filter((el): el is HTMLElement => !!el);
    if (!els.length || typeof IntersectionObserver === "undefined") return;
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.add(e.target.id);
          else visible.delete(e.target.id);
        }
        const first = items.find((i) => visible.has(i.id));
        if (first) setActive(first.id);
      },
      { rootMargin: "-96px 0px -60% 0px", threshold: 0 },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav aria-label="On this page" className="sticky top-28 hidden max-h-[calc(100vh-8rem)] overflow-y-auto lg:block">
      <p className="text-[12px] font-medium uppercase tracking-[0.06em] text-[#8a8a8a]">On this page</p>
      <ol className="mt-4 border-l border-black/[0.08]">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              aria-current={active === item.id ? "location" : undefined}
              className={cn(
                "-ml-px block border-l py-1.5 pl-4 text-[14px] leading-5 transition-colors",
                active === item.id ? "border-[#335cff] font-medium text-[#141414]" : "border-transparent text-[#6b6b6b] hover:text-[#141414]",
              )}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
