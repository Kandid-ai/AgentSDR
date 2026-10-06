import { useEffect, useRef, type ReactNode } from "react";
import { continueRender, delayRender } from "remotion";
import WorkbookClient from "@/components/grid/WorkbookClient";
import { AppScreen } from "../Shell";
import { mockRoutes } from "../mock";
import { buildSheet, tables, workbook, type Variant } from "./workbookData";

// The sheet a refetch returns: whichever workbook screen rendered last.
let current = buildSheet({ count: 14, filled: true, total: 1240 });

const CONNECTED = new Set(["apollo", "findymail", "hunter", "millionverifier"]);

mockRoutes([
  { match: "/api/grid/tables", respond: () => current },
  {
    // The enrichment dialog asks every integration for its accounts: a few are connected, the rest are not.
    match: /^\/api\/grid\/integrations\/[^/]+\/connections$/,
    respond: (url) => {
      const key = url.pathname.split("/")[4];
      const name = key.charAt(0).toUpperCase() + key.slice(1);
      return {
        connections: CONNECTED.has(key)
          ? [{ id: key === "apollo" ? "conn-apollo" : `conn-${key}`, integrationKey: key, name: `${name} · Northstar`, enabled: true, configured: true, verified: true }]
          : [],
      };
    },
  },
]);

/**
 * The real WorkbookClient on a sample People table, laid out at 1920x1080 so
 * seven 220px columns fit, then scaled to 1440x810 like the other screens.
 * `children` wrap the client (a driver that presses buttons on mount).
 */
export function WorkbookFrame({ variant, wrap }: { variant: Variant; wrap?: (client: ReactNode) => ReactNode }) {
  const sheet = buildSheet(variant);
  current = sheet;
  const client = <WorkbookClient workbook={workbook} tables={tables} breadcrumbs={[]} initialSheet={sheet} />;
  return (
    <div style={{ width: 1440, height: 810, overflow: "hidden" }}>
      <div style={{ position: "relative", width: 1920, height: 1080, transform: "scale(0.75)", transformOrigin: "top left" }}>
        {/* A transformed box is the containing block of `position: fixed`: dialogs moved in here (see Drive) fill the window below its title bar, not the whole canvas. */}
        <div data-overlay-root style={{ position: "absolute", top: 44, left: 0, width: 1920, height: 1036, transform: "translateZ(0)", zIndex: 50, pointerEvents: "none" }} />
        <AppScreen path="/tables/q4-heads-of-sales" active="/tables" width={1920} height={1080}>
          <div className="flex overflow-hidden bg-bg-white-0" style={{ height: "100%" }}>
            <div className="min-w-0 flex-1 overflow-hidden">{wrap ? wrap(client) : client}</div>
          </div>
        </AppScreen>
      </div>
    </div>
  );
}

type Step = (root: HTMLElement) => Promise<void>;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Polls until `find` returns an element (50 ms, up to 10 s). */
async function until<T extends Element>(find: () => T | undefined | null): Promise<T> {
  for (let i = 0; i < 200; i++) {
    const el = find();
    if (el) return el;
    await sleep(50);
  }
  throw new Error("driver: element never appeared");
}

const byText = (scope: ParentNode, selector: string, text: string, exact = false) =>
  Array.from(scope.querySelectorAll<HTMLElement>(selector)).find((el) => {
    const t = el.textContent?.trim() ?? "";
    return exact ? t === text : t.includes(text);
  });

/** Presses a button the way a viewer would, for client state that has no prop. */
export const click = (selector: string, text: string, exact = false): Step => async () => {
  const el = await until(() => byText(document.body, selector, text, exact));
  el.click();
  await sleep(250);
};

/** Opens a Radix select (it opens on pointerdown) and picks the option whose text starts with `option`. */
export const pick = (index: number, option: string): Step => async () => {
  const trigger = await until(() => document.querySelectorAll<HTMLElement>('button[aria-label="Table column"]')[index]);
  const opts = { bubbles: true, cancelable: true, button: 0, pointerType: "mouse", isPrimary: true } as const;
  trigger.dispatchEvent(new PointerEvent("pointerdown", opts));
  const item = await until(() => byText(document.body, '[role="option"]', option));
  item.dispatchEvent(new PointerEvent("pointerup", opts));
  item.click();
  await sleep(250);
};

/** Runs `steps` after mount, holding the frame until they are done. */
export function Drive({ steps, children }: { steps: Step[]; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handle = delayRender("drive workbook");
    let dead = false;
    (async () => {
      try {
        // AG Grid mounts its headers a beat after the client.
        await until(() => byText(document.body, "button", "Add column"));
        await sleep(400);
        for (const step of steps) if (!dead) await step(ref.current ?? document.body);
        // The dialog portals to <body>, which would let it fill the whole canvas: keep it inside the window.
        const overlay = document.querySelector<HTMLElement>("[data-overlay-root]");
        for (const node of Array.from(document.body.children)) {
          if (overlay && node instanceof HTMLElement && node.classList.contains("fixed") && node.classList.contains("inset-0")) {
            node.style.pointerEvents = "auto";
            // The scrim's backdrop blur renders a mirrored ghost of the page under a transform; the 35% tint is the look.
            const scrim = node.firstElementChild as HTMLElement | null;
            if (scrim) scrim.style.setProperty("backdrop-filter", "none");
            overlay.appendChild(node);
          }
        }
        await sleep(600);
      } catch (e) {
        console.warn(String(e));
      } finally {
        continueRender(handle);
      }
    })();
    return () => { dead = true; };
  }, [steps]);
  return <div ref={ref} className="h-full">{children}</div>;
}
