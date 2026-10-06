import type { CSSProperties } from "react";
import { cn } from "@/utils/cn";
import type { NavLink } from "./catalog";

const TILE = 40;

/**
 * A page's mark in the mega-menu and on related-page cards: a white tile with
 * a hairline border, holding a real brand mark (Google, LinkedIn, WhatsApp, or
 * the competitor a comparison is about) or a plain dark glyph. Deliberately
 * neutral — no tinted pastel squares — so the colour that does appear belongs
 * to a real brand.
 */
export function NavIcon({ link, className }: { link: NavLink; className?: string }) {
  const Icon = link.icon;
  const bleed = link.logoFit === "bleed";
  const logoSize = typeof link.logoFit === "number" ? Math.round(TILE * link.logoFit) : 24;
  return (
    <span
      aria-hidden="true"
      className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-[11px] bg-white shadow-[0_0_0_1px_rgb(20_20_20/0.08),0_1px_2px_rgb(20_20_20/0.06)]", className)}
      style={{ width: TILE, height: TILE } as CSSProperties}
    >
      {link.logo ? (
        // eslint-disable-next-line @next/next/no-img-element -- a small static mark; next/image adds nothing here
        <img src={link.logo} alt="" width={bleed ? TILE : logoSize} height={bleed ? TILE : logoSize} className={bleed ? "size-full object-cover" : undefined} />
      ) : Icon ? (
        // Brand glyphs (LinkedIn, WhatsApp) carry padding of their own, so they run a size up to match the logos.
        <Icon className={link.color ? "size-7" : "size-6"} style={{ color: link.color ?? "#2b2b2b" }} />
      ) : null}
    </span>
  );
}
