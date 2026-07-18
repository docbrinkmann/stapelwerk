# Environment Setup Guide for Production Deployment

This guide provides step-by-step instructions for setting up the production environment for the BuildMyStack AI Recommendations system.

## 📋 Prerequisites

Before beginning the production setup, ensure you have the following:

### Required Tools

1. **kubectl** - Kubernetes command-line tool
   ```bash
   # Install via homebrew (macOS)
   brew install kubectl
   
   # Or download directly
   curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/darwin/amd64/kubectl"
   chmod +x kubectl
   sudo mv kubectl /usr/local/bin/
   ```

2. **Docker** - Container runtime
   ```bash
   # Install Docker Desktop from https://docker.com/products/docker-desktop
   # Or via homebrew
   brew install --cask docker
   ```

3. **Helm** - Kubernetes package manager
   ```bash
   brew install helm
   ```

4. **yq** - YAML processor
   ```bash
   brew install yq
   ```

5. **jq** - JSON processor
   ```bash
   brew install jq
   ```

6. **OpenSSL** - For generating secrets
   ```bash
   # Usually pre-installed on macOS/Linux
   openssl version
   ```

### Access Requirements

- [ ] Kubernetes cluster admin access
- [ ] Docker registry push/pull access
- [ ] Production database admin access
- [ ] Production Redis admin access
- [ ] DNS management access (for domain configuration)
- [ ] Certificate authority access (for TLS certificates)

### Service Accounts

You'll need accounts and API keys for:

- [ ] OpenAI API
- [ ] Anthropic API
- [ ] Sentry (error tracking)
- [ ] Slack (notifications)
- [ ] PagerDuty (alerting)
- [ ] SMTP service (email notifications)

## 🔧 Step-by-Step Setup

### Step 1: Clone and Prepare Repository

```bash
# Clone the repository
git clone <repository-url>
cd build-my-stack

# Ensure scripts are executable
chmod +x scripts/*.sh

# Create logs directory
mkdir -p logs
```

### Step 2: Configure Kubernetes Access

```bash
# Configure kubectl to access your production cluster
kubectl config use-context your-production-cluster

# Verify access
kubectl cluster-info
kubectl get nodes

# Create production namespace
kubectl create namespace buildmystack
```

### Step 3: Prepare Environment Variables

```bash
# Copy the environment template
cp deployment/production.env.template .env.production

# Edit the file to set all required variables
# IMPORTANT: Never commit this file to version control
nano .env.production
```

**Required Environment Variables:**

```bash
# Database Configuration
export PROD_DB_HOST="your-postgres-host.com"
export PROD_DB_NAME="buildmystack_prod"
export PROD_DB_USER="buildmystack_app"
export PROD_DB_PASSWORD="your-secure-db-password"

# Redis Configuration
export PROD_REDIS_HOST="your-redis-host.com"
export PROD_REDIS_PASSWORD="your-secure-redis-password"

# AI Service API Keys
export OPENAI_API_KEY="sk-your-openai-key"
export ANTHROPIC_API_KEY="sk-ant-your-anthropic-key"

# Monitoring and Alerting
export SENTRY_DSN="https://your-sentry-dsn@sentry.io/project-id"
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/your/slack/webhook"
export PAGERDUTY_INTEGRATION_KEY="your-pagerduty-integration-key"

# Email Configuration
export SMTP_HOST="smtp.your-provider.com"
export SMTP_USERNAME="your-smtp-username"
export SMTP_PASSWORD="your-smtp-password"
export SMTP_FROM="alerts@buildmystack.com"
export SMTP_TO="devops@buildmystack.com,engineering@buildmystack.com"

# Optional: Custom secrets (will be auto-generated if not provided)
export PROD_JWT_SECRET="your-64-character-jwt-secret"
export PROD_ADMIN_API_TOKEN="your-32-character-admin-token"
export PROD_FEATURE_FLAG_TOKEN="your-32-character-feature-flag-token"

# Optional: TLS Certificates
export TLS_CERT_PATH="/path/to/your/certificate.crt"
export TLS_KEY_PATH="/path/to/your/private-key.key"

# Container Registry
export DOCKER_REGISTRY="gcr.io/your-project-id"
export BUILD_VERSION="v1.0.0"
```

### Step 4: Load Environment Variables

```bash
# Load the environment variables
source .env.production

# Verify all required variables are set
./scripts/validate-production-env.sh --quiet
```

### Step 5: Set Up Production Secrets

```bash
# Run the secrets setup script
./scripts/setup-production-secrets.sh

# This will:
# - Create all required Kubernetes secrets
# - Generate secure passwords where needed
# - Set up service account and RBAC
# - Create production ConfigMap
# - Generate environment reference file
```

### Step 6: Validate Environment

```bash
# Run comprehensive environment validation
./scripts/validate-production-env.sh

# This will check:
# - All environment variables
# - API key formats and validity
# - External service connectivity
# - Kubernetes cluster access
# - TLS certificate validity
```

### Step 7: Prepare Database

If you're using an external database service (recommended), you'll need to:

```bash
# 1. Create the production database
createdb -h $PROD_DB_HOST -U postgres buildmystack_prod

# 2. Create application user
psql -h $PROD_DB_HOST -U postgres -d buildmystack_prod -c "
CREATE USER buildmystack_app WITH PASSWORD '$PROD_DB_PASSWORD';
GRANT CONNECT ON DATABASE buildmystack_prod TO buildmystack_app;
GRANT USAGE ON SCHEMA public TO buildmystack_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO buildmystack_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO buildmystack_app;
"

# 3. Run database migrations (if applicable)
# This will be done during deployment
```

### Step 8: Prepare Redis

If you're using an external Redis service (recommended):

```bash
# Configure Redis with authentication
redis-cli -h $PROD_REDIS_HOST -p 6379
AUTH $PROD_REDIS_PASSWORD

# Verify connection works
PING
# Should return PONG

# Configure basic settings
CONFIG SET maxmemory 1gb
CONFIG SET maxmemory-policy allkeys-lru
CONFIG SET save "300 1"
```

### Step 9: Build and Push Docker Image

```bash
# Build the production Docker image
docker build -t $DOCKER_REGISTRY/buildmystack-ai:$BUILD_VERSION -f docker/production.Dockerfile .

# Tag as latest
docker tag $DOCKER_REGISTRY/buildmystack-ai:$BUILD_VERSION $DOCKER_REGISTRY/buildmystack-ai:latest

# Push to registry
docker push $DOCKER_REGISTRY/buildmystack-ai:$BUILD_VERSION
docker push $DOCKER_REGISTRY/buildmystack-ai:latest
```

### Step 10: Test Local Production Environment (Optional)

```bash
# Test with Docker Compose (for validation)
cd docker
docker-compose -f docker-compose.prod.yml up -d

# Wait for services to start
sleep 30

# Test the application
curl http://localhost:8080/health

# Clean up
docker-compose -f docker-compose.prod.yml down
cd ..
```

## 🚀 Production Deployment

Once the environment is properly configured and validated, you can proceed with the production deployment:

```bash
# Run the full production deployment
./scripts/deploy-production.sh full-deploy

# Or deploy phase by phase
./scripts/deploy-production.sh phase-1  # Infrastructure
./scripts/deploy-production.sh phase-2  # Internal beta
./scripts/deploy-production.sh phase-3  # Early adopters (5%)
./scripts/deploy-production.sh phase-4  # Broader beta (25%)
./scripts/deploy-production.sh phase-5  # Major rollout (75%)
./scripts/deploy-production.sh phase-6  # Full production (100%)
```

## 🔍 Monitoring and Verification

After deployment, monitor the system:

```bash
# Check deployment status
./scripts/deploy-production.sh status

# View logs
kubectl logs -f deployment/buildmystack-ai -n buildmystack

# Check metrics
kubectl port-forward svc/buildmystack-ai-service 8080:80 -n buildmystack
curl http://localhost:8080/metrics

# Monitor feature flags
curl http://localhost:8080/api/feature-flags
```

## 🚨 Troubleshooting

### Common Issues and Solutions

#### 1. Environment Variable Issues

```bash
# Check if all required variables are set
./scripts/validate-production-env.sh --quiet

# Re-source environment file
source .env.production

# Verify specific variable
echo $OPENAI_API_KEY
```

#### 2. Kubernetes Access Issues

```bash
# Check current context
kubectl config current-context

# Switch to correct context
kubectl config use-context your-production-cluster

# Check permissions
kubectl auth can-i create secrets -n buildmystack
```

#### 3. Secret Creation Issues

```bash
# Check if secrets exist
kubectl get secrets -n buildmystack

# Re-run secrets setup
./scripts/setup-production-secrets.sh

# View secret details (without values)
kubectl describe secret db-secrets -n buildmystack
```

#### 4. Docker Registry Issues

```bash
# Login to registry
docker login $DOCKER_REGISTRY

# Test registry access
docker pull nginx
docker tag nginx $DOCKER_REGISTRY/test:latest
docker push $DOCKER_REGISTRY/test:latest
docker rmi $DOCKER_REGISTRY/test:latest
```

#### 5. Database Connection Issues

```bash
# Test database connection
nc -zv $PROD_DB_HOST 5432

# Test authentication
psql "postgresql://$PROD_DB_USER:$PROD_DB_PASSWORD@$PROD_DB_HOST/$PROD_DB_NAME" -c "SELECT 1;"
```

#### 6. API Key Issues

```bash
# Test OpenAI API key
curl -H "Authorization: Bearer $OPENAI_API_KEY" "https://api.openai.com/v1/models" | jq '.data[0].id'

# Test Anthropic API key
curl -H "Authorization: Bearer $ANTHROPIC_API_KEY" "https://api.anthropic.com/v1/messages" -X POST -d '{}' 2>/dev/null || echo "Key format valid"
```

## 📚 Additional Resources

### Documentation
- [Production Secrets Management Guide](./PRODUCTION_SECRETS_MANAGEMENT.md)
- [Deployment Strategy Documentation](./DEPLOYMENT_STRATEGY.md)
- [Production Deployment Checklist](./PRODUCTION_DEPLOYMENT_CHECKLIST.md)

### Monitoring and Observability
- **Grafana Dashboard**: http://your-grafana-host:3000
- **Prometheus Metrics**: http://your-prometheus-host:9090
- **Application Health**: http://your-app-host/health
- **Application Metrics**: http://your-app-host/metrics

### Emergency Procedures
- **Rollback**: `./scripts/deploy-production.sh rollback`
- **Check Status**: `./scripts/deploy-production.sh status`
- **View Logs**: `./scripts/deploy-production.sh logs`

## 🔐 Security Best Practices

1. **Never commit secrets to version control**
   - Add `.env.production` to `.gitignore`
   - Use encrypted files for sensitive data
   - Rotate secrets regularly

2. **Use least privilege access**
   - Create dedicated service accounts
   - Limit database permissions
   - Restrict Kubernetes RBAC

3. **Enable audit logging**
   - Kubernetes audit logs
   - Application audit logs
   - Database access logs

4. **Regular security updates**
   - Update container base images
   - Update dependencies
   - Apply security patches

5. **Monitor for security events**
   - Failed authentication attempts
   - Unusual access patterns
   - Resource usage anomalies

## 📞 Support and Contact

For issues with the production deployment:

1. **Check the troubleshooting section above**
2. **Review deployment logs**: `./scripts/deploy-production.sh logs`
3. **Run environment validation**: `./scripts/validate-production-env.sh`
4. **Contact the team**:
   - Engineering Team: engineering@buildmystack.com
   - DevOps Team: devops@buildmystack.com
   - Emergency: [On-call contact information]

---

**Remember**: Always test in a staging environment that mirrors production before deploying to production. This setup guide should be followed exactly to ensure a successful and secure production deployment.