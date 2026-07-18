# Deployment Guide

Quick start for production:
```
./scripts/setup-production.sh
./scripts/validate-deployment.sh --quick
```

## Prerequisites

### Required Software
- **Docker** 20.10+ with Swarm mode enabled
- **Docker Compose** 3.8+
- **Node.js** 20+
- **PostgreSQL** 18-alpine
- **Redis** 7-alpine
- **Nginx** alpine

## Database Configuration

### PostgreSQL 18

This project uses **PostgreSQL 18-alpine** for all environments (development, staging, and production).

**Version:** `postgres:18-alpine`

#### Key Features of PostgreSQL 18
- Improved performance for concurrent workloads
- Enhanced query optimization
- Better JSON processing
- Improved vacuum performance

#### Configuration

The database is configured in `docker/docker-compose.prod.yml`:

```yaml
postgres:
  image: postgres:18-alpine
  environment:
    - POSTGRES_DB=buildmystack_prod
    - POSTGRES_USER=buildmystack_user
    - POSTGRES_PASSWORD_FILE=/run/secrets/db_password
```

## Docker Secrets Management

### Overview

All sensitive credentials are managed using Docker Swarm secrets:
- Database password
- Redis password
- JWT secret

### Secret Setup

1. **Generate secrets:**
   ```bash
   mkdir -p secrets
   openssl rand -base64 32 > secrets/db_password.txt
   openssl rand -base64 32 > secrets/redis_password.txt
   openssl rand -hex 64 > secrets/jwt_secret.txt
   chmod 600 secrets/*
   ```

2. **Secrets are mounted at `/run/secrets/` in containers**

3. **Application reads secrets via `src/lib/config.ts`:**
   ```typescript
   import { getSecret } from '@/lib/config';
   
   const dbPassword = getSecret('db_password', 'DB_PASSWORD');
   ```

### Secret Rotation

To rotate secrets in production:

1. Generate new secret:
   ```bash
   openssl rand -base64 32 > secrets/db_password_new.txt
   ```

2. Create new Docker secret:
   ```bash
   docker secret create db_password_v2 secrets/db_password_new.txt
   ```

3. Update service:
   ```bash
   docker service update --secret-rm db_password --secret-add source=db_password_v2,target=db_password buildmystack-ai
   ```

4. Remove old secret:
   ```bash
   docker secret rm db_password_v1
   ```

## Environment Variables

### Production Environment

Required environment variables are defined in `docker-compose.prod.yml`:

- `NODE_ENV=production`
- `DB_HOST` - Database hostname
- `DB_NAME` - Database name
- `DB_USER` - Database user
- `REDIS_HOST` - Redis hostname
- `REDIS_PORT` - Redis port

Secrets are read from `/run/secrets/`:
- `db_password`
- `redis_password`
- `jwt_secret`

### Development Environment

For development, create `.env.local`:

```bash
DB_HOST=localhost
DB_NAME=buildmystack
DB_USER=buildmystack_user
DB_PASSWORD=your_dev_password
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
JWT_SECRET=your_jwt_secret
```

## Deployment Steps

### 1. Initial Setup

```bash
# Clone repository
git clone <repository-url>
cd build-my-stack

# Install dependencies
npm install

# Generate secrets
./scripts/generate-secrets.sh
```

### 2. Database Migration

```bash
# Run migrations
npx prisma migrate deploy

# Seed database
npx prisma db seed
```

### 3. Start Services

```bash
# Production deployment
cd docker
docker-compose -f docker-compose.prod.yml up -d

# Verify services
docker-compose -f docker-compose.prod.yml ps
```

### 4. Verification

```bash
# Check application health
curl http://localhost:8080/health

# Check database connection
docker exec buildmystack-postgres-prod pg_isready -U buildmystack_user

# Check Redis connection
docker exec buildmystack-redis-prod redis-cli ping
```

## Monitoring

### Services

- **Application:** http://localhost:8080
- **Prometheus:** http://localhost:9090
- **Grafana:** http://localhost:3000
- **Nginx:** http://localhost (80) / https://localhost (443)

### Health Checks

All services include health checks:
- Application: `/health` endpoint
- PostgreSQL: `pg_isready`
- Redis: `redis-cli ping`
- Nginx: `nginx -t`

## Troubleshooting

### Database Connection Issues

```bash
# Check PostgreSQL logs
docker logs buildmystack-postgres-prod

# Verify password secret
docker exec buildmystack-ai-prod cat /run/secrets/db_password

# Test connection
docker exec buildmystack-postgres-prod psql -U buildmystack_user -d buildmystack_prod -c "SELECT version();"
```

### Secret Access Issues

```bash
# List available secrets
docker secret ls

# Inspect service secrets
docker service inspect buildmystack-ai --format '{{json .Spec.TaskTemplate.ContainerSpec.Secrets}}'
```

## Security

### Best Practices

1. **Never commit secrets to version control**
2. **Rotate secrets regularly** (every 90 days minimum)
3. **Use strong random values** for all secrets
4. **Limit secret access** to necessary services only
5. **Monitor secret access** via audit logs

### Security Headers

Nginx is configured with comprehensive security headers:
- Content-Security-Policy
- Strict-Transport-Security
- X-Frame-Options
- X-Content-Type-Options

See `docker/nginx/conf.d/security-headers.conf` for details.

## Updates

### PostgreSQL Version

The project uses **PostgreSQL 18-alpine**. To update:

1. Update `docker-compose.prod.yml`:
   ```yaml
   image: postgres:18-alpine
   ```

2. Test migrations:
   ```bash
   docker run --rm postgres:18-alpine psql --version
   ```

3. Run migration tests before deploying

## Support

For deployment issues:
1. Check logs: `docker-compose -f docker-compose.prod.yml logs`
2. Verify health: `./scripts/validate-deployment.sh`
3. Review documentation in `docs/`

---

**Last Updated:** 2025-10-26  
**PostgreSQL Version:** 18-alpine  
**Docker Compose Version:** 3.8
