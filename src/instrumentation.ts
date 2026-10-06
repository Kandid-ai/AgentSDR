// Next.js calls register() exactly once when the server process boots.
// Used to start the in-process outreach send-tick loop in place of external
// cron — safe because this app always runs as a single instance (see
// internalScheduler.ts for why that matters). The daily queue rebuild is
// NOT started here — that stays on an external cron (see build-queue's
// route comment) so it runs at a fixed wall-clock time instead of drifting
// with every container restart.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return; // skip edge runtime invocations

  // Outreach remains production-only: it is not backed by a distributed
  // claim lock and duplicate dev hot-reload loops could double-send messages.
  if (process.env.NODE_ENV === "production") {
    const { startInternalOutreachScheduler } = await import("./lib/outreach/internalScheduler");
    startInternalOutreachScheduler();
    const { startInternalWhatsappCampaignScheduler } = await import("./lib/whatsapp/campaigns/internalScheduler");
    startInternalWhatsappCampaignScheduler();
  }

  // Enrichment cell worker. Unlike the outreach tick above, this one claims
  // work with SKIP LOCKED, so it is safe in development too. Keeping it active
  // here is essential: manual runs otherwise remain queued forever in next dev.
  const { startGridWorker } = await import("./lib/grid/worker");
  startGridWorker();

  // CRM only claims durable AI classification/drafting jobs for registered
  // handlers. It has no sending job kind, and SKIP LOCKED keeps this safe when
  // multiple app instances overlap during a deployment.
  const { registerDefaultCrmJobHandlers } = await import("./lib/crm/handlers");
  registerDefaultCrmJobHandlers();
  const { startCrmWorker } = await import("./lib/crm/worker");
  startCrmWorker();
}
