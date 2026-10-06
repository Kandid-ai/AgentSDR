"use client";

import type { CSSProperties, ReactNode } from "react";

/**
 * Fades its children in once `on` turns true. The stage clock in
 * landing/motion/Stage drives `on` from the loop time, so a visual is a pure
 * function of time and its last frame is also what reduced motion shows.
 */
export function Fade({ on, children, className, style, from = "up" }: { on: boolean; children: ReactNode; className?: string; style?: CSSProperties; from?: "up" | "left" | "scale" | "none" }) {
  const hidden = from === "up" ? "translateY(8px)" : from === "left" ? "translateX(-10px)" : from === "scale" ? "scale(0.96)" : "none";
  return (
    <div
      className={className}
      style={{
        ...style,
        opacity: on ? 1 : 0,
        transform: on ? "none" : hidden,
        transition: "opacity 480ms cubic-bezier(0.22,1,0.36,1), transform 480ms cubic-bezier(0.22,1,0.36,1)",
      }}
    >
      {children}
    </div>
  );
}

/** A small lowercase mono label. */
export function MonoLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={`font-[family-name:var(--font-landing-mono)] text-[11px] uppercase tracking-[0.06em] ${className ?? ""}`}>{children}</span>;
}
