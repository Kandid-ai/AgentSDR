"use client";

import { Stage } from "@/components/landing/motion/Stage";
import { Showcase } from "@/components/landing/Showcase";
import { cn } from "@/utils/cn";

/**
 * The inbox's real shortcuts as a keyboard: each key lights up in turn with
 * what it does. Keys come from src/components/inbox/shell/hotkeys.ts, the
 * command palette and the email composer.
 */

const KEYS = [
  { keys: ["J"], title: "Next conversation", body: "Moves focus down the list from anywhere outside a text field. ↓ does the same inside the list." },
  { keys: ["K"], title: "Previous conversation", body: "Moves focus up the list. Moving focus never opens a thread, so nothing is marked read by accident." },
  { keys: ["Enter"], title: "Open the thread", body: "Opens the focused row, with the lead's message and the AI draft beside it." },
  { keys: ["Esc"], title: "Back to the list", body: "Leaves the thread and returns focus to the row you were on. On a phone it closes the thread." },
  { keys: ["⌘", "K"], title: "Jump anywhere", body: "The command palette finds pages and actions. Ctrl+K on Windows and Linux." },
  { keys: ["⌘", "Enter"], title: "Send the reply", body: "Sends from the email composer once you have read the draft. Ctrl+Enter on Windows and Linux." },
] as const;

const START = 500;
const STEP = 1500;
const CYCLE = START + STEP * KEYS.length + 1200;

export function KeyboardDeck() {
  return (
    <Showcase label="Keyboard shortcuts for working the inbox, lighting up one at a time.">
      <Stage cycle={CYCLE} final={0} className="w-full">
        {({ t, live }) => {
          const active = live && t >= START ? Math.min(KEYS.length - 1, Math.floor((t - START) / STEP)) : -1;
          return (
            <ul className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {KEYS.map((k, i) => {
                const on = active === i;
                return (
                  <li key={k.title} className={cn("rounded-3xl bg-white p-5 ring-1 transition-[box-shadow,transform] duration-300", on ? "-translate-y-0.5 shadow-[0_18px_40px_-20px_rgb(51_92_255/0.45)] ring-[#335cff]/40" : "ring-black/[0.07]")}>
                    <div className="flex h-12 items-center gap-1.5" aria-hidden="true">
                      {k.keys.map((key) => (
                        <kbd
                          key={key}
                          className="inline-flex h-11 min-w-11 items-center justify-center rounded-xl px-3 font-[family-name:var(--font-landing-mono)] text-[15px] transition-all duration-150"
                          style={{
                            background: on ? "rgb(51 92 255 / 0.1)" : "#fff",
                            color: on ? "#335cff" : "#525866",
                            boxShadow: on ? "inset 0 0 0 1px rgb(51 92 255 / 0.4)" : "0 3px 0 0 rgb(14 18 27 / 0.1), inset 0 0 0 1px rgb(14 18 27 / 0.1)",
                            transform: on ? "translateY(3px)" : "none",
                          }}
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                    <p className="mt-4 text-[16px] font-medium text-[#141414]">
                      <span className="sr-only">{k.keys.join(" + ")}: </span>
                      {k.title}
                    </p>
                    <p className="mt-1.5 text-[14px] leading-[22px] text-[#656565]">{k.body}</p>
                  </li>
                );
              })}
            </ul>
          );
        }}
      </Stage>
    </Showcase>
  );
}
