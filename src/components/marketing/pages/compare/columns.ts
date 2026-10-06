import { linkFor } from "../../catalog";
import { COMPETITORS } from "./data";

/** A comparison table column: the product's name and its mark (AgentSDR's own tile, or the competitor's logo from the nav catalog). */
export type Column = { name: string; highlight?: boolean; self?: boolean; logo?: string; logoFit?: "bleed" | number };

export const AGENTSDR_COLUMN: Column = { name: "AgentSDR", highlight: true, self: true };

export function competitorColumn(name: string): Column {
  const c = COMPETITORS.find((x) => x.name === name);
  if (!c) return { name };
  const { logo, logoFit } = linkFor(`/compare/${c.slug}`);
  return { name, logo, logoFit };
}
