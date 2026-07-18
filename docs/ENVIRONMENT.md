# Environment Configuration Guide

This document explains environment variables and configuration for local development, staging, and production.

- Load order (local): `.env.local` -> process.env
- Load order (production): Docker secrets for sensitive values (see DEPLOYMENT.md), env vars for non-sensitive config

Application
- NODE_ENV: development|test|production
- PORT: App port (default 8080)
- LOG_LEVEL: debug|info|warn|error (default info)
- LOG_FORMAT: json|pretty (default json)

Database (non-sensitive)
- DB_HOST, DB_PORT, DB_NAME, DB_USER
- DATABASE_URL: Prisma connection URL; used by Prisma CLI and runtime when provided

Database secret (sensitive)
- DB_PASSWORD via Docker secret db_password (fallback: DB_PASSWORD env)

Redis
- REDIS_HOST, REDIS_PORT (non-sensitive)
- REDIS_PASSWORD via Docker secret redis_password (fallback: REDIS_PASSWORD env)

JWT
- JWT_SECRET via Docker secret jwt_secret (fallback: JWT_SECRET env)

Other (optional)
- OPENAI_API_KEY, ANTHROPIC_API_KEY, SENTRY_DSN
- CORS_ALLOWED_ORIGINS, FEATURE_FLAGS_PROVIDER, AI_CACHE_ENABLED, AI_CACHE_TTL, RATE_LIMITING_ENABLED

Audit log archival storage
- AUDIT_S3_BUCKET: S3 bucket name for audit archives (production)
- AUDIT_S3_REGION: AWS region for S3 client (e.g., us-east-1)
- AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY: Credentials for S3 access (optional in dev; required in prod)

Notes:
- If AWS SDK or credentials are unavailable, the system falls back to local storage at ./audit-archives and ./audit-archives/s3-fallback
- Encryption uses AUDIT_ENCRYPTION_KEY (optional; set via secret in production)

Recommended files
- .env.local: development overrides for non-sensitive values
- Docker secrets: secrets/db_password.txt, secrets/redis_password.txt, secrets/jwt_secret.txt, secrets/audit_encryption_key.txt
