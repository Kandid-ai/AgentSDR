# Stage 1: Install dependencies
FROM oven/bun:1-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Stage 2: Build the Next.js app
FROM oven/bun:1-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

# Stage 3: Lean production image
FROM oven/bun:1-alpine AS runner
WORKDIR /app

LABEL org.opencontainers.image.title="AgentSDR" \
      org.opencontainers.image.description="Open-source AI sales development platform" \
      org.opencontainers.image.source="https://github.com/Kandid-ai/AgentSDR" \
      org.opencontainers.image.licenses="MIT"

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# curl is needed for the external cron jobs (build-queue, mailboxes/watch)
# that run via `docker exec ... curl ...` against this container.
RUN apk add --no-cache curl

RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
# Fresh-install schema and its setup script (`bun scripts/db/setup.ts`,
# run by the Compose `setup` service). `postgres` is already in the
# standalone node_modules, which is all the script imports.
COPY --from=builder --chown=nextjs:nodejs /app/db ./db
COPY --from=builder --chown=nextjs:nodejs /app/scripts/db/setup.ts ./scripts/db/setup.ts

# Entrypoint: generates the secrets on first start into /var/lib/agentsdr and
# maps APP_URL, so the image runs with no .env (see docker/entrypoint.sh).
# The directory is owned by nextjs so a fresh named volume mounted there
# inherits that and stays writable.
COPY docker/entrypoint.sh /usr/local/bin/agentsdr-entrypoint
# The cron sidecar runs from this same image (busybox crond + curl).
COPY docker/cron/crontab /etc/agentsdr/crontab
COPY docker/cron/entrypoint.sh /etc/agentsdr/cron-entrypoint.sh
RUN chmod 755 /usr/local/bin/agentsdr-entrypoint /etc/agentsdr/cron-entrypoint.sh \
 && mkdir -p /var/lib/agentsdr && chown nextjs:nodejs /var/lib/agentsdr

USER nextjs
EXPOSE 3000

ENTRYPOINT ["agentsdr-entrypoint"]
CMD ["bun", "server.js"]
