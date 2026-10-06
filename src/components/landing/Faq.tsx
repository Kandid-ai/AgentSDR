import { RiArrowDownSLine } from "@remixicon/react";
import { Reveal } from "./Reveal";
import { LINKS, SectionHead } from "./ui";

/**
 * Two columns of questions, each a native <details> (keyboard and screen
 * reader behaviour for free, works without JavaScript). The answers state the
 * product's real limits rather than round them off.
 */

const QUESTIONS: Array<{ q: string; a: React.ReactNode }> = [
  {
    q: "Is AgentSDR really free?",
    a: "Yes. It is open source and you host it yourself, so there are no seats, tiers or per-contact fees. What you pay for is your server, the accounts you connect (Google Workspace, Unipile) and your own AI usage on OpenRouter.",
  },
  {
    q: "Which email providers can it send from?",
    a: "Google Workspace mailboxes, connected through a service account with domain-wide delegation. Each mailbox has its own daily limit (30 by default), sending window and signature, and several campaigns can share the same pool. Other providers aren't supported yet.",
  },
  {
    q: "Will LinkedIn automation get my account restricted?",
    a: "No tool can promise that, but AgentSDR stays well inside LinkedIn's limits: 30 invites a day on premium accounts and 5 on free, a random 30–60 second gap between invites, sending only inside each account's working hours, and an account that hits LinkedIn's own limit pauses for the day.",
  },
  {
    q: "How does WhatsApp calling work?",
    a: "You link your number through Unipile and install the AgentSDR Call Recorder Chrome extension. When you call a lead from AgentSDR, the extension dials inside WhatsApp Web and records both sides; the recording goes to your storage bucket and your chosen model transcribes it. It relies on WhatsApp Web's English interface.",
  },
  {
    q: "Which AI models can I use?",
    a: "Any model on OpenRouter, with your own key. Each call is pinned to the provider you picked, with fallbacks turned off, so your data only goes where you chose. Classification, reply drafts, transcription and AI table columns all run this way.",
  },
  {
    q: "Does the AI send replies on its own?",
    a: "No. Drafts wait in Action required until someone sends them, as written or edited. The AI can move a lead forward in the pipeline when it is confident; a sideways or backward move, a low-confidence call, and every new Customer are held for a person.",
  },
  {
    q: "Where does my data live?",
    a: "In the Postgres database you run, and call recordings in your own Cloudflare R2 bucket, reached only through short-lived signed links. Provider keys are encrypted at rest with AES-256-GCM. There is no hosted AgentSDR service in the middle.",
  },
  {
    q: "Can my whole team use it?",
    a: "Yes. Everyone signs in with their own account, and you invite teammates into your organization as owners, admins or members. One deployment can also hold several organizations, each with its own leads, inboxes and connected accounts, fully separate from the others.",
  },
  {
    q: "What do I need to deploy it?",
    a: (
      <>
        A machine that runs Docker, and PostgreSQL 16 or newer (the Compose file brings its own). Copy the example environment file, set the database URL, an auth secret and an encryption key, then connect each channel from inside the app. Start with the{" "}
        <a href={LINKS.selfHost} target="_blank" rel="noopener noreferrer" className="font-medium text-[#141414] underline decoration-black/20 underline-offset-2 hover:decoration-black/60">
          quick start on GitHub
        </a>
        .
      </>
    ),
  },
  {
    q: "Can I change how it works?",
    a: "That's the point of owning the code. It is a TypeScript Next.js app on Postgres, so adding a column type, an enrichment provider or your own channel is ordinary application work — and issues and pull requests are welcome on GitHub.",
  },
];

export function Faq() {
  const half = Math.ceil(QUESTIONS.length / 2);
  const columns = [QUESTIONS.slice(0, half), QUESTIONS.slice(half)];
  return (
    <section id="faq" aria-labelledby="faq-title" className="scroll-mt-24 bg-white py-16 sm:py-20">
      <Reveal>
        <SectionHead id="faq-title" eyebrow="F.A.Q" title="Questions & answers" />
      </Reveal>
      <div className="mx-auto mt-12 grid max-w-[1128px] gap-3 px-4 sm:mt-16 sm:px-6 md:grid-cols-2 md:gap-4">
        {columns.map((col, c) => (
          <div key={c} className="flex flex-col gap-3 md:gap-4">
            {col.map((item) => (
              <details key={item.q} className="group rounded-[14px] border border-black/[0.06] bg-white transition-colors open:bg-[#fafafa] hover:border-black/[0.1]">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-4 rounded-[14px] px-5 py-5 text-[15px] font-medium leading-[22px] text-[#141414] outline-none focus-visible:ring-2 focus-visible:ring-[#335cff] sm:px-6 [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <RiArrowDownSLine className="mt-0.5 size-[18px] shrink-0 text-[#707070] transition-transform duration-300 ease-[cubic-bezier(.6,.6,0,1)] group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
                </summary>
                <p className="px-5 pb-5 text-[14px] leading-[22px] text-[#656565] sm:px-6">{item.a}</p>
              </details>
            ))}
          </div>
        ))}
      </div>
      <p className="mt-10 text-center text-[13px] text-[#656565]">
        More questions?{" "}
        <a href={LINKS.issues} target="_blank" rel="noopener noreferrer" className="rounded-md bg-[#3737370b] px-1.5 py-0.5 font-medium text-[#141414] outline-none hover:bg-[#37373714] focus-visible:ring-2 focus-visible:ring-[#335cff]">
          open an issue
        </a>{" "}
        or{" "}
        <a href={LINKS.github} target="_blank" rel="noopener noreferrer" className="rounded-md bg-[#3737370b] px-1.5 py-0.5 font-medium text-[#141414] outline-none hover:bg-[#37373714] focus-visible:ring-2 focus-visible:ring-[#335cff]">
          read the code
        </a>
      </p>
    </section>
  );
}
