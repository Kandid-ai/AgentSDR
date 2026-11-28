/**
 * Campaign priority through the app's own HTTP API and pages, as the
 * campaign forms use it: create with a priority, change it, reject bad
 * values, never let a priority change re-run launch checks, show it on the
 * list pages, and refuse it across organizations.
 *
 *   BASE_URL=http://localhost:3111 DATABASE_URL=postgres://postgres@127.0.0.1:55432/agentsdr_e2e \
 *     DATABASE_SSL=disable bun run --conditions=react-server scripts/e2e/campaign-priority-api.ts
 *
 * Runs against a RUNNING server whose database is a disposable local copy
 * (the server started with AUTH_SIGNUP=open). It signs up two users with
 * their own organizations. It refuses to run unless DATABASE_URL points at
 * localhost.
 */
import assert from "node:assert/strict";
import postgres from "postgres";

if (!/@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL ?? "")) {
  console.error("Refusing to run: DATABASE_URL must point at a local, disposable database.");
  process.exit(1);
}
const BASE = process.env.BASE_URL ?? "http://localhost:3111";
const sql = postgres(process.env.DATABASE_URL!, { ssl: false, max: 2, onnotice: () => {} });
const { encryptIntegrationCredentials } = await import("@/lib/integrations/credentials");

let passed = 0;
async function check(name: string, fn: () => Promise<void>) {
  await fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

function cookiesFrom(res: Response, previous = ""): string {
  const jar = new Map(previous.split("; ").filter(Boolean).map((c) => [c.split("=")[0], c] as const));
  for (const c of res.headers.getSetCookie()) {
    const pair = c.split(";")[0]!;
    jar.set(pair.split("=")[0], pair);
  }
  return [...jar.values()].join("; ");
}

async function authPost(path: string, body: unknown, cookie = ""): Promise<Response> {
  return fetch(`${BASE}/api/auth${path}`, { method: "POST", headers: { "content-type": "application/json", origin: BASE, cookie }, body: JSON.stringify(body), redirect: "manual" });
}

async function signUpWithOrganization(label: string): Promise<{ cookie: string; organizationId: string }> {
  const stamp = `${label}-${Date.now()}`;
  const email = `priority-${stamp}@example.test`;
  const password = `priority-${label}-password-1`;
  const signUp = await authPost("/sign-up/email", { name: `Priority ${label}`, email, password });
  if (!signUp.ok) throw new Error(`${label} sign-up failed (${signUp.status}) ${await signUp.text()}: start the server with AUTH_SIGNUP=open`);
  await sql`update users set email_verified = true where email = ${email}`;
  const first = await authPost("/sign-in/email", { email, password });
  assert.ok(first.ok, `${label} sign-in`);
  const created = await authPost("/organization/create", { name: `Priority ${stamp}`, slug: `priority-${stamp}` }, cookiesFrom(first));
  if (!created.ok) throw new Error(`${label} org create failed (${created.status}) ${await created.text()}`);
  const { id } = (await created.json()) as { id: string };
  const again = await authPost("/sign-in/email", { email, password });
  // Google and Unipile connected, so the email, LinkedIn and WhatsApp pages and routes are usable.
  for (const [key, credentials] of [
    ["google", { serviceAccountJson: "{}", adminEmail: "admin@e2e.test" }],
    ["unipile", { apiKey: "fixture", dsn: "https://fixture.e2e.test" }],
  ] as const) {
    const [provider] = await sql<{ id: string }[]>`
      insert into grid_providers (organization_id, key, name, enabled) values (${id}, ${`platform-${key}`}, ${key}, true) returning id`;
    await sql`insert into grid_provider_credentials (provider_id, encrypted_payload) values (${provider!.id}, ${encryptIntegrationCredentials({ ...credentials })})`;
  }
  return { cookie: cookiesFrom(again), organizationId: id };
}

async function api(cookie: string, method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "content-type": "application/json", origin: BASE, cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try { json = JSON.parse(text) as Record<string, unknown>; } catch { /* a page or an empty body */ }
  return { status: res.status, json, text };
}

const a = await signUpWithOrganization("a");
const b = await signUpWithOrganization("b");

// ── Email ───────────────────────────────────────────────────────────────
console.log("Email");
let emailId = "";
await check("email: create with a priority; without one it is Medium; a bad one is a 400", async () => {
  const urgent = await api(a.cookie, "POST", "/api/outreach/campaigns", { name: "API urgent", priority: "urgent" });
  assert.equal(urgent.status, 201, urgent.text);
  assert.equal((urgent.json.campaign as { priority: string }).priority, "urgent");
  emailId = (urgent.json.campaign as { id: string }).id;
  const plain = await api(a.cookie, "POST", "/api/outreach/campaigns", { name: "API plain" });
  assert.equal((plain.json.campaign as { priority: string }).priority, "medium");
  const bad = await api(a.cookie, "POST", "/api/outreach/campaigns", { name: "API bad", priority: "critical" });
  assert.equal(bad.status, 400);
  assert.match(String(bad.json.error), /urgent, high, medium, low/);
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int n from outreach_campaigns where name = 'API bad'`;
  assert.equal(n, 0, "a refused create writes nothing");
});
await check("email: change it (any case); a bad value is a 400 that changes nothing", async () => {
  const low = await api(a.cookie, "PATCH", `/api/outreach/campaigns/${emailId}`, { priority: " LOW " });
  assert.equal(low.status, 200, low.text);
  assert.equal((low.json.campaign as { priority: string }).priority, "low");
  const bad = await api(a.cookie, "PATCH", `/api/outreach/campaigns/${emailId}`, { priority: 3, name: "renamed" });
  assert.equal(bad.status, 400);
  const [row] = await sql<{ priority: string; name: string }[]>`select priority, name from outreach_campaigns where id = ${emailId}`;
  assert.deepEqual(row, { priority: "low", name: "API urgent" }, "the bad request renamed nothing either");
  const got = await api(a.cookie, "GET", `/api/outreach/campaigns/${emailId}`);
  assert.equal((got.json.campaign as { priority: string }).priority, "low");
});
await check("email: another organization cannot change it", async () => {
  const other = await api(b.cookie, "PATCH", `/api/outreach/campaigns/${emailId}`, { priority: "urgent" });
  assert.equal(other.status, 404);
  const [row] = await sql<{ priority: string }[]>`select priority from outreach_campaigns where id = ${emailId}`;
  assert.equal(row!.priority, "low");
});
await check("email: the list page shows the priority badge", async () => {
  await api(a.cookie, "PATCH", `/api/outreach/campaigns/${emailId}`, { priority: "urgent" });
  const page = await api(a.cookie, "GET", "/outreach/campaigns");
  assert.equal(page.status, 200);
  assert.match(page.text, /Urgent priority/);
  const detail = await api(a.cookie, "GET", `/outreach/campaigns/${emailId}`);
  assert.equal(detail.status, 200);
  assert.match(detail.text, /Urgent priority/);
});

// ── LinkedIn ────────────────────────────────────────────────────────────
console.log("LinkedIn");
let linkedinId = "";
await check("linkedin: create with a priority; without one it is Medium; a bad one is a 400", async () => {
  const high = await api(a.cookie, "POST", "/api/linkedin/campaigns", { name: "LI high", priority: "high" });
  assert.ok(high.status === 200 || high.status === 201, high.text);
  const campaign = (high.json.campaign ?? high.json.data) as { id: string; priority: string };
  assert.equal(campaign.priority, "high");
  linkedinId = campaign.id;
  const plain = await api(a.cookie, "POST", "/api/linkedin/campaigns", { name: "LI plain" });
  assert.equal(((plain.json.campaign ?? plain.json.data) as { priority: string }).priority, "medium");
  const bad = await api(a.cookie, "POST", "/api/linkedin/campaigns", { name: "LI bad", priority: "top" });
  assert.equal(bad.status, 400);
  const nul = await api(a.cookie, "POST", "/api/linkedin/campaigns", { name: "LI null", priority: null });
  assert.equal(nul.status, 400);
});
await check("linkedin: a priority change on a running campaign with no leads is not blocked by the launch checks", async () => {
  await sql`update "Campaign" set status = 'ACTIVE' where id = ${linkedinId}`;
  const res = await api(a.cookie, "PATCH", `/api/linkedin/campaigns/${linkedinId}`, { priority: "urgent" });
  assert.equal(res.status, 200, res.text);
  const [row] = await sql<{ priority: string; status: string }[]>`select priority, status from "Campaign" where id = ${linkedinId}`;
  assert.deepEqual(row, { priority: "urgent", status: "ACTIVE" });
  const list = await api(a.cookie, "GET", "/api/linkedin/campaigns");
  assert.match(list.text, /"priority":"urgent"/);
});
await check("linkedin: another organization cannot change it; the list page shows the badge", async () => {
  const other = await api(b.cookie, "PATCH", `/api/linkedin/campaigns/${linkedinId}`, { priority: "low" });
  assert.ok(other.status === 404 || other.status === 403, `got ${other.status}`);
  const [row] = await sql<{ priority: string }[]>`select priority from "Campaign" where id = ${linkedinId}`;
  assert.equal(row!.priority, "urgent");
  const page = await api(a.cookie, "GET", "/linkedin/campaigns");
  assert.equal(page.status, 200);
  assert.match(page.text, /Urgent priority/);
});

// ── WhatsApp ────────────────────────────────────────────────────────────
console.log("WhatsApp");
let whatsappId = "";
await check("whatsapp: create with a priority; without one it is Medium; a bad one is a 400", async () => {
  const low = await api(a.cookie, "POST", "/api/whatsapp/campaigns", { name: "WA low", priority: "low" });
  assert.equal(low.status, 201, low.text);
  const created = (low.json.campaign ?? low.json) as { id: string; priority: string };
  assert.equal(created.priority, "low");
  whatsappId = created.id;
  const plain = await api(a.cookie, "POST", "/api/whatsapp/campaigns", { name: "WA plain" });
  assert.equal(((plain.json.campaign ?? plain.json) as { priority: string }).priority, "medium");
  const bad = await api(a.cookie, "POST", "/api/whatsapp/campaigns", { name: "WA bad", priority: "URGENT!" });
  assert.equal(bad.status, 400);
});
await check("whatsapp: a priority change on a running campaign is not blocked by the launch checks", async () => {
  await sql`update whatsapp_campaigns set status = 'active' where id = ${whatsappId}`;
  const res = await api(a.cookie, "PATCH", `/api/whatsapp/campaigns/${whatsappId}`, { priority: "urgent" });
  assert.equal(res.status, 200, res.text);
  const [row] = await sql<{ priority: string; status: string }[]>`select priority, status from whatsapp_campaigns where id = ${whatsappId}`;
  assert.deepEqual(row, { priority: "urgent", status: "active" });
});
await check("whatsapp: another organization cannot change it; the list returns the priority", async () => {
  const other = await api(b.cookie, "PATCH", `/api/whatsapp/campaigns/${whatsappId}`, { priority: "low" });
  assert.equal(other.status, 404);
  const [row] = await sql<{ priority: string }[]>`select priority from whatsapp_campaigns where id = ${whatsappId}`;
  assert.equal(row!.priority, "urgent");
  // The list page loads in the browser from this endpoint.
  const page = await api(a.cookie, "GET", "/whatsapp/campaigns");
  assert.equal(page.status, 200);
  const list = await api(a.cookie, "GET", "/api/whatsapp/campaigns");
  assert.equal(list.status, 200);
  assert.match(list.text, new RegExp(`"id":"${whatsappId}"[^}]*"priority":"urgent"`));
});

console.log(`\n${passed} checks passed.`);
await sql.end();
process.exit(0);
