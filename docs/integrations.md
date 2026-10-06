---
title: "Integrations"
description: "Connecting Unipile, Google Workspace, Cloudflare R2, OpenRouter, enrichment providers, Resend and Google sign-in."
icon: "plug"
---

AgentSDR talks to outside services in two ways:

- **Per organization**, connected inside the app by an owner or admin and
  stored encrypted in the database (AES-256-GCM, key `INTEGRATION_CREDENTIALS_KEY`).
  This covers Unipile, Google Workspace, Cloudflare R2, OpenRouter and the
  enrichment providers. Each organization connects its own accounts; there is no
  environment fallback. A feature works only while its integration is connected:
  background jobs skip an organization that has not connected it, user-facing
  routes answer 409, and pages show a Connect prompt.
- **Per instance**, configured in the environment: Resend (auth email) and the
  Google OAuth client for "Continue with Google" sign-in. See
  [configuration.md](configuration.md).

Connecting and changing integrations needs the owner or admin role. Members use
the features but cannot change credentials. Each credential is verified with one
live call to the provider before it is saved, and secret values are never sent
back to the browser (leave a secret field blank when editing to keep it).

Open Settings, Integrations for Unipile, Google Workspace and Cloudflare R2.
OpenRouter is connected under Settings, AI provider.

## Unipile

Connects LinkedIn and WhatsApp accounts for sending, inbox sync and calling
support. Without it, LinkedIn accounts and campaigns and WhatsApp messaging are
off.

Fields (Settings, Integrations, Unipile):

| Field | What it is |
|---|---|
| DSN (API address) | Shown at the top of the Unipile dashboard, for example `api8.unipile.com:13851`. `https://` is added if missing. |
| Access token | Dashboard, Access tokens, Generate. Shown once. |
| Webhook secret | Leave it empty: AgentSDR generates one on the first save. Fill it in only to keep a secret you already use. |

Linking accounts: reps link their LinkedIn or WhatsApp account through
Unipile's hosted wizard from Settings, LinkedIn accounts / WhatsApp accounts, or
in the Unipile dashboard followed by "Sync from Unipile". LinkedIn and WhatsApp
accounts are read separately.

### Webhooks (registered automatically)

When the integration is saved, AgentSDR registers the webhooks it needs in
your Unipile workspace through Unipile's API, so there is nothing to set up in
the Unipile dashboard:

| Unipile source and events | URL |
|---|---|
| `users`: `new_relation` (a LinkedIn connection request was accepted) | `/api/webhooks/connection-accepted?org=<organization id>` |
| `messaging`: `message_received` (LinkedIn) | `/api/webhooks/message-received?org=<organization id>` |
| `messaging`: `message_received`, `message_read`, `message_delivered` (WhatsApp) | `/api/webhooks/whatsapp-message?org=<organization id>` |

Each is registered with the header `x-unipile-secret: <webhook secret>`, which
Unipile sends on every delivery. Settings, Integrations, Unipile shows whether
registration worked, a **Register again** button, and **Show URLs and secret**
(owners and admins only) for registering them by hand.

How a delivery is checked:

- A URL with `org=` must carry that organization's secret, or it is refused
  with 401 (as is an unknown organization). An event for an account that is not
  that organization's (not synced yet, or another organization's sharing the
  same Unipile workspace) is acknowledged with 200 and dropped, so Unipile does
  not retry it.
- Registering replaces, never duplicates: it removes this organization's
  earlier registrations and any hand-made registration of the same three
  endpoints that names no organization. Other organizations' registrations are
  left alone. Disconnecting Unipile removes this organization's own.
- Registration is skipped while `BETTER_AUTH_URL` is a `localhost` address,
  which Unipile's servers cannot reach.
- Hand-made URLs without `org=` still work as before: the organization is
  found from the account in the payload. The two LinkedIn endpoints accept such
  a request with no secret (and log a warning); the WhatsApp endpoint requires
  `?secret=` or the header. Clicking **Register again** replaces them.
- The `message-received` endpoint also receives WhatsApp events and ignores
  anything that is not LinkedIn, and the reverse for `whatsapp-message`.
- Every delivery is stored in a ledger first. Failed ones are retried by the
  `replay-webhooks` job ([self-hosting.md](self-hosting.md#scheduled-jobs)).

### Hosted auth notify URL (`?org=`)

When a user connects an account through the hosted wizard, AgentSDR gives
Unipile a `notify_url`:

```
<BETTER_AUTH_URL>/api/webhooks/unipile-account?secret=<webhook secret>&org=<organization id>
```

Unipile calls it when the wizard finishes (`CREATION_SUCCESS` or
`RECONNECTED`), and AgentSDR then syncs the LinkedIn and WhatsApp accounts. The
`org` parameter tells the public endpoint whose secret to check before it reads
anything. URLs created before `org` existed carry only `secret`; the
organization is then the one whose stored secret matches. The notify URL is
**omitted** when `BETTER_AUTH_URL` (the public origin) is a `localhost` address or when no
webhook secret is stored, because Unipile's servers cannot reach it. Locally the
redirect back to the accounts page syncs anyway.

Send limits for WhatsApp (no new chats for 24 hours after a number is linked,
25 new chats a day per number, 10 seconds between sends) are enforced server-side and can be tuned with the
`WHATSAPP_*` variables ([configuration.md](configuration.md#workers-and-tuning)).

## Google Workspace

Sends and reads Gmail through a service account with domain-wide delegation.
Without it, email accounts, email campaigns and reply sync are off.

1. In Google Cloud, enable the Gmail API (APIs & Services, Library).
2. Create a service account (IAM & Admin, Service accounts). It needs no roles.
3. Create a JSON key for it (Keys, Add key, Create new key, JSON).
4. In the Google Admin console: Security, Access and data control, API
   controls, Manage domain-wide delegation, Add new. Enter the service
   account's Client ID and these scopes:

   ```
   https://www.googleapis.com/auth/gmail.send,https://www.googleapis.com/auth/gmail.readonly
   ```

5. In Settings, Integrations, Google Workspace, upload the key file (it fills
   the service account email and private key) and save.

Mailboxes are then added under Settings, Email accounts; the service account
impersonates each address on your Workspace domain.

### Reply sync through Pub/Sub (optional, recommended)

Sending works without this, but replies are not picked up.

1. In Google Cloud, create a Pub/Sub topic.
2. Give `gmail-api-push@system.gserviceaccount.com` the Pub/Sub Publisher role
   on that topic.
3. Put the topic's full name (`projects/<project>/topics/<topic>`) in the
   "Gmail Pub/Sub topic" field of the integration.
4. Create a **push** subscription on the topic with the endpoint
   `https://<your-origin>/api/outreach/webhooks/gmail-watch`. Pub/Sub cannot add
   a shared secret, so the endpoint only acts on addresses of mailboxes that are
   connected in AgentSDR and acknowledges everything else.
5. Schedule `POST /api/outreach/mailboxes/watch` daily
   ([self-hosting.md](self-hosting.md#scheduled-jobs)). Gmail watches expire
   after about seven days; this call renews them for every connected mailbox.

## Cloudflare R2

Stores WhatsApp call recordings and contact photos. Without it those features
are off. Recordings are reached only through short-lived presigned URLs.

1. In the Cloudflare dashboard, open R2 Object Storage and create a bucket.
2. Copy your Account ID from the R2 overview page.
3. Manage API tokens, Create API token, with Object Read and Write on that
   bucket. Copy the Access Key ID and Secret Access Key (shown once).
4. In Settings, Integrations, Cloudflare R2 enter Account ID, Bucket name,
   Access key ID and Secret access key.

## OpenRouter (AI provider)

All model calls (AI columns in Tables, CRM classification and drafting, call
transcription) go through OpenRouter, and only with **your own provider keys**
("bring your own key"). Configure it at Settings, AI provider:

1. **OpenRouter account.** Enter an inference API key and a management key.
   The management key reads your BYOK configuration (`/api/v1/byok`) and cannot
   run completions. Create them at openrouter.ai (keys and management keys
   pages).
2. **Providers and models.** Add your provider keys (OpenAI, Anthropic, Google
   and so on) as BYOK keys in the OpenRouter dashboard, then press "Refresh
   providers" and select the providers and models AgentSDR may use. Fallback
   credentials are shown but not selectable.
3. **Default model.** Every internal AI task uses this text model. It must
   support structured output.
4. **Call transcription model.** Used to transcribe WhatsApp call recordings.
   Pick a model that accepts audio input (for example a Gemini model). Leaving
   it empty turns transcription off. Gemini merges the audio channels, so
   speaker labels are inferred.
5. **Shared capacity.** OpenRouter does not expose its "shared capacity
   fallback" setting through its API. In the OpenRouter BYOK dashboard, set
   "Never use shared capacity on this provider" for every enabled provider, then
   confirm it in AgentSDR. Model calls are blocked until you do.

Requests are pinned to one provider with fallbacks disabled.
`OPENROUTER_SITE_URL` sets the attribution URL sent to OpenRouter.

## Enrichment providers (Tables)

Tables can call enrichment services per row. Each provider has its own
connection (an API key, verified before saving) and you can hold several
accounts per provider. Connections are per organization. Supported providers:
Apollo, Cleanlist, ContactOut, Findymail, FullEnrich, Hunter, Icypeas,
LeadMagic, Lusha, MillionVerifier, RocketReach, Semrush, Similarweb, Snov and
ZeroBounce. The definitions live in `src/lib/integrations/` (see its README for
adding one).

Two things are deliberately **not** stored in the database: the HTTP column's
bearer token (read from an environment variable whose name the user chooses; see
[configuration.md](configuration.md#user-named-variables-tables-http-column)),
and the prospecting master `APOLLO_API_KEY`.

## Platform-level services

### Resend

Auth email (sign-up verification, password reset, invitations) for the whole
instance. Create an API key at resend.com, verify a sending domain, then set
`RESEND_API_KEY` and `AUTH_EMAIL_FROM`. Without a key the emails are written to the server log, which is enough to verify the first account but not to invite anyone, so set it up before inviting people in production.

### Google sign-in

Optional "Continue with Google" button. In Google Cloud, create an OAuth client
(Web application) with the authorized redirect URI
`<BETTER_AUTH_URL>/api/auth/callback/google`, then set `GOOGLE_CLIENT_ID` and
`GOOGLE_CLIENT_SECRET`. With either empty the button is hidden. Signing in with
Google as an address that already has a password account links the two. This is
unrelated to the Google Workspace integration above, which is the Gmail service
account.
