# System Architecture

## High-Level Architecture

```mermaid
graph TB
    subgraph Client["Client Layer"]
        Browser[Web Browser]
        CLI[CLI Tools]
    end

    subgraph Frontend["Frontend (Next.js)"]
        Pages[React Pages]
        Components[UI Components]
        Hooks[React Query Hooks]
    end

    subgraph API["API Layer"]
        tRPC[tRPC Server]
        Routers[Router Modules]
        Middleware[Auth/OTEL Middleware]
    end

    subgraph Services["Service Layer"]
        GitOps[GitOps Service]
        Infra[Infrastructure Service]
        Security[Security Service]
        Export[Export Service]
    end

    subgraph External["External Services"]
        ArgoCD[ArgoCD]
        Pulumi[Pulumi Cloud]
        Trivy[Trivy Scanner]
    end

    subgraph Data["Data Layer"]
        Prisma[Prisma ORM]
        PostgreSQL[(PostgreSQL)]
        Redis[(Redis Cache)]
    end

    subgraph Observability["Observability"]
        OTEL[OpenTelemetry]
        Prometheus[Prometheus]
        Grafana[Grafana]
    end

    Browser --> Pages
    CLI --> tRPC
    Pages --> Components
    Components --> Hooks
    Hooks --> tRPC
    tRPC --> Middleware
    Middleware --> Routers
    Routers --> GitOps
    Routers --> Infra
    Routers --> Security
    Routers --> Export
    GitOps --> ArgoCD
    Infra --> Pulumi
    Security --> Trivy
    Routers --> Prisma
    Prisma --> PostgreSQL
    Middleware --> OTEL
    OTEL --> Prometheus
    Prometheus --> Grafana
```

## Component Descriptions

### Client Layer
- **Web Browser**: Primary user interface through Next.js application
- **CLI Tools**: Programmatic access via tRPC client

### Frontend Layer
- **React Pages**: Next.js pages with App Router
- **UI Components**: Shadcn/UI + Tailwind CSS components
- **React Query Hooks**: tRPC client hooks for data fetching

### API Layer
- **tRPC Server**: Type-safe RPC server
- **Router Modules**: Domain-specific routers (gitops, infrastructure, etc.)
- **Middleware**: Authentication (NextAuth) and OpenTelemetry tracing

### Service Layer
- **GitOps Service**: ArgoCD integration for Kubernetes deployments
- **Infrastructure Service**: Pulumi Automation API for IaC
- **Security Service**: Vulnerability scanning with Trivy
- **Export Service**: Helm/Kustomize/YAML generation

### External Services
- **ArgoCD**: GitOps continuous delivery
- **Pulumi Cloud**: Infrastructure state management
- **Trivy**: Container vulnerability scanning

### Data Layer
- **Prisma ORM**: Type-safe database access
- **PostgreSQL**: Primary data store
- **Redis**: Session and cache storage

### Observability
- **OpenTelemetry**: Distributed tracing
- **Prometheus**: Metrics collection
- **Grafana**: Visualization dashboards

---

## Data Flow Diagram

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant A as API (tRPC)
    participant S as Service
    participant E as External
    participant D as Database

    U->>F: User Action
    F->>A: tRPC Query/Mutation
    A->>A: Auth Middleware
    A->>A: OTEL Middleware
    A->>S: Service Call
    
    alt GitOps Operation
        S->>E: ArgoCD CLI
        E-->>S: Result
    else Infrastructure Operation
        S->>E: Pulumi API
        E-->>S: Stack Output
    else Database Operation
        S->>D: Prisma Query
        D-->>S: Data
    end
    
    S-->>A: Response
    A-->>F: Type-safe Response
    F-->>U: UI Update
```

---

## Deployment Architecture

```mermaid
graph TB
    subgraph Production["Production Environment"]
        subgraph K8s["Kubernetes Cluster"]
            Ingress[Ingress Controller]
            App[App Pods]
            Jobs[CronJobs]
        end
        
        subgraph Monitoring["Monitoring Stack"]
            Prom[Prometheus]
            Graf[Grafana]
            Alert[AlertManager]
            OTEL[OTEL Collector]
        end
        
        subgraph Data["Data Services"]
            PG[(PostgreSQL RDS)]
            Redis[(Redis ElastiCache)]
        end
    end

    subgraph CI_CD["CI/CD Pipeline"]
        GitLab[GitLab CI]
        ArgoCD[ArgoCD]
    end

    Internet((Internet)) --> Ingress
    Ingress --> App
    App --> PG
    App --> Redis
    App --> OTEL
    OTEL --> Prom
    Prom --> Graf
    Prom --> Alert
    GitLab --> ArgoCD
    ArgoCD --> K8s
```

## Environment Configuration

| Environment | Cluster | Database | Cache |
|-------------|---------|----------|-------|
| Development | Local (Docker) | PostgreSQL (local) | Redis (local) |
| Staging | EKS staging | RDS PostgreSQL | ElastiCache |
| Production | EKS production | RDS PostgreSQL (Multi-AZ) | ElastiCache |

## Security Boundaries

```mermaid
graph TB
    subgraph Public["Public Zone"]
        Internet((Internet))
        CDN[CloudFront CDN]
    end

    subgraph DMZ["DMZ"]
        ALB[Application Load Balancer]
        WAF[AWS WAF]
    end

    subgraph Private["Private Zone"]
        App[Application Pods]
        Workers[Background Workers]
    end

    subgraph Data["Data Zone"]
        DB[(Database)]
        Cache[(Cache)]
        Secrets[Secrets Manager]
    end

    Internet --> CDN
    CDN --> WAF
    WAF --> ALB
    ALB --> App
    App --> DB
    App --> Cache
    App --> Secrets
    Workers --> DB
```

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, React 18, TypeScript |
| Styling | Tailwind CSS, Shadcn/UI |
| API | tRPC v11 |
| Database | PostgreSQL 15, Prisma ORM |
| Cache | Redis 7 |
| Auth | NextAuth.js v5 |
| Observability | OpenTelemetry, Prometheus, Grafana |
| GitOps | ArgoCD |
| IaC | Pulumi |
| Container | Docker, Kubernetes |
