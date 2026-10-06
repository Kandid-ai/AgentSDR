import type { Metadata } from "next";
import { Instrument_Serif, Inter as FontSans } from "next/font/google";
import AppShell from "@/components/AppShell";
import DialogProvider from "@/components/DialogProvider";
import { brandDisplay } from "@/components/brand/font";
import { THEME_INIT_SCRIPT, ThemeProvider } from "@/components/theme/ThemeProvider";
import { SITE_URL } from "@/lib/marketing/site";
import "./globals.css";

const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans-inter",
});

const fontSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-instrument-serif-next",
});

export const metadata: Metadata = {
  // Resolves relative Open Graph and canonical URLs on the marketing pages.
  metadataBase: new URL(SITE_URL),
  title: "AgentSDR",
  description: "Outreach, qualification and CRM for GTM teams",
  // The favicon is src/app/icon.svg and apple-icon.png (Next's file convention):
  // the brand tile, which reads on light and dark tabs alike.
};

export default function RootLayout({
  children,
  modal,
}: Readonly<{
  children: React.ReactNode;
  /** Pop-ups with their own URL — today only Settings (src/app/@modal). */
  modal: React.ReactNode;
}>) {
  // Theme: data-theme="light" is the server default. THEME_INIT_SCRIPT runs
  // before paint and switches <html> to the stored choice (light, dark, or the
  // OS preference) — the `.dark` token block in globals.css does the rest —
  // and ThemeProvider keeps it in sync after hydration. data-theme also stops
  // the OS-preference dark block from applying on its own.
  //
  // suppressHydrationWarning: that script, and the call-recorder extension
  // (data-agentsdr-recorder, RECORDER_INSTALLED_ATTRIBUTE in
  // src/lib/calls/contract.ts), change <html> attributes before React loads.
  // It covers this element's own attributes only, not its children.
  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${fontSans.variable} ${fontSerif.variable} ${brandDisplay.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-bg-white-0 text-text-strong-950">
        <ThemeProvider>
          <DialogProvider>
            <AppShell>{children}</AppShell>
            {modal}
          </DialogProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
