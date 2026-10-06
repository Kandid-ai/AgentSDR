import type { Metadata } from "next";

import LandingPage from "@/components/landing/LandingPage";

const title = "AgentSDR | Open-source AI SDR";
const description =
  "The open-source SDR workspace: email sequences, LinkedIn campaigns and WhatsApp calls, with an AI CRM that classifies every reply and drafts the answer. Self-hosted, with your own AI key.";

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    type: "website",
    siteName: "AgentSDR",
    title,
    description,
  },
  twitter: { card: "summary_large_image", title, description },
};

export default function HomePage() {
  return <LandingPage />;
}
