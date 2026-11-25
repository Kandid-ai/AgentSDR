"use client";

import { useSyncExternalStore } from "react";

const subscribeNever = () => () => {};

/**
 * False while React hydrates server-rendered HTML, true from the next render on
 * (and on the very first render of anything mounted on the client).
 *
 * A date formatted without a `timeZone` takes the zone of whatever runs the
 * code: the server's (UTC in production) for the HTML, the viewer's in the
 * browser. `suppressHydrationWarning` only silences that mismatch — React keeps
 * the server's text — so a server-rendered "Created Oct 9" stayed in UTC while
 * the same date rendered after a client navigation read "Oct 10". Render
 * zone-dependent text only once this is true.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribeNever, () => true, () => false);
}

/**
 * A date or time in the viewer's time zone. Renders empty during hydration,
 * then `format(date)` — so server HTML never carries the server's zone.
 */
export function LocalTime({ value, format }: { value: string | Date; format: (date: Date) => string }) {
  const hydrated = useHydrated();
  const date = new Date(value);
  const valid = !Number.isNaN(date.getTime());
  return <time dateTime={valid ? date.toISOString() : undefined}>{hydrated && valid ? format(date) : null}</time>;
}
