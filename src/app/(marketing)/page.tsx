import LandingPage from "@/components/landing/LandingPage";
import { JsonLd } from "@/components/marketing/JsonLd";
import { marketingMetadata, softwareLd } from "@/lib/marketing/seo";

const description =
  "The open-source AI SDR: email sequences, LinkedIn campaigns and WhatsApp calls, with an AI CRM that classifies every reply and drafts the answer. Self-hosted.";

export const metadata = marketingMetadata({
  path: "/",
  title: "AgentSDR | Open-source AI SDR for email, LinkedIn & WhatsApp",
  ogTitle: "The open-source AI SDR",
  description,
});

export default function HomePage() {
  return (
    <>
      <JsonLd data={softwareLd(description)} />
      <LandingPage />
    </>
  );
}
