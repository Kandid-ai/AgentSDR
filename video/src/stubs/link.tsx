import type { AnchorHTMLAttributes } from "react";

type Href = string | { pathname?: string | null };

/** next/link outside Next: a plain anchor (the video never navigates). */
export default function Link({ href, ...rest }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: Href }) {
  return <a href={typeof href === "string" ? href : (href.pathname ?? undefined)} {...rest} />;
}
