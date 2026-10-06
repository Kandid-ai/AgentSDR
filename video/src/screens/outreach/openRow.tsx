import { useEffect, useRef, type ReactNode } from "react";
import { continueRender, delayRender } from "remotion";

/**
 * Real inbox clients keep the open conversation in state, with nothing to
 * preselect it. This wrapper holds the frame, waits for the list row whose
 * text includes `text`, and clicks it, exactly as a viewer would.
 */
export function OpenRow({ text, thenButton, children }: { text: string; /** A button to press once the thread has loaded (e.g. "Review draft"). */ thenButton?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handle = delayRender(`open row ${text}`);
    let tries = 0;
    const timer = setInterval(() => {
      const row = Array.from(ref.current?.querySelectorAll<HTMLElement>("[data-inbox-row]") ?? []).find((el) => el.textContent?.includes(text));
      if (row) {
        clearInterval(timer);
        row.click();
        if (!thenButton) {
          setTimeout(() => continueRender(handle), 500);
          return;
        }
        let more = 0;
        const second = setInterval(() => {
          const button = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>("button") ?? []).find((el) => el.textContent?.trim() === thenButton);
          if (button || ++more > 100) {
            clearInterval(second);
            button?.click();
            // The draft card shrinks the thread; keep the latest message in view.
            setTimeout(() => {
              // The thread scroller: the innermost scrolling box holding the open thread (not the list).
              const boxes = Array.from(ref.current?.querySelectorAll<HTMLElement>(".overflow-y-auto") ?? []).filter((el) => el.querySelector(".max-w-3xl"));
              for (const box of boxes) box.scrollTop = box.scrollHeight;
              setTimeout(() => continueRender(handle), 200);
            }, 900);
          }
        }, 50);
      } else if (++tries > 100) {
        clearInterval(timer);
        continueRender(handle);
      }
    }, 50);
    return () => clearInterval(timer);
  }, [text, thenButton]);
  return (
    <div ref={ref} className="h-full">
      {children}
    </div>
  );
}

/** An ISO time `hours` before 5:30 pm today, so every render reads the same clock. */
export function ago(hours: number): string {
  const base = new Date();
  base.setHours(17, 30, 0, 0);
  return new Date(base.getTime() - hours * 3_600_000).toISOString();
}

/** Presses the first tab/button whose text starts with `label`, for client state a page has no prop for. */
export function ClickOnMount({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handle = delayRender(`click ${label}`);
    let tries = 0;
    const timer = setInterval(() => {
      const target = Array.from(ref.current?.querySelectorAll<HTMLElement>('[role="tab"], button') ?? []).find((el) => el.textContent?.trim().startsWith(label));
      if (target || ++tries > 100) {
        clearInterval(timer);
        target?.click();
        setTimeout(() => continueRender(handle), 500);
      }
    }, 50);
    return () => clearInterval(timer);
  }, [label]);
  return (
    <div ref={ref} className="h-full">
      {children}
    </div>
  );
}
