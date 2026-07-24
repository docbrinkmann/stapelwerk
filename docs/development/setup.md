# Development Environment Setup Guide

**Last Updated:** 2025-12-05  
**Spec Reference:** Phase 4.1 - Developer Documentation

---

## Prerequisites

Before setting up the development environment, ensure you have:

- **Node.js:** v18.17.0 or higher (LTS recommended)
- **npm:** v9.0.0 or higher
- **PostgreSQL:** v16 or higher
- **Docker:** v24.0 or higher (optional, for containerized development)
- **Git:** v2.40 or higher

### Optional Tools

- **Redis:** v7.0 or higher (for caching in development)
- **ArgoCD CLI:** v2.9+ (for GitOps development)
- **Pulumi CLI:** v3.100+ (for IaC development)

---

## Quick Start

### 1. Clone the Repository

```bash
git clone https://gitlab.minilab.live/sebastian/stapelwerk.git
cd stapelwerk
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your local configuration:

```bash
# Required
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/stapelwerk?schema=public"
NEXTAUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"

# Optional (for full feature set)
REDIS_URL="redis://localhost:6379"
ARGOCD_SERVER_URL="https://argocd.example.com"
PULUMI_ACCESS_TOKEN="pul-xxxx"
OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:4318"
```

### 4. Setup Database

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database (development)
npm run db:push

# Or run migrations (production-like)
npm run db:migrate
```

### 5. Start Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

---

## Project Structure

```
stapelwerk/
├── src/
│   ├── app/                 # Next.js App Router pages
│   ├── components/          # React components
│   ├── lib/                 # Utility libraries
│   │   ├── api/            # API utilities
│   │   ├── deploy/         # Deployment generators (Helm, Kustomize)
│   │   ├── generator/      # YAML/K8s generators
│   │   ├── gitops/         # ArgoCD integration
│   │   ├── infrastructure/ # Pulumi IaC
│   │   └── monitoring/     # OpenTelemetry
│   ├── server/             # tRPC server
│   │   ├── routers/        # API routers
│   │   └── trpc.ts         # tRPC configuration
│   └── __tests__/          # Test files
├── prisma/
│   └── schema.prisma       # Database schema
├── docs/                   # Documentation
├── k8s/                    # Kubernetes manifests
└── scripts/                # Deployment scripts
```

---

## Development Workflows

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- --run src/__tests__/lib/gitops/argocd-client.test.ts

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm test -- --watch
```

### Type Checking

```bash
# Check TypeScript types
npm run typecheck
```

### Linting

```bash
# Run ESLint
npm run lint

# Fix auto-fixable issues
npm run lint:fix
```

### Database Management

```bash
# Generate Prisma client after schema changes
npm run db:generate

# Push schema changes (development only)
npm run db:push

# Create a migration
npx prisma migrate dev --name your_migration_name

# View database in Prisma Studio
npx prisma studio
```

---

## API Development

### tRPC Router Structure

All API endpoints are defined in `src/server/routers/`. Each router follows this pattern:

```typescript
// src/server/routers/example.ts
import { z } from 'zod';
import { createTRPCRouter, publicProcedure, protectedProcedure } from '../trpc';

export const exampleRouter = createTRPCRouter({
  // Public endpoint
  list: publicProcedure
    .input(z.object({ limit: z.number().optional() }))
    .query(async ({ input, ctx }) => {
      // Implementation
    }),

  // Protected endpoint (requires authentication)
  create: protectedProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // Implementation
    }),
});
```

### Adding a New Router

1. Create router file in `src/server/routers/`
2. Add router to `src/server/root.ts`
3. Write tests in `src/__tests__/server/routers/`

---

## Docker Development

### Using Docker Compose

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down
```

### Building Production Image

```bash
docker build -t stapelwerk:latest .
```

---

## Environment Variables Reference

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Yes | - |
| `NEXTAUTH_SECRET` | Session encryption secret | Yes | - |
| `NEXTAUTH_URL` | Application URL | Yes | - |
| `REDIS_URL` | Redis connection string | No | - |
| `ARGOCD_SERVER_URL` | ArgoCD server URL | No | - |
| `ARGOCD_AUTH_TOKEN` | ArgoCD authentication token | No | - |
| `PULUMI_ACCESS_TOKEN` | Pulumi Cloud access token | No | - |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OpenTelemetry endpoint | No | - |
| `OTEL_SERVICE_NAME` | Service name for tracing | No | `stapelwerk` |

See `.env.example` for a complete list.

---

## Troubleshooting

### Database Connection Issues

If you encounter database connection errors:

1. Ensure PostgreSQL is running
2. Verify `DATABASE_URL` is correct
3. Check network/firewall settings

```bash
# Test database connection
npx prisma db push --accept-data-loss
```

### Type Errors After Schema Changes

```bash
# Regenerate Prisma client
npm run db:generate

# Restart TypeScript server in your IDE
```

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>
```

---

## IDE Setup

### VS Code Extensions (Recommended)

- Prisma
- ESLint
- Prettier
- Tailwind CSS IntelliSense
- GitLens

### VS Code Settings

Add to `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "typescript.preferences.importModuleSpecifier": "relative"
}
```

---

## Getting Help

- **Documentation:** `/docs` directory
- **API Reference:** `/docs/API.md`
- **Issues:** GitLab Issues
- **Team Chat:** Internal Slack/Teams

---

## Next Steps

After setting up your environment:

1. Read the [API Guide](../api/api-guide.md)
2. Review the [Architecture](../ARCHITECTURE.md)
3. Check the [Contributing Guidelines](../../CONTRIBUTING.md)
