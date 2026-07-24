# Enterprise Deployment Guide

This guide covers deployment strategies, configuration, and best practices for running Build My Stack Enterprise in production environments.

## Table of Contents

1. [Deployment Overview](#deployment-overview)
2. [Infrastructure Requirements](#infrastructure-requirements)
3. [Environment Setup](#environment-setup)
4. [Database Configuration](#database-configuration)
5. [Application Deployment](#application-deployment)
6. [High Availability Setup](#high-availability-setup)
7. [Security Configuration](#security-configuration)
8. [Monitoring & Observability](#monitoring--observability)
9. [Backup & Recovery](#backup--recovery)
10. [Scaling & Performance](#scaling--performance)
11. [Troubleshooting](#troubleshooting)
12. [Maintenance](#maintenance)

---

## Deployment Overview

### Deployment Architectures

#### Single Instance (Development/Testing)
```
┌─────────────────────┐
│   Application       │
│   ┌─────────────┐   │
│   │   Web App   │   │
│   │   Next.js   │   │
│   └─────────────┘   │
│   ┌─────────────┐   │
│   │ PostgreSQL  │   │
│   └─────────────┘   │
│   ┌─────────────┐   │
│   │    Redis    │   │
│   └─────────────┘   │
└─────────────────────┘
```

#### High Availability (Production)
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Load Balancer │    │   Load Balancer │    │   Load Balancer │
│     (Primary)   │    │   (Secondary)   │    │   (Standby)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
┌───────▼────────┐    ┌──────────▼────────┐    ┌──────────▼────────┐
│  Web App       │    │  Web App          │    │  Web App          │
│  Instance 1    │    │  Instance 2       │    │  Instance 3       │
└────────────────┘    └───────────────────┘    └───────────────────┘
        │                        │                        │
        └────────────────────────┼────────────────────────┘
                                 │
            ┌────────────────────┼────────────────────┐
            │                    │                    │
    ┌───────▼────────┐    ┌──────▼────────┐    ┌─────▼────────┐
    │ PostgreSQL     │    │ PostgreSQL    │    │    Redis     │
    │ Primary        │    │ Replica       │    │   Cluster    │
    └────────────────┘    └───────────────┘    └──────────────┘
```

### Deployment Options

| Option | Use Case | Complexity | Cost |
|--------|----------|------------|------|
| **Docker Compose** | Development, small teams | Low | Low |
| **Kubernetes** | Production, enterprise scale | High | Medium |
| **Cloud Native** | Managed services, rapid scaling | Medium | Variable |
| **Hybrid** | Existing infrastructure integration | Medium | Medium |

---

## Infrastructure Requirements

### Minimum Requirements

#### Development Environment
- **CPU**: 2 cores
- **RAM**: 4GB
- **Storage**: 20GB SSD
- **Network**: 10 Mbps

#### Production Environment
- **CPU**: 4+ cores per instance
- **RAM**: 8GB+ per instance
- **Storage**: 100GB+ SSD
- **Network**: 100 Mbps+, low latency

### Recommended Production Specifications

#### Application Servers
```yaml
# Recommended specs per application instance
resources:
  requests:
    cpu: "1"
    memory: "2Gi"
  limits:
    cpu: "2"
    memory: "4Gi"
```

#### Database Servers
```yaml
# PostgreSQL Primary
postgresql_primary:
  cpu: "4"
  memory: "8Gi"
  storage: "500Gi"
  iops: 3000

# PostgreSQL Replica
postgresql_replica:
  cpu: "2"
  memory: "4Gi" 
  storage: "500Gi"
  iops: 1500
```

#### Cache Servers
```yaml
# Redis Cluster
redis_cluster:
  nodes: 6  # 3 masters, 3 replicas
  cpu: "1"
  memory: "2Gi"
  storage: "50Gi"
```

### Network Requirements

#### Ports
| Service | Port | Protocol | Purpose |
|---------|------|----------|---------|
| Web Application | 3000 | HTTP/HTTPS | Main application |
| WebSocket | 3001 | WebSocket | Real-time collaboration |
| PostgreSQL | 5432 | TCP | Database |
| Redis | 6379 | TCP | Cache/Sessions |
| Monitoring | 9090 | HTTP | Prometheus metrics |
| Health Checks | 8080 | HTTP | Health/readiness probes |

#### Security Groups / Firewall Rules
```bash
# Application servers
# Allow HTTPS from load balancer
allow port 3000 from load_balancer_subnet

# Allow database access from application servers
allow port 5432 from application_subnet

# Allow Redis access from application servers
allow port 6379 from application_subnet

# Allow SSH for management (restrict source IPs)
allow port 22 from management_subnet
```

---

## Environment Setup

### Environment Variables

#### Core Application Settings
```bash
# Required
NODE_ENV=production
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=your-secure-random-secret-here

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/stapelwerk
DATABASE_POOL_SIZE=20

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PREFIX=bms:

# Feature Flags
FEATURE_FLAGS_ENABLED=true
FEATURE_FLAGS_CACHE_TTL=300

# Monitoring
MONITORING_ENABLED=true
METRICS_PORT=9090

# Security
ENCRYPTION_KEY=your-32-character-encryption-key
CORS_ORIGIN=https://your-domain.com
```

#### Enterprise-Specific Settings
```bash
# Organization Features
MULTI_ORG_ENABLED=true
MAX_ORG_MEMBERS=1000

# Collaboration
WEBSOCKET_ENABLED=true
WEBSOCKET_PORT=3001
COLLABORATION_TIMEOUT=300

# Workflows
APPROVAL_WORKFLOWS_ENABLED=true
WORKFLOW_TIMEOUT=86400

# Audit Logging
AUDIT_LOG_ENABLED=true
AUDIT_LOG_RETENTION_DAYS=365
AUDIT_LOG_EXPORT_ENABLED=true

# Compliance
SOX_COMPLIANCE_ENABLED=false
HIPAA_COMPLIANCE_ENABLED=false
GDPR_COMPLIANCE_ENABLED=true
```

#### External Service Configuration
```bash
# Email Service (required for notifications)
SMTP_HOST=smtp.yourdomain.com
SMTP_PORT=587
SMTP_USER=noreply@yourdomain.com
SMTP_PASSWORD=your-smtp-password

# File Storage (for exports, templates)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
S3_BUCKET=stapelwerk-storage

# Optional: Single Sign-On
SSO_ENABLED=true
SAML_CERT_PATH=/etc/ssl/saml.crt
SAML_KEY_PATH=/etc/ssl/saml.key
SAML_IDP_URL=https://your-idp.com/saml
```

### Configuration Files

#### Docker Compose Production Setup
```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.prod
    ports:
      - "3000:3000"
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:${POSTGRES_PASSWORD}@db:5432/stapelwerk
      - REDIS_URL=redis://redis:6379
    volumes:
      - ./uploads:/app/uploads
    depends_on:
      - db
      - redis
    deploy:
      replicas: 3
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '1'
          memory: 2G

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=stapelwerk
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"
    deploy:
      placement:
        constraints:
          - node.role == manager
      resources:
        limits:
          cpus: '4'
          memory: 8G
        reservations:
          cpus: '2'
          memory: 4G

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --maxmemory 2gb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 1G

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/ssl/certs
    depends_on:
      - app

volumes:
  postgres_data:
  redis_data:
```

#### Kubernetes Deployment
```yaml
# k8s/deployment.yml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: stapelwerk-app
  labels:
    app: stapelwerk
spec:
  replicas: 3
  selector:
    matchLabels:
      app: stapelwerk
  template:
    metadata:
      labels:
        app: stapelwerk
    spec:
      containers:
      - name: app
        image: stapelwerk:latest
        ports:
        - containerPort: 3000
        - containerPort: 3001
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: stapelwerk-secrets
              key: database-url
        - name: REDIS_URL
          value: "redis://redis-service:6379"
        resources:
          requests:
            memory: "2Gi"
            cpu: "1"
          limits:
            memory: "4Gi"
            cpu: "2"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: stapelwerk-service
spec:
  selector:
    app: stapelwerk
  ports:
  - name: http
    port: 80
    targetPort: 3000
  - name: websocket
    port: 3001
    targetPort: 3001
  type: LoadBalancer
```

---

## Database Configuration

### PostgreSQL Setup

#### Database Schema Migration
```sql
-- Run this to initialize the production database
-- This includes all enterprise tables and indexes

-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id VARCHAR(30) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_created_at ON organizations(created_at);

-- Organization members table
CREATE TABLE IF NOT EXISTS organization_members (
  id VARCHAR(30) PRIMARY KEY,
  organization_id VARCHAR(30) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id VARCHAR(30) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  permissions JSONB DEFAULT '{}'::jsonb,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_active_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(organization_id, user_id)
);

-- Indexes for member queries
CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_role ON organization_members(role);

-- Continue with other enterprise tables...
-- (Include all tables from previous schema files)
```

#### Production Configuration
```sql
-- postgresql.conf settings for production
shared_buffers = 2GB                    # 25% of RAM
effective_cache_size = 6GB              # 75% of RAM
work_mem = 50MB                        # For complex queries
maintenance_work_mem = 512MB           # For VACUUM, indexes

# Connection settings
max_connections = 200
shared_preload_libraries = 'pg_stat_statements'

# Write-ahead logging
wal_buffers = 16MB
checkpoint_completion_target = 0.9
wal_compression = on

# Query planner
random_page_cost = 1.1                 # For SSD storage
effective_io_concurrency = 200

# Logging
log_min_duration_statement = 1000      # Log slow queries
log_checkpoints = on
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
```

#### Database Maintenance Scripts
```bash
#!/bin/bash
# scripts/db-maintenance.sh

# Daily maintenance script
echo "Starting database maintenance..."

# Update table statistics
psql $DATABASE_URL -c "ANALYZE;"

# Vacuum tables
psql $DATABASE_URL -c "VACUUM (ANALYZE, VERBOSE);"

# Check for bloat
psql $DATABASE_URL -f scripts/check-bloat.sql

# Backup recent data
pg_dump $DATABASE_URL | gzip > /backups/daily-$(date +%Y%m%d).sql.gz

echo "Database maintenance completed"
```

### Redis Configuration

#### Production Redis Setup
```conf
# redis.conf
# Memory settings
maxmemory 2gb
maxmemory-policy allkeys-lru

# Persistence
appendonly yes
appendfsync everysec
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 64mb

# Networking
bind 0.0.0.0
port 6379
timeout 300
tcp-keepalive 300

# Security
requirepass your-redis-password

# Logging
loglevel notice
logfile "/var/log/redis/redis-server.log"
```

#### Redis Cluster Setup (High Availability)
```bash
#!/bin/bash
# Setup Redis cluster for high availability

# Create 6 Redis instances (3 masters, 3 replicas)
for port in 7000 7001 7002 7003 7004 7005; do
  mkdir -p /etc/redis/cluster/${port}
  
  cat > /etc/redis/cluster/${port}/redis.conf << EOF
port ${port}
cluster-enabled yes
cluster-config-file nodes-${port}.conf
cluster-node-timeout 5000
appendonly yes
maxmemory 1gb
maxmemory-policy allkeys-lru
requirepass your-redis-password
EOF
done

# Start Redis instances
for port in 7000 7001 7002 7003 7004 7005; do
  redis-server /etc/redis/cluster/${port}/redis.conf --daemonize yes
done

# Create cluster
redis-cli --cluster create \
  127.0.0.1:7000 127.0.0.1:7001 127.0.0.1:7002 \
  127.0.0.1:7003 127.0.0.1:7004 127.0.0.1:7005 \
  --cluster-replicas 1 \
  -a your-redis-password
```

---

## Application Deployment

### Build Process

#### Production Dockerfile
```dockerfile
# Dockerfile.prod
FROM node:18-alpine AS base

# Dependencies
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --only=production && npm cache clean --force

# Builder
FROM base AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runner
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy dependencies
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules

# Health check
COPY scripts/healthcheck.js ./
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node healthcheck.js

USER nextjs

EXPOSE 3000 3001

ENV PORT 3000

CMD ["node", "server.js"]
```

#### Health Check Script
```javascript
// scripts/healthcheck.js
const http = require('http');

const options = {
  hostname: 'localhost',
  port: process.env.PORT || 3000,
  path: '/api/health',
  timeout: 5000,
  method: 'GET'
};

const request = http.request(options, (res) => {
  if (res.statusCode === 200) {
    console.log('Health check passed');
    process.exit(0);
  } else {
    console.log(`Health check failed: ${res.statusCode}`);
    process.exit(1);
  }
});

request.on('timeout', () => {
  console.log('Health check timed out');
  process.exit(1);
});

request.on('error', (err) => {
  console.log(`Health check error: ${err.message}`);
  process.exit(1);
});

request.end();
```

### CI/CD Pipeline

#### GitHub Actions Deployment
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]
    paths-ignore:
      - 'docs/**'
      - '*.md'

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: npm
      
      - run: npm ci
      - run: npm run test
      - run: npm run lint
      - run: npm run type-check

  build:
    needs: test
    runs-on: ubuntu-latest
    outputs:
      image: ${{ steps.image.outputs.image }}
    steps:
      - uses: actions/checkout@v3
      
      - name: Log in to Container Registry
        uses: docker/login-action@v2
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Build and push Docker image
        uses: docker/build-push-action@v4
        with:
          context: .
          file: Dockerfile.prod
          push: true
          tags: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
      
      - id: image
        run: echo "image=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}" >> $GITHUB_OUTPUT

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to Kubernetes
        run: |
          echo "${{ secrets.KUBECONFIG }}" | base64 -d > kubeconfig
          export KUBECONFIG=kubeconfig
          
          # Update deployment image
          kubectl set image deployment/stapelwerk-app \
            app=${{ needs.build.outputs.image }}
          
          # Wait for rollout
          kubectl rollout status deployment/stapelwerk-app --timeout=300s
          
          # Run post-deployment health checks
          kubectl run health-check --rm -i --restart=Never \
            --image=curlimages/curl \
            -- curl -f http://stapelwerk-service/api/health
```

### Deployment Strategies

#### Blue-Green Deployment
```bash
#!/bin/bash
# scripts/blue-green-deploy.sh

NEW_VERSION=$1
CURRENT_ENV=$(kubectl get service stapelwerk-service -o jsonpath='{.spec.selector.version}')

# Determine target environment
if [ "$CURRENT_ENV" = "blue" ]; then
  TARGET_ENV="green"
else
  TARGET_ENV="blue"
fi

echo "Deploying version $NEW_VERSION to $TARGET_ENV environment"

# Update target environment
kubectl set image deployment/stapelwerk-$TARGET_ENV \
  app=stapelwerk:$NEW_VERSION

# Wait for deployment
kubectl rollout status deployment/stapelwerk-$TARGET_ENV

# Run health checks
if curl -f http://stapelwerk-$TARGET_ENV/api/health; then
  echo "Health checks passed, switching traffic"
  
  # Switch traffic
  kubectl patch service stapelwerk-service \
    -p '{"spec":{"selector":{"version":"'$TARGET_ENV'"}}}'
  
  echo "Deployment completed successfully"
else
  echo "Health checks failed, rolling back"
  kubectl rollout undo deployment/stapelwerk-$TARGET_ENV
  exit 1
fi
```

#### Rolling Update
```yaml
# k8s/deployment.yml - Rolling update strategy
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 25%
      maxSurge: 25%
  template:
    spec:
      containers:
      - name: app
        image: stapelwerk:latest
        readinessProbe:
          httpGet:
            path: /api/ready
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
          failureThreshold: 3
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
          failureThreshold: 3
```

---

## High Availability Setup

### Load Balancer Configuration

#### Nginx Load Balancer
```nginx
# nginx/nginx.conf
upstream stapelwerk_app {
    least_conn;
    server app1:3000 max_fails=3 fail_timeout=30s;
    server app2:3000 max_fails=3 fail_timeout=30s;
    server app3:3000 max_fails=3 fail_timeout=30s;
}

upstream stapelwerk_ws {
    ip_hash;  # Sticky sessions for WebSocket
    server app1:3001 max_fails=3 fail_timeout=30s;
    server app2:3001 max_fails=3 fail_timeout=30s;
    server app3:3001 max_fails=3 fail_timeout=30s;
}

server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/ssl/certs/your-domain.crt;
    ssl_certificate_key /etc/ssl/private/your-domain.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";

    # Application traffic
    location / {
        proxy_pass http://stapelwerk_app;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # WebSocket traffic
    location /socket.io/ {
        proxy_pass http://stapelwerk_ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Health check endpoint
    location /health {
        access_log off;
        proxy_pass http://stapelwerk_app;
    }
}
```

#### AWS Application Load Balancer
```yaml
# terraform/alb.tf
resource "aws_lb" "stapelwerk" {
  name               = "stapelwerk-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  enable_deletion_protection = true

  tags = {
    Environment = "production"
  }
}

resource "aws_lb_target_group" "app" {
  name     = "stapelwerk-app"
  port     = 3000
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/api/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 2
  }

  tags = {
    Environment = "production"
  }
}

resource "aws_lb_listener" "app" {
  load_balancer_arn = aws_lb.stapelwerk.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS-1-2-2017-01"
  certificate_arn   = aws_acm_certificate.main.arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }
}
```

### Database High Availability

#### PostgreSQL Primary-Replica Setup
```bash
#!/bin/bash
# scripts/setup-postgres-ha.sh

# Primary server configuration
cat >> /etc/postgresql/15/main/postgresql.conf << EOF
# Replication settings
wal_level = replica
max_wal_senders = 3
max_replication_slots = 3
hot_standby = on
hot_standby_feedback = on

# Archive settings
archive_mode = on
archive_command = 'test ! -f /var/lib/postgresql/15/main/archive/%f && cp %p /var/lib/postgresql/15/main/archive/%f'

# Connection settings
listen_addresses = '*'
EOF

# Create replication user
sudo -u postgres psql -c "CREATE USER replicator WITH REPLICATION ENCRYPTED PASSWORD 'replica-password';"

# Configure access
cat >> /etc/postgresql/15/main/pg_hba.conf << EOF
host replication replicator 10.0.0.0/24 md5
EOF

# Restart PostgreSQL
systemctl restart postgresql

# On replica server
sudo -u postgres pg_basebackup -h primary-server -D /var/lib/postgresql/15/main -U replicator -v -P -W

# Create recovery configuration
cat > /var/lib/postgresql/15/main/standby.signal

cat >> /var/lib/postgresql/15/main/postgresql.conf << EOF
primary_conninfo = 'host=primary-server port=5432 user=replicator password=replica-password'
promote_trigger_file = '/var/lib/postgresql/15/main/promote'
EOF
```

#### Automated Failover with Patroni
```yaml
# patroni.yml
scope: stapelwerk-cluster
namespace: /service/
name: postgres-1

restapi:
  listen: 0.0.0.0:8008
  connect_address: 10.0.1.10:8008

etcd:
  hosts: 10.0.1.20:2379,10.0.1.21:2379,10.0.1.22:2379

bootstrap:
  dcs:
    ttl: 30
    loop_wait: 10
    retry_timeout: 30
    maximum_lag_on_failover: 1048576
    master_start_timeout: 300
    synchronous_mode: false
    postgresql:
      use_pg_rewind: true
      parameters:
        max_connections: 200
        shared_buffers: 2GB
        effective_cache_size: 6GB
        wal_keep_segments: 20

  initdb:
  - encoding: UTF8
  - data-checksums

  pg_hba:
  - host replication replicator 127.0.0.1/32 md5
  - host replication replicator 10.0.1.0/24 md5
  - host all all 0.0.0.0/0 md5

postgresql:
  listen: 0.0.0.0:5432
  connect_address: 10.0.1.10:5432
  data_dir: /var/lib/postgresql/15/main
  pgpass: /tmp/pgpass
  authentication:
    replication:
      username: replicator
      password: replica-password
    superuser:
      username: postgres
      password: postgres-password
```

---

## Security Configuration

### SSL/TLS Setup

#### Certificate Management with Let's Encrypt
```bash
#!/bin/bash
# scripts/setup-ssl.sh

# Install certbot
apt-get update && apt-get install -y certbot python3-certbot-nginx

# Obtain certificate
certbot certonly --nginx \
  -d your-domain.com \
  -d api.your-domain.com \
  --email admin@your-domain.com \
  --agree-tos \
  --non-interactive

# Auto-renewal
echo "0 12 * * * /usr/bin/certbot renew --quiet" | crontab -
```

#### SSL Configuration
```nginx
# SSL configuration
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
ssl_prefer_server_ciphers off;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;

# OCSP stapling
ssl_stapling on;
ssl_stapling_verify on;
resolver 8.8.8.8 8.8.4.4 valid=300s;
resolver_timeout 5s;
```

### Network Security

#### Security Groups (AWS)
```hcl
# terraform/security-groups.tf
resource "aws_security_group" "app" {
  name_prefix = "stapelwerk-app-"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  ingress {
    from_port       = 3001
    to_port         = 3001
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "stapelwerk-app-sg"
  }
}

resource "aws_security_group" "db" {
  name_prefix = "stapelwerk-db-"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }

  tags = {
    Name = "stapelwerk-db-sg"
  }
}
```

### Application Security

#### Secrets Management
```typescript
// lib/secrets.ts
import { SecretsManager } from 'aws-sdk'

const secretsManager = new SecretsManager({ region: process.env.AWS_REGION })

export async function getSecret(secretId: string): Promise<string> {
  try {
    const result = await secretsManager.getSecretValue({ SecretId: secretId }).promise()
    return result.SecretString || ''
  } catch (error) {
    console.error(`Failed to retrieve secret ${secretId}:`, error)
    throw error
  }
}

// Usage in application
const dbPassword = await getSecret('stapelwerk/db-password')
const jwtSecret = await getSecret('stapelwerk/jwt-secret')
```

#### Security Headers Middleware
```typescript
// middleware/security.ts
import { NextRequest, NextResponse } from 'next/server'

export function securityMiddleware(request: NextRequest) {
  const response = NextResponse.next()

  // Security headers
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'"
  )
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=63072000; includeSubDomains; preload'
  )

  return response
}
```

---

## Monitoring & Observability

### Metrics Collection

#### Prometheus Configuration
```yaml
# prometheus/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "rules/*.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093

scrape_configs:
  - job_name: 'stapelwerk'
    static_configs:
      - targets: ['app:9090']
    scrape_interval: 5s
    metrics_path: /api/metrics

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']

  - job_name: 'nginx'
    static_configs:
      - targets: ['nginx-exporter:9113']
```

#### Application Metrics
```typescript
// lib/metrics.ts
import promClient from 'prom-client'

// Create metrics registry
const register = new promClient.Register()

// Default metrics
promClient.collectDefaultMetrics({ register })

// Custom metrics
export const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
})

export const activeCollaborationSessions = new promClient.Gauge({
  name: 'collaboration_sessions_active',
  help: 'Number of active collaboration sessions',
})

export const workflowApprovalTime = new promClient.Histogram({
  name: 'workflow_approval_time_seconds',
  help: 'Time taken for workflow approval',
  labelNames: ['organization', 'workflow_type'],
  buckets: [60, 300, 900, 3600, 7200, 86400]
})

export const auditLogEntries = new promClient.Counter({
  name: 'audit_log_entries_total',
  help: 'Total number of audit log entries',
  labelNames: ['action', 'organization']
})

register.registerMetric(httpRequestDuration)
register.registerMetric(activeCollaborationSessions)
register.registerMetric(workflowApprovalTime)
register.registerMetric(auditLogEntries)

// Metrics endpoint
export async function getMetrics(): Promise<string> {
  return register.metrics()
}
```

### Logging Configuration

#### Structured Logging
```typescript
// lib/logger.ts
import winston from 'winston'

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'stapelwerk',
    environment: process.env.NODE_ENV,
    version: process.env.APP_VERSION
  },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
})

// Audit logging
export const auditLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: {
    type: 'audit',
    service: 'stapelwerk'
  },
  transports: [
    new winston.transports.File({ filename: 'logs/audit.log' })
  ]
})

export default logger
```

#### Log Aggregation with ELK Stack
```yaml
# docker-compose.elk.yml
version: '3.8'
services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.5.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data
    ports:
      - "9200:9200"

  logstash:
    image: docker.elastic.co/logstash/logstash:8.5.0
    volumes:
      - ./logstash/pipeline:/usr/share/logstash/pipeline
      - ./logs:/logs
    ports:
      - "5044:5044"
    depends_on:
      - elasticsearch

  kibana:
    image: docker.elastic.co/kibana/kibana:8.5.0
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
    ports:
      - "5601:5601"
    depends_on:
      - elasticsearch

volumes:
  elasticsearch_data:
```

### Alerting Rules

#### Prometheus Alerting Rules
```yaml
# prometheus/rules/stapelwerk.yml
groups:
  - name: stapelwerk
    rules:
      - alert: HighResponseTime
        expr: http_request_duration_seconds{quantile="0.95"} > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High response time detected"
          description: "95th percentile response time is {{ $value }}s"

      - alert: HighErrorRate
        expr: rate(http_requests_total{status_code=~"5.."}[5m]) > 0.1
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} requests/second"

      - alert: DatabaseConnectionFailure
        expr: up{job="postgres"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Database connection failure"
          description: "PostgreSQL is down"

      - alert: CollaborationSessionsHigh
        expr: collaboration_sessions_active > 100
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High number of collaboration sessions"
          description: "{{ $value }} active collaboration sessions"
```

---

This deployment guide provides comprehensive coverage of production deployment scenarios. Continue with the remaining sections for complete production readiness.