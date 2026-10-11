# Build from the repo root:
#   docker build -f services/call-worker/Dockerfile -t agentsdr-call-worker .
FROM mcr.microsoft.com/playwright:v1.64.0-noble

RUN apt-get update \
 && apt-get install -y --no-install-recommends pulseaudio pulseaudio-utils xvfb unzip curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL https://bun.sh/install | BUN_INSTALL=/usr/local bash

WORKDIR /app/services/call-worker
COPY services/call-worker/package.json services/call-worker/bun.lock* ./
RUN bun install --frozen-lockfile || bun install

COPY services/call-worker/ ./
# The worker imports types from the app's contract files at build time only, but keep them for typechecking.
COPY src/lib/calls/ /app/src/lib/calls/
# Build the extension first (bun run build:recorder) so dist/ exists.
COPY extensions/whatsapp-recorder/dist/ /app/extensions/whatsapp-recorder/dist/

ENV EXTENSION_PATH=/app/extensions/whatsapp-recorder/dist \
    PROFILES_DIR=/data/profiles \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    LAUNCHERS=local,gologin_sdk,gologin_cloud
VOLUME /data

ENTRYPOINT ["./docker-entrypoint.sh"]
