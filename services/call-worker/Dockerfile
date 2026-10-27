# Build from the repo root:
#   docker build -f services/call-worker/Dockerfile -t agentsdr-call-worker .
# (Dokploy: build type Dockerfile, path services/call-worker/Dockerfile, context the repo root.)

# The recorder extension, built here from source: its dist/ is gitignored, so
# an image built from git (Dokploy) has no other copy. It needs only Bun, the
# extension, the call contracts it imports, and fflate.
FROM oven/bun:1 AS recorder
WORKDIR /app
COPY package.json ./
COPY extensions/whatsapp-recorder/ ./extensions/whatsapp-recorder/
COPY src/lib/calls/ ./src/lib/calls/
RUN mkdir -p node_modules && bun add --no-save fflate@0.8.3 && bun run build:recorder

FROM mcr.microsoft.com/playwright:v1.64.0-noble

RUN apt-get update \
 && apt-get install -y --no-install-recommends pulseaudio pulseaudio-utils xvfb unzip curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL https://bun.sh/install | BUN_INSTALL=/usr/local bash

WORKDIR /app/services/call-worker
COPY services/call-worker/package.json services/call-worker/bun.lock* ./
RUN bun install --frozen-lockfile || bun install
# CloakBrowser's binary (~200 MB) baked into the image; it caches under ~/.cloakbrowser.
RUN npx cloakbrowser install
# sing-box, for the call-audio tunnel (TUNNEL=true, src/tunnel.ts); checksum-pinned.
ARG SING_BOX_VERSION=1.14.2
ARG SING_BOX_SHA256=a684484d7477d1437282ee411f4d131d0340aaad60a7868841ebd5d87dd8a0c6
RUN curl -fsSL -o /tmp/sing-box.tar.gz "https://github.com/SagerNet/sing-box/releases/download/v${SING_BOX_VERSION}/sing-box-${SING_BOX_VERSION}-linux-amd64.tar.gz" \
 && echo "${SING_BOX_SHA256}  /tmp/sing-box.tar.gz" | sha256sum -c - \
 && tar -xzf /tmp/sing-box.tar.gz -C /tmp \
 && mv "/tmp/sing-box-${SING_BOX_VERSION}-linux-amd64/sing-box" /usr/local/bin/sing-box \
 && rm -rf /tmp/sing-box.tar.gz "/tmp/sing-box-${SING_BOX_VERSION}-linux-amd64"

COPY services/call-worker/ ./
# The worker imports types and shapes from the app's call contracts.
COPY src/lib/calls/ /app/src/lib/calls/
COPY --from=recorder /app/extensions/whatsapp-recorder/dist/ /app/extensions/whatsapp-recorder/dist/

ENV EXTENSION_PATH=/app/extensions/whatsapp-recorder/dist \
    PROFILES_DIR=/data/profiles \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    LAUNCHERS=gologin_sdk \
    KEEP_OPEN=3 \
    CLOAK_TIMEZONE=Asia/Kolkata
# /data/profiles holds the cloak/local launchers' browser profiles (WhatsApp's
# login, CloakBrowser's fingerprint). GoLogin keeps its profiles in its own
# cloud; its Orbita browser (~400 MB) downloads to /root/.gologin on first use —
# mount a volume there too, or every restart downloads it again.
VOLUME ["/data", "/root/.gologin"]

ENTRYPOINT ["./docker-entrypoint.sh"]
