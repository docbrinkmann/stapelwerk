# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

BuildMyStack — a guided Docker stack builder (web UI for composing/deploying curated self-hosted service stacks). Next.js App Router + tRPC + Prisma/PostgreSQL, TypeScript throughout.

## Commands

```bash
npm run dev              # dev server — uses --webpack; keep the flag (Turbopack not validated for this build's webpack config)
npm run build            # next build --webpack + tsc --noEmit
npm run type-check       # must pass; lint warnings are tolerated, type errors are not
npm run lint / lint:fix

# Tests (Vitest, jsdom)
npm test                 # watch mode
npm run test:unit        # excludes api/e2e/integration/security suites
npm run test:integration
npx vitest run src/components/__tests__/ServiceCard.test.tsx   # single file
npx vitest run -t "test name"                                  # single test by name

# E2E / browser
npm run test:playwright  # playwright.config.ts
npm run test:e2e         # tsx-driven simple e2e runner

# Database (Prisma)
npm run db:generate / db:migrate / db:push / db:seed / db:studio
npm run dev:services     # start just postgres + redis via docker-compose
npm run setup:dev        # services + generate + migrate in one shot
```

Docker dev: `npm run dev:docker` runs the full stack; app is exposed on **localhost:3999** (→3000 in container), with postgres and redis services.

## Testing gotchas

- Vitest aliases `@prisma/client` to `src/__tests__/harness/prisma-client-proxy.ts` (see `vitest.config.ts` resolve.alias). Tests never import the real generated client directly.
- Integration tests hit a real Postgres: `build_my_stack_test` DB (default URL is baked into `vitest.config.ts`; override with `DATABASE_TEST_URL`). Unit tests without Postgres: leave `FORCE_DB_SETUP=false` (the default) and use `test:unit`.
- Tests run sequentially (`pool: 'forks'`, `maxConcurrency: 1`) because of DB-heavy suites — don't "fix" slowness by parallelizing.
- Coverage thresholds are 95% global (90% for `src/app/`).

## Architecture

- **API is tRPC v11, not REST.** Every domain router lives in `src/server/routers/` and is composed in `src/server/root.ts` (`appRouter`, 15 routers: admin, analytics, categories, community, health, imports, monitoring, recommendations, services, stacks, templates, deployments, logs, terminal, users). Context/procedures in `src/server/trpc.ts` (`publicProcedure` / `protectedProcedure` (auth) / `adminProcedure` (auth + role==='admin')). Client wiring in `src/trpc/` (React Query based). To add an endpoint: create/extend a router, register it in `root.ts`, consume via the typed client — no route handlers needed.
- **Database:** Prisma schema at `prisma/schema.prisma` (~80 snake_case models — stacks, services, deployments, organizations, feature flags, audit/compliance, alerting). PostgreSQL only.
- **Real-time:** a standalone WebSocket server (`server/ws-server.ts`, port 3001, run via `npm run ws:dev` alongside `dev` or `npm run dev:ws` for both) delegates to `src/server/ws/` handlers. Powers live logs (`src/components/logs/`) and the terminal (`src/components/terminal/`, xterm.js); the pages wire the WS directly (no shared hook). Terminal docker-mode execs a real shell into a stack's own `bms-<stackId>-*` compose containers, ownership-gated (`server/terminal-executor.ts`).
- **Auth:** next-auth with JWT session strategy (`src/lib/auth.ts`).
- **UI:** shadcn/ui-style components in `src/components/ui/` (Radix + Tailwind 4 + CVA), Zustand for client state, TanStack Query via tRPC for server state. An App Router migration is in progress: new pages go in the `src/app/(dashboard)/` route group; `src/app/dashboard/` is the legacy layout. Both share the sidebar shell from `src/components/layout/dashboard-shell.tsx`; the marketing header is toggled by route prefix in `src/app/providers-root.tsx`.
- **Styling:** Tailwind CSS v4, CSS-first. ALL design tokens (colors incl. `success`/`warning`/`info`, radius, animations, fluid scales) live in `src/app/globals.css` via `@theme` blocks; `tailwind.config.ts` is a dead stub — don't add theme config there. PostCSS pipeline is `postcss.config.cjs` → `@tailwindcss/postcss`. Use token classes (`bg-card`, `text-muted-foreground`, `text-success`, …), never raw grays like `text-gray-600`/`bg-white` — they break class-based dark mode. v4 gotcha: arbitrary CSS vars need `var()` (`w-[var(--x)]`, not `w-[--x]`).
- **Path aliases:** `@/*` → `src/*`, `~/*` → repo root.
- **Deploy path:** the `deployments` router generates a real compose file (`src/lib/stack-persistence.ts` → `generateComposeWithSecrets`) and runs it on the local Docker socket or a remote host over SSH (key-based) via the ws bridge. No Pulumi/K8s generators (that enterprise facade was removed).

## Agent OS

Product docs (mission, roadmap, tech-stack) live in `agent-os/product/`; feature specs in `agent-os/specs/`. The `.cursor/rules/*.mdc` files just delegate to these Agent OS instructions. Use the spec workflow (create-spec → create-tasks → execute-tasks) for larger features.

## Conventions

- Conventional Commits (`feat(scope): …`); branches `feat/`, `fix/`, `docs/`, `test/`, `chore/`.
- Primary remote is GitLab (`gitlab.minilab.live`); CI is GitLab pipelines (quality → unit → integration → e2e → build). Feature branches come from `develop`, MRs target `develop`.
- Avoid `any` and non-null assertions; explicit return types on functions.

## Execution discipline (coding-craft — always on in this repo)

Apply on every coding task here. Full skill: `~/.claude/skills/coding-craft/SKILL.md`.

Loop: **ORIENT → PLAN → IMPLEMENT → VERIFY → REPORT** — don't skip a phase.

- **Gates before "done":** run them and read the output — `npm run type-check` (must be 0), `npm run lint` (0 errors; warnings tolerated), the relevant Vitest suite (quote its summary line). Never conclude over a red gate — fix it or make it the headline.
- **Edit, don't rewrite** — smallest diff; never reformat lines you didn't change; don't "improve" neighbouring code unasked.
- **Grep before you create** — reuse existing helpers/types/tokens/keys; don't re-mint duplicates or guess imports. Missing primitive → ask, don't invent a plausible substitute.
- **Copy the neighbour** — the adjacent file/test/router of the same kind is the template for shape, imports, naming.
- **Evidence over plausibility** — every "works / fixed / deployed" maps to a proof you actually ran: a RED→GREEN repro for bugs; the real end-to-end flow for features; query the authoritative system for "deployed/migrated". A **200 on a page shell is NOT proof its client queries work** (see 2026-07-06: the `stacks.envVars` prod drift + the "Get Started → login" bug both slipped past a shell-status smoke test).
- **Non-trivial new logic leaves ONE runnable check behind** (a test or assert-based self-check).
- **Prefer the reversible action;** destructive/irreversible ops (deletes, prod DB migrations, force-push) need explicit approval + a stated rollback.
- **Report honestly** — what ran, what didn't (why + risk); a failing test is reported with its output, not hidden.
