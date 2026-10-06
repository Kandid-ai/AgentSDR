/**
 * The tools AgentSDR replaces, as the hero's convergence animation shows
 * them: outbound engines travel the left-hand lines, data and CRMs the
 * right-hand ones, all of them into the headline's icon.
 *
 * Every mark is the company's own, unaltered, from public/landing/tools/ —
 * see the source of each below. Never redraw or approximate one: if a real
 * asset can't be had, leave the tool out.
 */

export type Tool = {
  name: string;
  src: string;
  /** Which side of the hero it flies in from. */
  side: "left" | "right";
  /** Which of that side's six lines it travels (0 top … 5 bottom). */
  line: 0 | 1 | 2 | 3 | 4 | 5;
  /**
   * The asset is itself an app tile (a filled square): it fills the frame
   * edge to edge rather than sitting on white inside it.
   */
  bleed?: boolean;
  /** Size of a free-standing mark inside its white tile, as a fraction of the tile. */
  inset?: number;
  /** One of the six shown on a phone, and how far above (−) or below (+) the icon it enters there, in px. */
  phone?: number;
};

/**
 * Launch order: consecutive tools alternate sides, and each side's lines
 * are visited out of order, so two tools in a row never travel neighbouring
 * lines.
 *
 * Sources:
 * - Smartlead  — smartlead.ai favicon (512px PNG, Webflow CDN)
 * - Clay       — clay.com favicon (512px PNG, Webflow CDN)
 * - Instantly  — instantly.ai apple-touch-icon (256px PNG)
 * - HubSpot    — Simple Icons `hubspot` (CC0), in HubSpot's #FF7A59
 * - HeyReach   — heyreach.io favicon (1000px PNG, Webflow CDN)
 * - Attio      — the mark from attio.com's header logo (inline SVG)
 * - lemlist    — the mark from lemlist.com's footer logo SVG
 * - Salesforce — salesforce.com nav logo (a.sfdcstatic.com SVG)
 * - Apollo.io  — apollo.io/icon.svg (256px PNG inside)
 * - Pipedrive  — pipedrive.com apple-touch-icon (152px PNG)
 * - Expandi    — expandi.io favicon (208px PNG)
 * - Close      — close.com apple-touch-icon (256px PNG)
 * - Outreach   — outreach.io webclip (256px PNG, Webflow CDN)
 * - Lusha      — lusha.com site icon (192px PNG)
 * - Salesloft  — salesloft.com/icon.svg
 * - Hunter     — hunter.io retina touch icon (180px PNG)
 * - Waalaxy    — waalaxy.com apple-touch-icon (180px PNG, Framer CDN)
 * - folk       — folk.app 192px icon (PNG, Webflow CDN)
 */
export const TOOLS: Tool[] = [
  { name: "Smartlead", src: "/landing/tools/smartlead.png", side: "left", line: 1, bleed: true, phone: -70 },
  { name: "Clay", src: "/landing/tools/clay.png", side: "right", line: 4, inset: 0.74, phone: -100 },
  { name: "Instantly", src: "/landing/tools/instantly.png", side: "left", line: 4, inset: 0.66, phone: -132 },
  { name: "HubSpot", src: "/landing/tools/hubspot.svg", side: "right", line: 1, inset: 0.58, phone: -34 },
  { name: "HeyReach", src: "/landing/tools/heyreach.png", side: "left", line: 0, bleed: true, phone: 10 },
  { name: "Attio", src: "/landing/tools/attio.svg", side: "right", line: 5, inset: 0.56, phone: 28 },
  { name: "lemlist", src: "/landing/tools/lemlist.svg", side: "left", line: 3, bleed: true },
  { name: "Salesforce", src: "/landing/tools/salesforce.svg", side: "right", line: 2, inset: 0.76 },
  { name: "Apollo.io", src: "/landing/tools/apollo.png", side: "left", line: 5, bleed: true },
  { name: "Pipedrive", src: "/landing/tools/pipedrive.png", side: "right", line: 0, inset: 0.64 },
  { name: "Expandi", src: "/landing/tools/expandi.png", side: "left", line: 2, inset: 0.92 },
  { name: "Close", src: "/landing/tools/close.png", side: "right", line: 3, inset: 0.66 },
  { name: "Outreach", src: "/landing/tools/outreach.png", side: "left", line: 0, inset: 0.62 },
  { name: "Lusha", src: "/landing/tools/lusha.png", side: "right", line: 0, inset: 0.66 },
  { name: "Salesloft", src: "/landing/tools/salesloft.svg", side: "left", line: 3, bleed: true },
  { name: "Hunter", src: "/landing/tools/hunter.png", side: "right", line: 5, inset: 0.86 },
  { name: "Waalaxy", src: "/landing/tools/waalaxy.png", side: "left", line: 5, inset: 0.84 },
  { name: "folk", src: "/landing/tools/folk.png", side: "right", line: 1, inset: 0.62 },
];
