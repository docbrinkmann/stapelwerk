# Stapelwerk

**Your Jellyfin + \*arr media server, composed and checked before you deploy — wired right the first time.**

AGPL-3.0 · a self-hosted build has every feature, no gates.

> **Why "Stapelwerk"?** *(SHTAH-pel-verk)* — **Stapel** is German for **stack**, and a **Stapellauf** is the moment a shipyard launches a correctly built ship. Stapelwerk is the works where your stack gets built, checked and verified — *before* it launches.

Stapelwerk is a guided Docker stack builder for self-hosters. You pick a use case — say, a media server (Jellyfin + Sonarr / Radarr / Prowlarr + qBittorrent + Gluetun) — and it composes the services, checks that they actually fit together (compatibility, resource budget, port collisions, and whether your download client is genuinely confined to the VPN), and hands you a clean `docker-compose.yml` you can run anywhere.

It's the step *between* a deploy panel and an LLM: Coolify / Portainer / Dokploy deploy what you already chose; an LLM types a compose that looks right and dies on the first real edge case. Stapelwerk decides what belongs together, checks that it fits, then gives you the file.

## The one thing it gets right: the VPN kill-switch

The classic media-stack mistake is running a torrent client next to a VPN container but not actually routing its traffic through the tunnel — so the moment the VPN drops, your real IP leaks. Stapelwerk encodes the fix once and verifies it on every build:

- the download client runs *inside* the VPN container's network namespace (`network_mode: service:gluetun`), publishes **no ports of its own**, and `depends_on` the gateway;
- Gluetun gets `cap_add: [NET_ADMIN]` + `/dev/net/tun` and owns the routed ports;
- if a build has a download client and a VPN but isn't routed, the builder raises a hard **"VPN leak"** error with the exact fix — before deploy, not at 2 a.m.

```
# Media server · composed & checked
jellyfin       ✓ ready
sonarr radarr  ✓ ready    prowlarr ✓ linked
qbittorrent    ✗ not routed through gluetun — your IP would leak
port 8096      ✗ collides with another service → remap
resources      ✓ fits your Pi 4 (3.1 / 4 GB)
# fix the 2 flags → export a compose that actually boots
```

## Self-hosting (5-minute quickstart)

Requirements: Docker with the compose plugin, ~2 GB RAM.

```bash
git clone <repo-url> stapelwerk && cd stapelwerk
cp .env.example .env
# edit .env: set POSTGRES_PASSWORD and NEXTAUTH_SECRET (openssl rand -base64 32),
# and pick SEED_DEMO_PASSWORD — it becomes your login password
docker compose -f docker-compose.selfhost.yml up -d --build
docker compose -f docker-compose.selfhost.yml --profile setup run --rm migrate
```

Open http://localhost:3000 and log in as `demo@stapelwerk.dev` with your
`SEED_DEMO_PASSWORD`. (There is no public sign-up; the seed creates your user.)

Serving on a LAN name or domain? Set `NEXTAUTH_URL`, `NEXT_PUBLIC_APP_URL`,
`NEXT_PUBLIC_WS_URL` and `ALLOWED_ORIGINS` in `.env` accordingly before
building — the two `NEXT_PUBLIC_*` values are baked into the client bundle.

**Security note:** the `websocket` service mounts the Docker socket so
"deploy to this server" and the stack terminal work. Both are gated on an
authenticated session and stack ownership, but the socket is root-equivalent
on the host — remove the mount and set `TERMINAL_EXECUTOR=echo` in `.env` if
you only want composing and export. See [SECURITY.md](SECURITY.md).

**Self-host promise:** a self-hosted Stapelwerk has **all features, no
gates**. Plan limits and billing exist only on the hosted instance and are
never part of the self-host experience.

## Development

```bash
npm install
npm run setup:dev                 # starts Postgres + Redis, generates the Prisma client, runs migrations
npm run dev                       # http://localhost:3000
npm run dev:ws                    # runs `dev` + the live-logs/terminal WebSocket server together
npm run dev:docker                # or the whole stack in Docker — app on http://localhost:3999
```

- Environment variables: [`.env.example`](.env.example), [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md)
- Production: the [`docker/`](docker/) compose files + [`Dockerfile`](Dockerfile), guided by [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)
- Deploying a composed stack: [`docs/deployment/direct-apply-ui.md`](docs/deployment/direct-apply-ui.md), [`docs/api/deployments.md`](docs/api/deployments.md)

## Features

- **Guided composer** — a curated catalog and use-case templates (the Media Server template ships pre-wired) compose a working set of services, not a blank file.
- **The checked graph** — live compatibility, resource-budget, required-dependency and port-collision checks that run *before* you deploy.
- **Kill-switch verified by construction** — Gluetun routing verified, not just present (above).
- **You own the output** — a secret-secured `docker-compose.yml` you run anywhere, with handoff guides for **Coolify / Portainer / Dokploy / Openship**. No lock-in.
- **Key-sovereign deploy** — the bundle ships a `deploy.sh` that runs on **your** machine and drives **your** server over **your** own SSH (`./deploy.sh user@host`); your machine is the control plane, so we never see the host or hold the key. The builder blocks a deploy whose kill-switch config would leak. (A self-hosted build can also drive deploys server-side from its own Docker socket / SSH key — that's your instance holding your own key.)
- **Community marketplace** — share and import stacks.
- **English & German UI.**

Composing, checking and exporting are **free forever**.

## How it's built

Next.js (App Router) + **tRPC v11** + **Prisma / PostgreSQL**, TypeScript throughout. Client state in Zustand, server state via TanStack Query over tRPC; UI is shadcn/ui-style (Radix + Tailwind v4). A standalone WebSocket server (`server/ws-server.ts`) powers live logs and the container terminal; Redis for caching. See [`CLAUDE.md`](CLAUDE.md) for the full architecture tour.

## Open-core & pricing

Stapelwerk is **AGPL-3.0 open-core**. A self-hosted build has **every feature and zero gates** — plan limits only activate on the hosted instance, behind `BILLING_ENABLED` (unset by default → unlimited; see [`src/lib/plans.ts`](src/lib/plans.ts)).

Monetization is **patronage + one-time outcomes, not a monthly SaaS**:

- **Free forever** — compose, check, export.
- **Verified deploy — €29 once** — a provenance-signed report that your stack is deploy-safe by construction: the VPN kill-switch confines the download client (no real-IP leak if the tunnel drops), plus a safety audit — no datastore exposed on the host network, datastores keep their data, no default secrets, images pinned. Verifiable with our public key. You keep and run the compose yourself — free forever; the €29 buys the signed proof, not a hosted deploy (we never hold your keys). Optionally fold in a one-command runtime attestation you run on your own Docker.
- **Supporter — €99 / year** — funds development (signed builds, your name in `SUPPORTERS`). A thank-you, not a feature unlock.

(Monthly Pro / Fleet tiers exist in-app, but they aren't the pitch.)

## Contributing

Contributions are welcome — easiest first PR: service metadata for the catalog. See [`CONTRIBUTING.md`](CONTRIBUTING.md) for dev setup, Conventional Commits, branch naming and coverage targets. Contributions are accepted under the Developer Certificate of Origin — see [`docs/DCO.md`](docs/DCO.md) and sign your commits with `git commit --signoff`.

Gates before "done":

```bash
npm run type-check     # must be 0
npm run lint           # 0 errors; warnings tolerated
npm run test:unit      # unit suite (no Postgres needed)
npm run test:integration
```

CI runs on GitLab pipelines: **quality → unit → integration → e2e → build**.

## Security

Please report vulnerabilities privately — see [SECURITY.md](SECURITY.md) for the disclosure process (**security@stapelwerk.dev**, reproduction steps appreciated). Don't open a public issue for security bugs.

## License

Stapelwerk is free software, licensed under the **GNU Affero General Public
License v3.0 only** (AGPL-3.0-only) — see [LICENSE](LICENSE).
Copyright (C) 2026 Sebastian Schmidt.

The entire application is open source; running a self-hosted build unlocks every feature.

## Status & scope

- **Focus:** the media / \*arr vertical is the beachhead — the Gluetun kill-switch checks are wired and covered by tests. Version `0.1.0`.
- **Not a deploy panel.** Stapelwerk composes and checks, then hands off; always-on host management is Coolify / Dokploy / Openship territory. Direct deploy is an optional convenience, not the product: the key-sovereign `deploy.sh` runs from *your* machine over *your* SSH, and the managed server-side path (Pro/Fleet) uses *our* deploy key that you authorize on your host — we never hold *your* key either way.
- **No "kept current" / scheduled CVE re-checks** — that feature does not exist; the checks run at compose time.
- **Roadmap:** the runtime attestation (booting the stack and confirming traffic actually dies when the VPN drops) runs on local-socket deploys; extending it to remote/SSH deploys is next. The compose-time checks verify the *configuration* — see the honest scope in `LAUNCH-RUNBOOK.md`.
