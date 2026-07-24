#!/bin/bash
# Setup Production Environment Variables
# This script helps generate a .env.production file with secure secrets

set -e

echo "🔐 Stapelwerk - Production Environment Setup"
echo "=============================================="
echo ""

# Check if .env.production already exists
if [ -f .env.production ]; then
    echo "⚠️  WARNING: .env.production already exists!"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Aborted. Existing file preserved."
        exit 1
    fi
fi

# Generate secrets
echo "🔑 Generating secure secrets..."
NEXTAUTH_SECRET=$(openssl rand -base64 32)
POSTGRES_PASSWORD=$(openssl rand -base64 32)

echo "✅ Secrets generated!"
echo ""

# Collect configuration
echo "📝 Please provide the following information:"
echo ""

# GitLab Registry
read -p "GitLab Registry URL [registry.gitlab.minilab.live]: " CI_REGISTRY
CI_REGISTRY=${CI_REGISTRY:-registry.gitlab.minilab.live}

read -p "GitLab Username: " GITLAB_USERNAME
if [ -z "$GITLAB_USERNAME" ]; then
    echo "❌ GitLab username is required"
    exit 1
fi

CI_REGISTRY_IMAGE="$CI_REGISTRY/$GITLAB_USERNAME/stapelwerk"

# Server configuration
read -p "Server IP address [***************]: " SERVER_HOST
SERVER_HOST=${SERVER_HOST:-***************}

read -p "Application domain [stapelwerk.minilab.live]: " APP_DOMAIN
APP_DOMAIN=${APP_DOMAIN:-stapelwerk.minilab.live}

# Database configuration
POSTGRES_DB="stapelwerk"
POSTGRES_USER="stapelwerk_user"
DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}"

# Sentry (optional)
read -p "Sentry DSN (optional, press Enter to skip): " SENTRY_DSN

echo ""
echo "📄 Generating .env.production file..."

# Create .env.production
cat > .env.production << EOF
# Stapelwerk Production Environment Variables
# Generated: $(date)
# NEVER commit this file to version control!

# ======================
# Database Configuration
# ======================
POSTGRES_DB=${POSTGRES_DB}
POSTGRES_USER=${POSTGRES_USER}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}

# PostgreSQL connection string for Prisma
DATABASE_URL=${DATABASE_URL}

# ======================
# Application Configuration
# ======================
NODE_ENV=production
PORT=3000
APP_PORT=3000

# Public application URL
NEXT_PUBLIC_APP_URL=https://${APP_DOMAIN}

# ======================
# Authentication (NextAuth.js)
# ======================
NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
NEXTAUTH_URL=https://${APP_DOMAIN}

# ======================
# GitLab Container Registry
# ======================
CI_REGISTRY=${CI_REGISTRY}
CI_REGISTRY_IMAGE=${CI_REGISTRY_IMAGE}
DOCKER_IMAGE_TAG=latest

# ======================
# Sentry Error Tracking (Optional)
# ======================
SENTRY_DSN=${SENTRY_DSN}
SENTRY_AUTH_TOKEN=
SENTRY_ORG=
SENTRY_PROJECT=

# ======================
# Redis (Optional)
# ======================
REDIS_URL=

# ======================
# CORS Configuration
# ======================
ALLOWED_ORIGINS=https://${APP_DOMAIN}

# ======================
# Feature Flags (Optional)
# ======================
ENABLE_ANALYTICS=true
ENABLE_ERROR_TRACKING=true

# ======================
# Email Configuration (Optional)
# ======================
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=

# ======================
# Storage Configuration (Optional)
# ======================
STORAGE_PROVIDER=local
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
AWS_BUCKET=

# ======================
# API Rate Limiting (Optional)
# ======================
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=60000

# ======================
# Logging (Optional)
# ======================
LOG_LEVEL=info
LOG_FORMAT=json
EOF

# Set secure permissions
chmod 600 .env.production

echo ""
echo "✅ .env.production file created successfully!"
echo ""
echo "📋 IMPORTANT INFORMATION TO SAVE:"
echo "=================================="
echo ""
echo "🔐 NEXTAUTH_SECRET:"
echo "   ${NEXTAUTH_SECRET}"
echo ""
echo "🔐 POSTGRES_PASSWORD:"
echo "   ${POSTGRES_PASSWORD}"
echo ""
echo "🔗 DATABASE_URL:"
echo "   ${DATABASE_URL}"
echo ""
echo "🏠 Application URL:"
echo "   https://${APP_DOMAIN}"
echo ""
echo "📦 Registry Image:"
echo "   ${CI_REGISTRY_IMAGE}"
echo ""
echo "⚠️  SAVE THESE VALUES - You'll need them for GitLab CI/CD variables!"
echo ""
echo "📁 File location: $(pwd)/.env.production"
echo "🔒 Permissions: 600 (owner read/write only)"
echo ""
echo "Next steps:"
echo "1. Review and edit .env.production if needed"
echo "2. Copy this file to your production server: /opt/stapelwerk/.env.production"
echo "3. Set up GitLab CI/CD variables (see next section)"
echo ""
