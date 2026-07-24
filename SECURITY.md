# Security Policy

## Reporting a vulnerability

Please report security issues **privately** — do not open a public issue.

Email **security@buildmystack.dev** with:

- a description of the issue and its impact,
- steps to reproduce (a proof of concept if you have one),
- the affected version / commit.

You will get an acknowledgement within **72 hours** and a triage assessment
within **14 days**. We will keep you updated as we work on a fix and will
credit you in the release notes unless you prefer to stay anonymous.

Please give us a reasonable window to release a fix before any public
disclosure.

## Supported versions

BuildMyStack is pre-1.0; only the latest `main` receives security fixes.

| Version | Supported |
| ------- | --------- |
| latest `main` | ✅ |
| older commits | ❌ |

## Threat model — what to look at first

BuildMyStack can hold real power over your infrastructure, so a few surfaces
matter more than the rest. If you are reviewing the code, start here:

- **The deploy bridge** (`server/ws-server.ts` `/deploy`, `src/lib/deploy/`).
  The WebSocket service mounts the Docker socket and can run `docker compose`
  locally or over SSH. It is guarded by a shared bearer token
  (`DEPLOY_BRIDGE_TOKEN`) and only ever operates on `bms-*` compose projects.
- **The stack terminal** (`server/terminal-executor.ts`). Docker-mode exec is
  gated on three checks at once: an authenticated next-auth session, stack
  ownership in the database, and a container name confined to the stack's own
  `bms-<stackId>-*` project.
- **Remote deploys over SSH** (`src/lib/deploy/remote-compose-executor.ts`).
  Key-based auth only (`BatchMode=yes`, `IdentitiesOnly=yes`); host and user
  are validated against a strict allowlist and passed as a single non-shell
  argv element; the private key stays server-side and is never logged.

## Hardening for operators

- Set a strong `DEPLOY_BRIDGE_TOKEN` (`openssl rand -hex 32`) or leave it empty
  to disable direct deploys entirely.
- Do not expose the WebSocket port (`3001`) to untrusted networks — it fronts
  the deploy bridge. Put it behind your reverse proxy / VPN.
- If you only compose and export, remove the Docker socket mount from the
  `websocket` service and set `TERMINAL_EXECUTOR=echo` — export and handoff
  keep working without it.
- Rotate `NEXTAUTH_SECRET` and the database password before going to
  production.
