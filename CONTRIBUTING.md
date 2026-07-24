# Contributing Guide

Thanks for helping build BuildMyStack! This document describes how to develop,
test, and validate changes. By contributing you agree to the
[Code of Conduct](CODE_OF_CONDUCT.md).

## Table of Contents

- [Your easiest first PR: add a catalog service](#your-easiest-first-pr-add-a-catalog-service)
- [Developer Certificate of Origin (sign-off)](#developer-certificate-of-origin-sign-off)
- [Branching & PRs](#branching--prs)
- [Development Setup](#development-setup)
- [Code Style Guidelines](#code-style-guidelines)
- [Testing Requirements](#testing-requirements)
- [CI/CD Pipeline](#cicd-pipeline)
- [Docker Deployment](#docker-deployment)

---

## Your easiest first PR: add a catalog service

The catalog is just seed data — adding a service is the friendliest way in, no
deep codebase knowledge required. Services live in `prisma/seed.ts`, grouped by
category (`dbServices`, `webServices`, `mediaServices`, `devServices`,
`monitoringServices`, `securityServices`, `productivityServices`). Copy the
nearest entry and adjust:

```ts
{
  name: 'PostgreSQL', slug: 'postgresql', image: 'postgres:18-alpine', version: '18',
  ports: [{ containerPort: 5432, protocol: 'tcp', description: 'PostgreSQL' }],
  env: [
    { name: 'POSTGRES_PASSWORD', description: 'Superuser password', required: true, secret: true },
    { name: 'POSTGRES_USER', description: 'Superuser name', required: false, secret: false, default: 'postgres' },
  ],
  volumes: [{ containerPath: '/var/lib/postgresql/data', description: 'Database data directory', named: true }],
  resources: { cpu: 0.5, memory: 512 },
},
```

Rules of thumb: pin a real image tag; mark every secret env `secret: true` and
every must-set env `required: true`; give data dirs a named volume; keep
`resources` realistic (they drive the "fits on my Pi" check). Then
`npm run db:seed`, add it to a stack in the builder, and export — if the compose
runs, your PR is good.

## Developer Certificate of Origin (sign-off)

BuildMyStack uses the [DCO](docs/DCO.md) instead of a CLA. Every commit must be
signed off, which certifies you wrote (or have the right to submit) the change:

```bash
git commit --signoff        # adds a "Signed-off-by: Your Name <you@example.com>" line
```

Use your real name and a reachable email. PRs with unsigned commits can't be
merged.

---

## Branching & PRs

### Branch Naming Convention

| Prefix | Purpose | Example |
|--------|---------|--------|
| `feat/` | New features | `feat/add-export-csv` |
| `fix/` | Bug fixes | `fix/scan-timeout` |
| `docs/` | Documentation | `docs/update-api` |
| `test/` | Test updates | `test/add-gitops-tests` |
| `chore/` | Maintenance | `chore/update-deps` |

### PR Process

1. Create feature branches from `develop`
2. Open Merge Requests to `develop`; GitLab CI gates must pass
3. Require at least 1 reviewer approval
4. Squash and merge after approval

### Commit Message Format (Conventional Commits)

```
<type>(<scope>): <description>

feat(security): add vulnerability trend analysis
fix(export): resolve Helm chart naming issue
docs(api): update authentication section
```

---

## Development Setup

### Prerequisites

- Node.js 18+ (LTS recommended)
- pnpm or npm
- Docker and Docker Compose
- Git

### Install & Develop

```bash
npm install
npm run dev
```

### Database Setup

```bash
npm run db:generate && npm run db:migrate && npm run db:seed
```

Or in one shot: `npm run setup:dev` (starts postgres+redis via Docker, then
generates + migrates). See [Development Setup Guide](docs/development/setup.md)
for details.

---

## Code Style Guidelines

### TypeScript

```typescript
// ✓ Use explicit types for functions
function processData(input: InputType): OutputType { ... }

// ✓ Use interfaces for object shapes
interface UserConfig {
  name: string;
  email: string;
}

// ✓ Use async/await over raw promises
async function fetchData(): Promise<Data> {
  return await api.get('/data');
}

// ✗ Avoid any type
// ✗ Avoid non-null assertions (!)
```

### Lint & Typecheck

```bash
npm run lint        # ESLint (warnings allowed)
npm run type-check  # TypeScript (must pass)
```

---

## Testing Requirements

### Coverage Targets

| Type | Target | Command |
|------|--------|--------|
| Unit | 95%+ | `npm run test:unit` |
| Integration | 90%+ | `npm run test:integration` |
| E2E | Critical paths | `npx playwright test` |

### Running Tests

```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# E2E (Chromium)
npx playwright test e2e-tests/services-offline-retry.spec.ts e2e-tests/services-axe.spec.ts --project=chromium

# With local DB enforcement
FORCE_DB_SETUP=true npm run test:unit
```

### Test File Naming

- Unit: `*.test.ts` or `*.spec.ts`
- Integration: `*.integration.test.ts`
- E2E: `*.e2e.test.ts`

---

## CI/CD Pipeline

### GitLab CI Stages

1. **quality** - Lint and typecheck
2. **unit** - Unit tests with coverage
3. **integration** - Integration tests
4. **e2e** - End-to-end tests (offline + accessibility)
5. **build** - Docker image build
6. **summary** - Pipeline summary

### Artifacts

- Playwright report: `playwright-report-ci/`
- Coverage report: `coverage/`

---

## Docker Deployment

### Build & Run

```bash
# Build
docker build -t build-my-stack:latest .

# Run
docker run -p 3000:3000 --env-file .env.local build-my-stack:latest
```

### Secrets Management

Use `*_FILE` pattern for secrets:
```bash
FOO_FILE=/run/secrets/FOO
```

### Image Size Check

```bash
docker image inspect build-my-stack:latest --format='{{.Size}}'
# Target: < 350MB
```

### Healthcheck

The image defines `HEALTHCHECK` on `/api/health`:
```bash
docker inspect --format='{{json .State.Health}}' $(docker ps -q -f name=build-my-stack)
```

---

## Getting Help

- **Questions / bugs**: open a GitHub issue (use the templates)
- **Security**: do not open a public issue — see [SECURITY.md](SECURITY.md)
  (security@buildmystack.dev)

Thank you for contributing!
