# syntax=docker/dockerfile:1

# pagecast — preview & publish HTML reports.
#
# This image bundles the full `pagecast` CLI, so a single image both serves the
# admin dashboard (`serve`, the default command) AND runs every publish/deploy
# subcommand. The dashboard and the CLI are the same program — installing one
# installs both.
#
# Base is Node 22 (current LTS): pagecast needs >=20, and a pinned wrangler needs
# >=22, so 22 satisfies both.
FROM node:22-slim

# wrangler is the Cloudflare CLI that pagecast shells out to for publishing and
# deploys. Bake a pinned version into the image so deploys are reproducible and
# don't fetch wrangler over the network on first use. Pin exactly (no `latest`,
# no `^`) per supply-chain hygiene; bump deliberately. `npx wrangler` inside the
# app resolves this globally-installed binary instead of downloading one.
ARG WRANGLER_VERSION=4.101.0
RUN npm install --global --no-audit --no-fund "wrangler@${WRANGLER_VERSION}" \
  && npm cache clean --force

WORKDIR /app

# pagecast has zero runtime npm dependencies, so there is nothing to `npm install`
# for the app itself — copy only the files the CLI needs at runtime. Own them as
# the unprivileged `node` user (uid 1000, shipped with the base image).
COPY --chown=node:node package.json llms.txt ./
COPY --chown=node:node src/ ./src/
COPY --chown=node:node public/ ./public/
COPY --chown=node:node feedback/ ./feedback/

# Pre-create the state dir and hand /app to `node` so the unprivileged process
# can write .pagecast when no volume is mounted (and with a named volume, which
# inherits this ownership). A bind mount uses the host dir's ownership instead.
RUN mkdir -p /app/.pagecast && chown -R node:node /app

# Inside a container the servers must listen on all interfaces for Docker port
# mapping to reach them; outside Docker the default stays 127.0.0.1. ALWAYS map
# these ports to the host's loopback only (see docker-compose.yml) — the admin
# API is unauthenticated and can run shell commands.
ENV HOST=0.0.0.0 \
    PORT=4173 \
    PUBLIC_PORT=4174

EXPOSE 4173 4174

# Liveness probe for the `serve` workflow: the admin server answers loopback
# requests (Host: localhost passes its DNS-rebinding guard). Uses node directly
# so the slim image needs no curl/wget.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||4173)+'/',r=>process.exit(r.statusCode<500?0:1)).on('error',()=>process.exit(1))"

# Drop root: the admin API is unauthenticated and can run shell commands, so the
# runtime process runs as the unprivileged `node` user. Ports 4173/4174 are
# >1024, so no privilege is needed to bind them.
USER node

# Absolute path so the CLI works even when callers override the working dir,
# e.g. `docker run -v "$PWD:/work" -w /work pagecast publish ./report.html`.
ENTRYPOINT ["node", "/app/src/cli.js"]
CMD ["serve"]
