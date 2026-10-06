"use client";

import { usePathname } from "next/navigation";
import { isChromeless } from "@/components/AppShell";
import { ListPageSkeleton } from "@/components/page/Skeletons";

/**
 * The fallback for any route without its own loading.tsx: the list-page
 * shape. Not on the landing page or the sign-in screens, which have no app
 * frame — a table there would flash in place of the website on a reload.
 */
export default function Loading() {
  return isChromeless(usePathname()) ? null : <ListPageSkeleton />;
}
