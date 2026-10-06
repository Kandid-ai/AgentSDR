import type { CSSProperties, ReactNode } from "react";
import DialogProvider from "@/components/DialogProvider";
import { AppWindow } from "@/components/landing/AppWindow";
import landing from "@/components/landing/landing.module.css";
import { cn } from "@/utils/cn";

/**
 * A real app screen as the film shows it: the browser window with the app's
 * own sidebar (drawn from the real nav config) and the page beside it, at a
 * fixed logical size. The sidebar is collapsed to its icon rail by default —
 * the app's closed state — so the feature on show has the screen. Scale it with CSS transform where it is placed.
 */
export function AppScreen({
  path,
  active,
  host = "agentsdr.ai",
  width = 1440,
  height = 860,
  sidebar = true,
  rail = true,
  className,
  style,
  children,
}: {
  path: string;
  active: string;
  host?: string;
  width?: number;
  height?: number;
  sidebar?: boolean;
  rail?: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div className={cn(landing.page, "text-left", className)} style={{ width, background: "transparent", ...style }}>
      <DialogProvider>
        <AppWindow path={path} host={host} active={active} sidebar={sidebar} rail={rail} fade={false}>
          <div className="h-full overflow-hidden" style={{ height: height - 44 }}>
            {children}
          </div>
        </AppWindow>
      </DialogProvider>
    </div>
  );
}
