/** What the dialer is doing, in words for the call bar between calls (pure; see dialerSession.ts). */
import type { DialerPhase } from "./dialerMachine";

export type DialerStatus = { text: string; /** The rep can pause now (not mid-call, not in wrap-up). */ canPause: boolean; /** Only a stopped dialer's notice can be closed from the bar. */ dismissible: boolean } | null;

/** null: nothing to show (the dialer is not running and has nothing to say). */
export function dialerStatus(phase: DialerPhase): DialerStatus {
  switch (phase.name) {
    case "stopped":
      return phase.notice ? { text: phase.notice, canPause: false, dismissible: true } : null;
    case "dialing":
      return { text: "Dialing the next lead…", canPause: true, dismissible: false };
    case "waiting":
      return { text: phase.message || "Waiting for the number…", canPause: true, dismissible: false };
    case "countdown":
      return { text: `Not answered. Next call in ${phase.seconds}…`, canPause: true, dismissible: false };
    case "calling":
      return { text: "Placing the next call…", canPause: false, dismissible: false };
    case "wrap-up":
      return { text: "Call ended — record how it went", canPause: false, dismissible: false };
  }
}
