# Architecture - Build My Stack

**Version:** 1.0.0
**Last Updated:** 2025-11-10

---

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Technology Stack](#technology-stack)
4. [Component Architecture](#component-architecture)
5. [Data Flow](#data-flow)
6. [Security Architecture](#security-architecture)
7. [Infrastructure](#infrastructure)
8. [Deployment Architecture](#deployment-architecture)

---

## Overview

Build My Stack is a full-stack web application built with Next.js 14, featuring a modern architecture with type-safe APIs, real-time updates, and enterprise-grade security.

**Design Principles:**
- **Type Safety First:** End-to-end TypeScript with tRPC
- **Performance:** Sub-2s load times, Redis caching, optimized database queries
- **Security:** CSRF protection, rate limiting, input validation
- **Scalability:** Horizontal scaling ready, stateless design
- **Developer Experience:** Hot reload, comprehensive testing, clear documentation

---

## System Architecture

### High-Level Architecture

```mermaid
graph TB
    User[User Browser] --> CDN[CDN / Edge Cache]
    CDN --> LB[Load Balancer]
    LB --> App1[Next.js App Instance 1]
    LB --> App2[Next.js App Instance 2]
    LB --> App3[Next.js App Instance N]

    App1 --> Redis[(Redis Cache)]
    App2 --> Redis
    App3 --> Redis

    App1 --> DB[(PostgreSQL)]
    App2 --> DB
    App3 --> DB

    App1 --> S3[S3 / Storage]
    App2 --> S3
    App3 --> S3

    subgraph "Monitoring & Logging"
        Prometheus[Prometheus]
        Grafana[Grafana]
        Loki[Loki Logs]
    end

    App1 --> Prometheus
    App2 --> Prometheus
    App3 --> Prometheus
```

### Request Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant M as Middleware
    participant T as tRPC Handler
    participant P as Prisma ORM
    participant D as PostgreSQL
    participant R as Redis

    C->>M: HTTP Request
    M->>M: CSRF Check
    M->>M: Security Headers
    M->>R: Rate Limit Check
    R-->>M: Allow/Deny
    M->>T: Forward Request
    T->>T: Input Validation (Zod)
    T->>T: Authentication Check
    T->>P: Query Data
    P->>D: SQL Query
    D-->>P: Result Set
    P-->>T: Typed Data
    T->>R: Cache Result
    T-->>C: JSON Response
```

---

## Technology Stack

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| **Next.js** | 14.0.0 | React framework with App Router |
| **React** | 18.2.0 | UI library |
| **TypeScript** | 5.9.2 | Type safety |
| **Tailwind CSS** | 4.1.16 | Styling |
| **React Query** | 5.87.4 | Data fetching & caching |
| **Zustand** | 5.0.8 | Client state management |
| **Framer Motion** | 12.23.24 | Animations |
| **Radix UI** | Various | Accessible components |
| **Socket.IO Client** | 4.8.1 | Real-time updates |

### Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| **tRPC** | 11.5.1 | Type-safe API layer |
| **Prisma** | 5.22.0 | ORM & database client |
| **PostgreSQL** | 16 | Primary database |
| **Redis** | 7 | Caching & rate limiting |
| **Zod** | 4.1.8 | Schema validation |
| **NextAuth.js** | 4.24.11 | Authentication |
| **Socket.IO** | 4.8.1 | WebSocket server |

### DevOps & Infrastructure

| Technology | Version | Purpose |
|------------|---------|---------|
| **Docker** | 24+ | Containerization |
| **Docker Compose** | 2.x | Local development |
| **Prometheus** | Latest | Metrics collection |
| **Grafana** | Latest | Metrics visualization |
| **OWASP ZAP** | Latest | Security scanning |
| **Artillery** | 2.0.26 | Load testing |

---

## Component Architecture

### Application Layers

```mermaid
graph TD
    subgraph "Presentation Layer"
        Pages[Pages / Routes]
        Components[React Components]
        Hooks[Custom Hooks]
        Store[Zustand State]
    end

    subgraph "API Layer"
        tRPC[tRPC Client]
        Middleware[Middleware]
        Routers[tRPC Routers]
    end

    subgraph "Business Logic"
        Services[Business Services]
        Validation[Zod Schemas]
        Utils[Utility Functions]
    end

    subgraph "Data Layer"
        Prisma[Prisma Client]
        Cache[Redis Cache]
        DB[(PostgreSQL)]
    end

    Pages --> Components
    Components --> Hooks
    Hooks --> Store
    Hooks --> tRPC
    tRPC --> Middleware
    Middleware --> Routers
    Routers --> Services
    Services --> Validation
    Services --> Prisma
    Prisma --> DB
    Services --> Cache
    Cache --> DB
```

### Directory Structure

```
build-my-stack/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (routes)/           # Route groups
│   │   ├── api/                # REST API routes
│   │   └── layout.tsx          # Root layout
│   ├── components/             # React components
│   │   ├── ui/                 # Reusable UI components
│   │   ├── enterprise/         # Enterprise features
│   │   └── [feature]/          # Feature-specific
│   ├── hooks/                  # Custom React hooks
│   ├── lib/                    # Shared utilities
│   │   ├── security/           # Security utilities
│   │   ├── monitoring/         # Performance monitoring
│   │   └── database/           # Database utilities
│   ├── server/                 # Backend code
│   │   ├── routers/            # tRPC routers
│   │   ├── services/           # Business logic
│   │   └── trpc.ts             # tRPC setup
│   ├── stores/                 # Zustand stores
│   └── types/                  # TypeScript types
├── prisma/                     # Database schema
│   ├── schema.prisma           # Prisma schema
│   └── migrations/             # DB migrations
├── security/                   # Security testing
│   ├── zap-automation.yaml     # OWASP ZAP config
│   └── run-zap-*.sh            # Security scripts
├── docs/                       # Documentation
├── tests/                      # Tests
└── docker-compose.yml          # Local development
```

---

## Data Flow

### Stack Creation Flow

```mermaid
sequenceDiagram
    participant U as User
    participant SB as ServiceBrowser
    participant SC as StackStore
    participant T as tRPC
    participant DB as Database

    U->>SB: Browse Services
    SB->>T: services.list()
    T->>DB: SELECT * FROM services
    DB-->>T: Service[]
    T-->>SB: Service[]
    SB-->>U: Display Services

    U->>SC: Add Service to Stack
    SC->>SC: Update Local State
    SC-->>U: Stack Updated

    U->>SC: Save Stack
    SC->>T: stacks.save()
    T->>T: Validate Input (Zod)
    T->>DB: INSERT INTO stacks
    DB-->>T: Stack Created
    T-->>SC: Stack { id, ... }
    SC-->>U: Success

    U->>T: exportDockerCompose()
    T->>T: Generate YAML
    T-->>U: Download docker-compose.yml
```

### Authentication Flow

```mermaid
sequenceDiagram
    participant U as User
    participant NA as NextAuth
    participant M as Middleware
    participant T as tRPC
    participant DB as Database

    U->>NA: Sign In
    NA->>DB: Verify Credentials
    DB-->>NA: User Found
    NA->>NA: Create Session
    NA-->>U: Set Session Cookie

    U->>M: Protected Request
    M->>M: Extract Session
    M->>T: Forward with userId
    T->>T: Check Auth (protectedProcedure)
    T->>DB: Query User Data
    DB-->>T: User Data
    T-->>U: Protected Response
```

---

## Security Architecture

### Security Layers

```mermaid
graph TB
    subgraph "Edge / CDN Layer"
        WAF[Web Application Firewall]
        DDoS[DDoS Protection]
        SSL[SSL/TLS Termination]
    end

    subgraph "Application Layer"
        Middleware[Next.js Middleware]
        CSRF[CSRF Protection]
        RateLimit[Rate Limiting]
        Headers[Security Headers]
    end

    subgraph "API Layer"
        Auth[Authentication]
        Validation[Input Validation]
        Sanitization[Data Sanitization]
    end

    subgraph "Data Layer"
        Encryption[Encryption at Rest]
        Parameterization[SQL Parameterization]
        Audit[Audit Logging]
    end

    User[User Request] --> WAF
    WAF --> SSL
    SSL --> Middleware
    Middleware --> CSRF
    CSRF --> RateLimit
    RateLimit --> Headers
    Headers --> Auth
    Auth --> Validation
    Validation --> Sanitization
    Sanitization --> Encryption
    Encryption --> Parameterization
    Parameterization --> Audit
```

### Security Controls

| Layer | Control | Implementation |
|-------|---------|----------------|
| **Network** | DDoS Protection | Cloudflare / AWS Shield |
| **Edge** | WAF Rules | Rate limiting, IP filtering |
| **Transport** | HTTPS Only | HSTS, forced SSL redirect |
| **Middleware** | CSRF Protection | Origin/Referer validation |
| **Middleware** | Rate Limiting | Redis-based sliding window |
| **Middleware** | Security Headers | CSP, X-Frame-Options, etc. |
| **API** | Authentication | NextAuth.js sessions |
| **API** | Input Validation | Zod schemas |
| **API** | Output Sanitization | HTML entity encoding |
| **Database** | SQL Injection Prevention | Prisma parameterized queries |
| **Database** | Encryption | AES-256 at rest |
| **Database** | Access Control | Principle of least privilege |

---

## Infrastructure

### Development Environment

```mermaid
graph TB
    subgraph "Local Docker Compose"
        Next[Next.js Dev Server :3000]
        Postgres[PostgreSQL :5432]
        Redis[Redis :6379]
        Prometheus[Prometheus :9090]
        Grafana[Grafana :3001]
    end

    Developer[Developer] --> Next
    Next --> Postgres
    Next --> Redis
    Next --> Prometheus
    Prometheus --> Grafana
```

**docker-compose.yml Services:**
- **app:** Next.js development server with hot reload
- **postgres:** PostgreSQL 16 with persistent volume
- **redis:** Redis 7 for caching and rate limiting
- **prometheus:** Metrics collection
- **grafana:** Metrics visualization

### Production Infrastructure (AWS Example)

```mermaid
graph TB
    subgraph "CDN & Edge"
        CF[CloudFront]
        Route53[Route 53]
    end

    subgraph "Application Tier"
        ALB[Application Load Balancer]
        ECS1[ECS Task 1]
        ECS2[ECS Task 2]
        ECS3[ECS Task N]
    end

    subgraph "Data Tier"
        RDS[(RDS PostgreSQL)]
        ElastiCache[(ElastiCache Redis)]
        S3[S3 Storage]
    end

    subgraph "Monitoring"
        CloudWatch[CloudWatch]
        Sentry[Sentry]
    end

    Route53 --> CF
    CF --> ALB
    ALB --> ECS1
    ALB --> ECS2
    ALB --> ECS3
    ECS1 --> RDS
    ECS2 --> RDS
    ECS3 --> RDS
    ECS1 --> ElastiCache
    ECS2 --> ElastiCache
    ECS3 --> ElastiCache
    ECS1 --> S3
    ECS1 --> CloudWatch
    ECS1 --> Sentry
```

**Infrastructure Components:**
- **Route 53:** DNS management
- **CloudFront:** CDN for static assets
- **ALB:** Application load balancing with health checks
- **ECS Fargate:** Containerized application instances
- **RDS PostgreSQL:** Managed database with Multi-AZ
- **ElastiCache Redis:** Managed Redis cluster
- **S3:** Static file storage
- **CloudWatch:** Metrics, logs, and alarms
- **Sentry:** Error tracking and monitoring

---

## Deployment Architecture

### CI/CD Pipeline

```mermaid
graph LR
    subgraph "Source"
        Git[Git Push]
    end

    subgraph "Build"
        GitHub[GitHub Actions]
        Tests[Run Tests]
        Lint[Lint & Type Check]
        Security[Security Scan]
    end

    subgraph "Deploy"
        Docker[Build Docker Image]
        Registry[Push to ECR]
        ECS[Deploy to ECS]
    end

    subgraph "Validate"
        Smoke[Smoke Tests]
        Rollback[Auto Rollback]
    end

    Git --> GitHub
    GitHub --> Tests
    Tests --> Lint
    Lint --> Security
    Security --> Docker
    Docker --> Registry
    Registry --> ECS
    ECS --> Smoke
    Smoke -->|Fail| Rollback
    Smoke -->|Pass| Done[Complete]
```

### Deployment Strategies

**Blue-Green Deployment:**
```mermaid
graph LR
    LB[Load Balancer]
    Blue[Blue Environment<br/>Current v1.0]
    Green[Green Environment<br/>New v1.1]

    LB -->|100% Traffic| Blue
    LB -.->|0% Traffic| Green

    style Green fill:#90EE90
    style Blue fill:#87CEEB
```

**Rolling Update:**
1. Deploy new version to 1 instance
2. Health check passes
3. Gradually shift traffic (20% → 50% → 100%)
4. Remove old instances

---

## Database Architecture

### Schema Overview

```mermaid
erDiagram
    User ||--o{ Stack : creates
    User ||--o{ Template : submits
    User ||--o{ Deployment : owns

    Stack ||--|{ StackService : contains
    Stack }o--|| Category : belongs_to

    StackService }o--|| Service : references

    Service }o--|| Category : belongs_to

    Template ||--|{ TemplateService : contains
    TemplateService }o--|| Service : references

    Stack ||--o{ Deployment : deploys

    User {
        string id PK
        string email UK
        string name
        datetime createdAt
    }

    Service {
        string id PK
        string name
        string slug UK
        string dockerImage
        string categoryId FK
        boolean featured
        json ports
        json environment
    }

    Stack {
        string id PK
        string userId FK
        string name
        string description
        string shareId UK
        boolean public
        datetime createdAt
    }
```

### Database Optimization

**Indexes:**
- `Service.slug` - Unique index for lookups
- `Service(categoryId, status)` - Composite index for filtering
- `Service(featured, status)` - Featured service queries
- `Service(status, createdAt)` - Sorting and pagination
- `Category.slug` - Unique index
- `Stack(userId, createdAt)` - User's stacks
- `Stack.shareId` - Public sharing

**Connection Pooling:**
- **Development:** 20 connections per instance
- **Production:** 100 connections (PgBouncer recommended)

---

## Performance Architecture

### Caching Strategy

```mermaid
graph TB
    Request[Request] --> L1[L1: React Query Cache]
    L1 -->|Miss| L2[L2: Redis Cache]
    L2 -->|Miss| DB[(PostgreSQL)]
    DB --> L2
    L2 --> L1
    L1 --> Response[Response]

    style L1 fill:#90EE90
    style L2 fill:#FFB6C1
    style DB fill:#87CEEB
```

**Cache Layers:**
1. **Client-Side (React Query):** 5-10 minute TTL for frequently accessed data
2. **Server-Side (Redis):** 1-24 hour TTL for expensive queries
3. **Database:** Query result caching, prepared statements

**Cache Invalidation:**
- Write-through: Update cache on write
- TTL-based: Automatic expiration
- Event-driven: WebSocket notifications trigger cache refresh

---

## Scalability

### Horizontal Scaling

**Stateless Design:**
- Session data in Redis (shared across instances)
- File uploads to S3 (not local filesystem)
- No in-memory caching (use Redis)
- WebSocket server scaled separately

**Auto-Scaling Triggers:**
- CPU > 70% for 5 minutes → Scale up
- Request latency p95 > 1000ms → Scale up
- CPU < 30% for 10 minutes → Scale down
- Minimum 2 instances, maximum 20 instances

### Database Scaling

**Read Replicas:**
```mermaid
graph LR
    App[Application] -->|Writes| Primary[(Primary DB)]
    App -->|Reads| Replica1[(Read Replica 1)]
    App -->|Reads| Replica2[(Read Replica 2)]
    Primary -.->|Replication| Replica1
    Primary -.->|Replication| Replica2
```

**Sharding Strategy (Future):**
- Shard by `userId` for user data
- Shard by `categoryId` for services
- Cross-shard queries via aggregation service

---

## Monitoring & Observability

### Metrics Collection

```mermaid
graph TB
    App[Application] --> Prometheus[Prometheus]
    App --> Loki[Loki Logs]
    App --> Sentry[Sentry Errors]

    Prometheus --> Grafana[Grafana Dashboards]
    Loki --> Grafana

    Grafana --> Alerts[Alert Manager]
    Alerts --> PagerDuty[PagerDuty]
    Alerts --> Slack[Slack]
```

**Key Metrics:**
- **Application:** Request rate, response time, error rate
- **Business:** Stacks created, services added, users active
- **Infrastructure:** CPU, memory, disk, network
- **Database:** Query time, connection pool, deadlocks

**Logging Strategy:**
- **Structured JSON logs** for machine parsing
- **Log levels:** ERROR, WARN, INFO, DEBUG
- **Correlation IDs:** Track requests across services
- **Retention:** 30 days hot, 1 year cold storage

---

## Disaster Recovery

### Backup Strategy

**Database Backups:**
- **Automated:** Daily full backups, 30-day retention
- **Point-in-Time Recovery:** 7-day window
- **Cross-Region Replication:** DR site in different region

**Application State:**
- **Infrastructure as Code:** All infra in Terraform
- **Docker Images:** Versioned and stored in registry
- **Configuration:** Secrets in AWS Secrets Manager

### Recovery Procedures

**RTO (Recovery Time Objective):** 4 hours
**RPO (Recovery Point Objective):** 1 hour

---

## Security Best Practices

**Application Security:**
- ✅ HTTPS only (HSTS enabled)
- ✅ CSRF protection on all mutations
- ✅ Rate limiting (100 req/15min for API)
- ✅ Input validation (Zod schemas)
- ✅ Output sanitization (HTML encoding)
- ✅ SQL injection prevention (Prisma)
- ✅ XSS prevention (React auto-escaping + CSP)
- ✅ Security headers (CSP, X-Frame-Options, etc.)

**Infrastructure Security:**
- ✅ Principle of least privilege (IAM roles)
- ✅ Network segmentation (VPC, security groups)
- ✅ Secrets management (not in code)
- ✅ Regular security scanning (OWASP ZAP)
- ✅ Dependency scanning (npm audit)
- ✅ Container scanning (Trivy)

---

## Future Architecture Enhancements

### Planned Improvements

1. **GraphQL Federation:** Modular schema composition
2. **Event Sourcing:** Audit trail and replay capability
3. **CQRS:** Separate read/write models for scalability
4. **Kubernetes:** Container orchestration for better scaling
5. **Service Mesh:** Enhanced observability and traffic management
6. **Multi-Region:** Global deployment for low latency
7. **Edge Computing:** Serverless functions at the edge

---

## Conclusion

Build My Stack follows modern architecture best practices with a focus on:
- **Type Safety:** End-to-end TypeScript
- **Performance:** Sub-2s page loads, optimized caching
- **Security:** Defense in depth, OWASP compliance
- **Scalability:** Horizontal scaling, stateless design
- **Reliability:** 99.9% uptime target, auto-recovery

---

**Last Updated:** 2025-11-10
**Version:** 1.0.0
**Maintained By:** Build My Stack Engineering Team
