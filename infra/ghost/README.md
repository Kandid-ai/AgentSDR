# The AgentSDR blog: Ghost at agentsdr.ai/blog

The blog is [Ghost](https://ghost.org) 6, self-hosted on the Dokploy host,
served to readers at **agentsdr.ai/blog** so every post builds authority for
agentsdr.ai rather than a subdomain. Three pieces fit together:

| Piece | Where | What it does |
| --- | --- | --- |
| Ghost + MySQL | [docker-compose.yml](docker-compose.yml), a Dokploy Compose app | The CMS. Origin hostname `blog.agentsdr.ai`, listening on `/blog`. |
| The proxy | `rewrites()` in [next.config.ts](../../next.config.ts) | `agentsdr.ai/blog/*` → `https://blog.agentsdr.ai/blog/*`. |
| The theme | [blog-theme/](../../blog-theme/) | The AgentSDR design for Ghost; uploaded in Ghost admin. |

Readers never see `blog.agentsdr.ai`: it is the origin the proxy calls. Admin
is at **agentsdr.ai/blog/ghost/**.

---

## The one thing that is easy to get wrong

`GHOST_HOST=agentsdr.ai/blog` does **two** things: Ghost writes
`agentsdr.ai/blog` links (canonicals, sitemap, RSS), *and* it listens on the
`/blog` path. So the origin serves the blog at `blog.agentsdr.ai/blog/`, which
is exactly what `next.config.ts` proxies to.

- Never redirect `blog.agentsdr.ai` itself to `agentsdr.ai`: the proxy's own
  requests would be redirected back into the proxy, and the blog loops offline.
- A canonical reading `blog.agentsdr.ai` means `GHOST_HOST` is wrong.

---

## 1. DNS first

Add **`blog.agentsdr.ai`** pointing at the same Dokploy host as `agentsdr.ai`,
set up exactly like the `agentsdr.ai` record (same record type, same
Cloudflare proxy status). Do this before deploying: the HTTPS certificate is
issued by Let's Encrypt over HTTP, which needs the name to reach this host.

```bash
dig +short blog.agentsdr.ai     # must answer like `dig +short agentsdr.ai`
```

## 2. Create the Compose app in Dokploy

1. Dokploy → Create → **Compose**. Point it at this repository, compose path
   `infra/ghost/docker-compose.yml` (or paste the file in).
2. **Environment:** paste [.env.example](.env.example) and fill it in:
   - `MYSQL_ROOT_PASSWORD`, `GHOST_DB_PASSWORD`: new random values
     (`openssl rand -hex 24`). Keep them in a password manager.
   - `MAIL_PASSWORD`: a Resend API key with sending access, on a domain
     verified in Resend. Port 465 needs `MAIL_SECURE=true`; on 587 leave
     `MAIL_SECURE` empty (never `false`: Ghost reads it as text, and the text
     "false" counts as true).
   - Save. Saving alone restarts nothing.

## 3. Domain settings (Dokploy → the app → Domains)

| Field | Value |
| --- | --- |
| Service Name | `ghost` |
| Host | `blog.agentsdr.ai` |
| Path | `/` |
| Internal Path | `/` |
| Strip Path | **OFF** |
| Container Port | **2368** |
| HTTPS / Let's Encrypt | ON |

- **Container Port is 2368**, Ghost's port. The `3000` in the field is
  placeholder text.
- **Strip Path stays OFF.** Ghost listens on `/blog` and must receive
  `/blog/...` exactly as sent. Stripping it 404s the whole blog.

## 4. Deploy and check

Deploy. The first boot takes a minute or two: MySQL initialises, then Ghost
runs its migrations.

```bash
curl -sI https://blog.agentsdr.ai/blog/     # 200 from the origin
curl -sI https://agentsdr.ai/blog/          # 200 through the Next.js proxy
curl -s  https://agentsdr.ai/blog/ | grep -o '<link rel="canonical" href="[^"]*"'   # agentsdr.ai/blog
```

The `agentsdr.ai/blog` proxy needs the app deployed with the `rewrites()`
block; its origin is `https://blog.agentsdr.ai` unless `GHOST_ORIGIN` is set at
**build** time.

## 5. Set Ghost up

1. Open **https://agentsdr.ai/blog/ghost/** and create the owner account.
2. **Theme:** run `bun run build:blog-theme` in the repo, then Settings →
   Design & branding → Change theme → **Upload theme** →
   `blog-theme/dist/agentsdr-theme.zip` → **Activate** (uploading alone does
   nothing). Details: [blog-theme/README.md](../../blog-theme/README.md).
3. **Settings → General:** title "AgentSDR Blog", a real description (the
   default is "Thoughts, stories and ideas."), timezone, publication icon
   (`docs/assets/logo.svg` exported as PNG), and a cover image if you want one.
4. **Settings → Design & branding → Typography:** keep the theme defaults, or
   Ghost's picker overrides the theme's fonts.
5. Delete Ghost's sample "Coming soon" post.

## 6. Connect the publishing tool

1. Ghost admin → Settings → **Integrations** → Add custom integration.
2. Give the tool the **Admin API key** (`<id>:<secret>`) and the API URL
   **`https://blog.agentsdr.ai/blog`**: the origin directly. The
   `agentsdr.ai` route goes through the Next.js proxy, an extra hop that is the
   fragile path for multipart image uploads.
3. Have it send an explicit `slug` per post (URLs are permanent once indexed)
   and, for older articles, `published_at`.

---

## SEO

- Ghost generates the blog's own sitemap at `agentsdr.ai/blog/sitemap.xml`;
  `robots.txt` lists it beside the site's sitemap, and keeps crawlers out of
  `/blog/ghost/`. In Google Search Console you can also submit
  `blog/sitemap.xml` directly.
- Canonicals, Open Graph, Twitter cards and structured data per post come from
  Ghost's `{{ghost_head}}`, which the theme keeps.

---

## Back it up

Both volumes matter: a database without `ghost-content` is a blog with no
images.

```bash
docker compose exec db sh -c 'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" ghost' > ghost-$(date +%F).sql
docker run --rm -v <project>_ghost-content:/c -v "$PWD":/out alpine \
  tar czf /out/ghost-content-$(date +%F).tar.gz -C /c .
```

The volume name is prefixed with the Compose project name (`docker volume ls`).
Schedule both as a host cron job or a Dokploy scheduled task.

## Upgrading Ghost

`ghost:6-alpine` follows Ghost 6 minor releases on redeploy. Never jump a major
version in one step: back up, move to the next major, boot once (it migrates
the schema), then continue.

---

## Troubleshooting

**`dependency failed to start: container …-db-1 is unhealthy`.** Open the
`db` logs. "Database is uninitialized and password option is not specified"
means `MYSQL_ROOT_PASSWORD` reached the container empty: the variables were not
set, or saved without redeploying. Set them, delete the empty `…_ghost-db`
volume from the failed attempt, Redeploy.

**Every link reads `https://` with no domain.** `GHOST_HOST` is unset.

**The blog loads unstyled through agentsdr.ai.** A theme asset outside
`assets/built/`: the proxy maps other `/blog/assets/*` paths to Ghost admin.

**Admin at agentsdr.ai/blog/ghost/ is blank or redirects forever.** The app
was deployed without `skipTrailingSlashRedirect` or without the admin rewrites
in `next.config.ts`; both must stay.

**Invites and password resets never arrive.** SMTP: check `MAIL_*`, that the
`MAIL_FROM` domain is verified in Resend, and `MAIL_SECURE` (see step 2).
