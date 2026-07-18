# API Reference - Build My Stack

**Version:** 1.0.0
**Last Updated:** 2025-11-10
**Base URL:** `http://localhost:3000` (development) | `https://buildmystack.com` (production)

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Authentication](#authentication)
4. [Rate Limiting](#rate-limiting)
5. [Error Handling](#error-handling)
6. [API Endpoints](#api-endpoints)
   - [Health](#health-router)
   - [Services](#services-router)
   - [Categories](#categories-router)
   - [Stacks](#stacks-router)
   - [Templates](#templates-router)
   - [Recommendations](#recommendations-router)
   - [Community](#community-router)
   - [Deployments](#deployments-router)
   - [Workflows](#workflows-router)
   - [Organizations](#organizations-router)
   - [Performance](#performance-router)
   - [Admin](#admin-router)
   - [Imports](#imports-router)
7. [REST API Endpoints](#rest-api-endpoints)
8. [WebSocket Events](#websocket-events)
9. [Examples](#examples)

---

## Overview

Build My Stack uses [tRPC](https://trpc.io/) for type-safe API communication between client and server. All API calls are end-to-end type-safe with automatic TypeScript inference.

**Technology Stack:**
- **Framework:** Next.js 14 (App Router)
- **API Layer:** tRPC v11
- **Validation:** Zod
- **Database:** PostgreSQL (Prisma ORM)
- **Authentication:** NextAuth.js
- **Real-time:** Socket.IO (WebSocket)

**Key Features:**
- ✅ End-to-end type safety
- ✅ Automatic input/output validation
- ✅ Built-in rate limiting
- ✅ Performance monitoring
- ✅ CSRF protection
- ✅ Comprehensive error handling

---

## Architecture

### tRPC Request Flow

```
Client Request
    ↓
Next.js Middleware (CSRF, Security Headers, Rate Limiting)
    ↓
tRPC Handler (/api/trpc/[trpc])
    ↓
Performance Middleware (Timing, Metrics)
    ↓
Rate Limiting Middleware (IP-based)
    ↓
Authentication Middleware (Optional: protectedProcedure)
    ↓
Router Handler (Business Logic)
    ↓
Prisma ORM (Database)
    ↓
Response
```

### Procedure Types

| Type | Description | Use Case |
|------|-------------|----------|
| **publicProcedure** | No authentication required | Public data, search, categories |
| **protectedProcedure** | Authentication required | User-specific actions, save stack |
| **strictProcedure** | Authentication + strict rate limiting | Admin operations, sensitive data |

---

## Authentication

### Session-Based Auth (NextAuth.js)

Build My Stack uses NextAuth.js for session management. Authentication is handled via middleware and passed to tRPC context.

**Authentication Flow:**
1. User logs in via NextAuth.js
2. Session cookie stored (httpOnly, secure)
3. Middleware extracts session on each request
4. User ID passed to tRPC context
5. Protected procedures verify authentication

**Session Context:**
```typescript
{
  user: {
    id: string
    email: string
    name: string
    image?: string
  }
  userId: string  // Extracted from session
}
```

**Accessing Protected Endpoints:**

```typescript
// Protected endpoint (requires authentication)
const stack = await trpc.stacks.save.mutate({ name: "My Stack", ... })

// Public endpoint (no authentication)
const services = await trpc.services.list.query()
```

---

## Rate Limiting

### Global Rate Limits

All API endpoints are rate-limited to prevent abuse. Rate limits are enforced via middleware using Redis (production) or in-memory storage (development).

**Rate Limit Tiers:**

| Tier | Limit | Window | Applied To |
|------|-------|--------|-----------|
| **API** | 100 requests | 15 minutes | Standard API endpoints |
| **Public** | 1000 requests | 1 hour | Public routes, search |
| **Strict** | 10 requests | 1 minute | Admin, sensitive operations |
| **Auth** | 20 requests | 15 minutes | Authentication endpoints |

**Rate Limit Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 2025-11-10T12:00:00Z
```

**Rate Limit Exceeded Response:**
```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Please try again later.",
  "retryAfter": 60
}
```
**HTTP Status:** `429 Too Many Requests`

---

## Error Handling

### Error Response Format

All errors follow a consistent format:

```typescript
{
  error: {
    message: string
    code: string  // TRPC error code
    data?: {
      zodError?: object  // Validation errors
      path?: string      // Failed procedure path
    }
  }
}
```

### tRPC Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `BAD_REQUEST` | 400 | Invalid input |
| `INTERNAL_SERVER_ERROR` | 500 | Server error |
| `TIMEOUT` | 408 | Request timeout |
| `TOO_MANY_REQUESTS` | 429 | Rate limit exceeded |

### Validation Errors (Zod)

Input validation errors include detailed field-level information:

```json
{
  "error": {
    "message": "VALIDATION_ERROR",
    "code": "BAD_REQUEST",
    "data": {
      "zodError": {
        "formErrors": [],
        "fieldErrors": {
          "name": ["String must contain at least 3 character(s)"],
          "email": ["Invalid email"]
        }
      }
    }
  }
}
```

---

## API Endpoints

### Health Router

**Purpose:** System health checks and monitoring

#### `health.check`
**Type:** Query (Public)
**Description:** Check API health status

**Input:** None

**Output:**
```typescript
{
  status: "ok" | "degraded" | "error"
  timestamp: string  // ISO 8601
  database: "connected" | "disconnected"
  uptime: number     // seconds
}
```

**Example:**
```typescript
const health = await trpc.health.check.query()
console.log(health.status) // "ok"
```

---

### Services Router

**Purpose:** Browse and search available services

#### `services.list`
**Type:** Query (Public)
**Description:** List all services with pagination and filtering

**Input:**
```typescript
{
  search?: string           // Search query
  category?: string         // Filter by category
  featured?: boolean        // Show only featured
  limit?: number            // Default: 20, Max: 100
  cursor?: string           // Pagination cursor
}
```

**Output:**
```typescript
{
  services: Service[]
  nextCursor: string | null
  total: number
}

type Service = {
  id: string
  name: string
  slug: string
  description: string
  categoryId: string
  category: { id: string, name: string, slug: string }
  dockerImage: string
  logo: string | null
  featured: boolean
  popular: boolean
  ports: { containerPort: number, hostPort: number, protocol: string }[]
  environment: { key: string, value: string, description: string }[]
  volumes: { containerPath: string, hostPath: string }[]
  resources: { cpu: string, memory: string }
  documentation: string | null
  tags: string[]
  createdAt: string
  updatedAt: string
}
```

**Example:**
```typescript
const { services, nextCursor } = await trpc.services.list.query({
  search: "database",
  category: "databases",
  limit: 20
})
```

#### `services.getBySlug`
**Type:** Query (Public)
**Description:** Get single service by slug

**Input:**
```typescript
{
  slug: string  // e.g., "postgres", "redis"
}
```

**Output:**
```typescript
Service  // Full service details
```

**Example:**
```typescript
const postgres = await trpc.services.getBySlug.query({ slug: "postgres" })
console.log(postgres.dockerImage) // "postgres:16-alpine"
```

#### `services.search`
**Type:** Query (Public)
**Description:** Full-text search across services

**Input:**
```typescript
{
  query: string       // Search query
  limit?: number      // Default: 10
}
```

**Output:**
```typescript
{
  results: Service[]
  count: number
}
```

---

### Categories Router

**Purpose:** Service category management

#### `categories.list`
**Type:** Query (Public)
**Description:** List all service categories

**Input:** None

**Output:**
```typescript
Category[]

type Category = {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  serviceCount: number
  createdAt: string
  updatedAt: string
}
```

**Example:**
```typescript
const categories = await trpc.categories.list.query()
// ["databases", "development", "media", "communication", ...]
```

#### `categories.getBySlug`
**Type:** Query (Public)
**Description:** Get category with services

**Input:**
```typescript
{
  slug: string  // e.g., "databases"
}
```

**Output:**
```typescript
{
  ...Category
  services: Service[]  // All services in category
}
```

---

### Stacks Router

**Purpose:** User stack management

#### `stacks.save`
**Type:** Mutation (Protected)
**Description:** Save a new stack or update existing

**Input:**
```typescript
{
  id?: string                 // Update if provided
  name: string
  description?: string
  services: {
    serviceId: string
    name: string
    ports?: { containerPort: number, hostPort: number }[]
    environment?: { key: string, value: string }[]
    volumes?: { containerPath: string, hostPath: string }[]
  }[]
  tags?: string[]
  public?: boolean            // Share publicly
}
```

**Output:**
```typescript
{
  id: string
  name: string
  description: string | null
  userId: string
  services: StackService[]
  tags: string[]
  public: boolean
  shareId: string | null      // For public sharing
  createdAt: string
  updatedAt: string
}
```

**Example:**
```typescript
const stack = await trpc.stacks.save.mutate({
  name: "LAMP Stack",
  description: "Linux, Apache, MySQL, PHP",
  services: [
    { serviceId: "apache-id", name: "web-server" },
    { serviceId: "mysql-id", name: "database" },
    { serviceId: "php-id", name: "backend" }
  ],
  public: true
})
```

#### `stacks.list`
**Type:** Query (Protected)
**Description:** List user's saved stacks

**Input:**
```typescript
{
  limit?: number
  cursor?: string
}
```

**Output:**
```typescript
{
  stacks: Stack[]
  nextCursor: string | null
}
```

#### `stacks.getById`
**Type:** Query (Protected)
**Description:** Get stack by ID

**Input:**
```typescript
{
  id: string
}
```

**Output:**
```typescript
Stack  // Full stack with services
```

#### `stacks.delete`
**Type:** Mutation (Protected)
**Description:** Delete a stack

**Input:**
```typescript
{
  id: string
}
```

**Output:**
```typescript
{
  success: boolean
}
```

#### `stacks.share`
**Type:** Mutation (Protected)
**Description:** Generate public share link

**Input:**
```typescript
{
  id: string
  public: boolean  // Enable/disable sharing
}
```

**Output:**
```typescript
{
  shareId: string  // Public share identifier
  shareUrl: string
}
```

#### `stacks.getSharedStack`
**Type:** Query (Public)
**Description:** Get publicly shared stack

**Input:**
```typescript
{
  shareId: string
}
```

**Output:**
```typescript
{
  ...Stack
  author: { name: string }
  canEdit: false  // Always false for shared stacks
}
```

#### `stacks.exportDockerCompose`
**Type:** Query (Protected)
**Description:** Export stack as docker-compose.yml

**Input:**
```typescript
{
  id: string
  format?: "yaml" | "json"  // Default: yaml
}
```

**Output:**
```typescript
{
  content: string           // docker-compose.yml content
  filename: string
}
```

**Example:**
```typescript
const { content } = await trpc.stacks.exportDockerCompose.query({
  id: "stack-id"
})
// content: "version: '3.8'\nservices:\n  postgres:\n    image: postgres:16\n..."
```

---

### Templates Router

**Purpose:** Reusable stack templates

#### `templates.list`
**Type:** Query (Public)
**Description:** Browse stack templates

**Input:**
```typescript
{
  category?: string
  featured?: boolean
  limit?: number
  cursor?: string
}
```

**Output:**
```typescript
{
  templates: Template[]
  nextCursor: string | null
}

type Template = {
  id: string
  name: string
  description: string
  category: string
  services: TemplateService[]
  author: { name: string, avatar?: string }
  featured: boolean
  downloads: number
  rating: number
  tags: string[]
  createdAt: string
}
```

#### `templates.getById`
**Type:** Query (Public)
**Description:** Get template details

**Input:**
```typescript
{
  id: string
}
```

**Output:**
```typescript
Template  // Full template with configuration
```

#### `templates.useTemplate`
**Type:** Mutation (Protected)
**Description:** Create stack from template

**Input:**
```typescript
{
  templateId: string
  name?: string  // Override template name
}
```

**Output:**
```typescript
Stack  // New stack created from template
```

---

### Recommendations Router

**Purpose:** AI-powered service recommendations

#### `recommendations.get`
**Type:** Query (Public)
**Description:** Get personalized recommendations

**Input:**
```typescript
{
  services?: string[]       // Current services in stack
  category?: string         // Focus category
  limit?: number            // Default: 5
}
```

**Output:**
```typescript
{
  recommendations: Recommendation[]
}

type Recommendation = {
  service: Service
  reason: string            // Why recommended
  confidence: number        // 0.0 - 1.0
  category: "complements" | "alternatives" | "popular"
}
```

**Example:**
```typescript
const { recommendations } = await trpc.recommendations.get.query({
  services: ["postgres"],
  limit: 5
})
// Might recommend: pgAdmin, Redis, nginx
```

---

### Community Router

**Purpose:** Community marketplace and discovery

#### `community.getFeaturedStacks`
**Type:** Query (Public)
**Description:** Get featured community stacks

**Input:** None

**Output:**
```typescript
Stack[]  // Featured public stacks
```

#### `community.getPopularStacks`
**Type:** Query (Public)
**Description:** Get most popular stacks

**Input:**
```typescript
{
  limit?: number
  timeRange?: "day" | "week" | "month" | "all"
}
```

**Output:**
```typescript
{
  stacks: Stack[]
  total: number
}
```

#### `community.searchStacks`
**Type:** Query (Public)
**Description:** Search community stacks

**Input:**
```typescript
{
  query: string
  category?: string
  tags?: string[]
  limit?: number
}
```

**Output:**
```typescript
{
  stacks: Stack[]
  total: number
}
```

---

### Deployments Router

**Purpose:** Stack deployment management

#### `deployments.list`
**Type:** Query (Protected)
**Description:** List user deployments

**Input:**
```typescript
{
  status?: "pending" | "running" | "stopped" | "failed"
}
```

**Output:**
```typescript
{
  deployments: Deployment[]
}

type Deployment = {
  id: string
  stackId: string
  stack: Stack
  status: DeploymentStatus
  provider: "local" | "aws" | "gcp" | "azure"
  createdAt: string
  startedAt: string | null
  stoppedAt: string | null
}
```

#### `deployments.create`
**Type:** Mutation (Protected)
**Description:** Create new deployment

**Input:**
```typescript
{
  stackId: string
  provider: "local" | "aws" | "gcp" | "azure"
  config?: object  // Provider-specific configuration
}
```

**Output:**
```typescript
Deployment
```

#### `deployments.getStatus`
**Type:** Query (Protected)
**Description:** Get deployment status

**Input:**
```typescript
{
  id: string
}
```

**Output:**
```typescript
{
  ...Deployment
  services: {
    name: string
    status: "starting" | "running" | "stopped" | "error"
    health: "healthy" | "unhealthy" | "unknown"
    logs?: string[]
  }[]
}
```

---

### Workflows Router

**Purpose:** Workflow automation

#### `workflows.list`
**Type:** Query (Protected)
**Description:** List user workflows

**Input:** None

**Output:**
```typescript
Workflow[]

type Workflow = {
  id: string
  name: string
  description: string
  trigger: WorkflowTrigger
  actions: WorkflowAction[]
  enabled: boolean
  createdAt: string
}
```

#### `workflows.create`
**Type:** Mutation (Protected)
**Description:** Create automation workflow

**Input:**
```typescript
{
  name: string
  description?: string
  trigger: {
    type: "schedule" | "webhook" | "manual"
    config: object
  }
  actions: {
    type: string
    config: object
  }[]
}
```

**Output:**
```typescript
Workflow
```

---

### Organizations Router

**Purpose:** Organization/team management (Enterprise)

#### `organizations.list`
**Type:** Query (Protected)
**Description:** List user organizations

**Input:** None

**Output:**
```typescript
Organization[]

type Organization = {
  id: string
  name: string
  slug: string
  members: number
  role: "owner" | "admin" | "member"
  createdAt: string
}
```

#### `organizations.create`
**Type:** Mutation (Protected)
**Description:** Create new organization

**Input:**
```typescript
{
  name: string
  slug: string
}
```

**Output:**
```typescript
Organization
```

---

### Performance Router

**Purpose:** Application performance metrics (Enterprise)

#### `performance.getMetrics`
**Type:** Query (Protected)
**Description:** Get performance metrics

**Input:**
```typescript
{
  timeRange?: "hour" | "day" | "week" | "month"
}
```

**Output:**
```typescript
{
  metrics: {
    requestCount: number
    averageResponseTime: number
    errorRate: number
    p95ResponseTime: number
    p99ResponseTime: number
  }
  timeseries: {
    timestamp: string
    value: number
  }[]
}
```

---

### Admin Router

**Purpose:** Admin operations (Requires admin role)

#### `admin.getStats`
**Type:** Query (Strict)
**Description:** Get platform statistics

**Input:** None

**Output:**
```typescript
{
  users: { total: number, active: number }
  stacks: { total: number, public: number }
  services: { total: number, featured: number }
  deployments: { active: number, total: number }
}
```

#### `admin.moderateContent`
**Type:** Mutation (Strict)
**Description:** Moderate user content

**Input:**
```typescript
{
  type: "stack" | "template"
  id: string
  action: "approve" | "reject" | "flag"
  reason?: string
}
```

**Output:**
```typescript
{
  success: boolean
}
```

---

### Imports Router

**Purpose:** Import stacks from external sources

#### `imports.parseDockerCompose`
**Type:** Mutation (Public)
**Description:** Parse docker-compose.yml content

**Input:**
```typescript
{
  content: string  // YAML or JSON content
}
```

**Output:**
```typescript
{
  name: string
  services: ParsedService[]
  networks?: string[]
  volumes?: string[]
}

type ParsedService = {
  name: string
  image: string
  ports?: string[]
  environment?: Record<string, string>
  volumes?: string[]
  depends_on?: string[]
}
```

**Example:**
```typescript
const parsed = await trpc.imports.parseDockerCompose.mutate({
  content: `
version: '3.8'
services:
  postgres:
    image: postgres:16
    ports:
      - "5432:5432"
  `
})
```

---

## REST API Endpoints

### `/api/health`
**Method:** GET
**Auth:** Public
**Description:** Health check endpoint

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-11-10T12:00:00Z",
  "database": "connected",
  "uptime": 3600
}
```

### `/api/analytics/recommendations`
**Method:** GET
**Auth:** Public
**Description:** Get recommendation analytics

**Response:**
```json
{
  "recommendations": [
    {
      "serviceId": "postgres",
      "count": 1234,
      "trending": true
    }
  ]
}
```

---

## WebSocket Events

### Connection

**Endpoint:** `ws://localhost:3000` (Socket.IO)

**Authentication:** Session-based (cookies)

### Events

#### `stack:updated`
**Direction:** Server → Client
**Description:** Stack was updated

**Payload:**
```typescript
{
  stackId: string
  userId: string
  action: "create" | "update" | "delete"
  timestamp: string
}
```

#### `deployment:status`
**Direction:** Server → Client
**Description:** Deployment status changed

**Payload:**
```typescript
{
  deploymentId: string
  status: "pending" | "running" | "stopped" | "failed"
  timestamp: string
}
```

---

## Examples

### Complete Stack Creation Flow

```typescript
// 1. Browse services
const { services } = await trpc.services.list.query({
  category: "databases"
})

// 2. Get recommendations
const { recommendations } = await trpc.recommendations.get.query({
  services: ["postgres"]
})

// 3. Create stack
const stack = await trpc.stacks.save.mutate({
  name: "Full Stack App",
  description: "PostgreSQL + Redis + nginx",
  services: [
    { serviceId: "postgres-id", name: "database" },
    { serviceId: "redis-id", name: "cache" },
    { serviceId: "nginx-id", name: "webserver" }
  ],
  public: true
})

// 4. Export to Docker Compose
const { content } = await trpc.stacks.exportDockerCompose.query({
  id: stack.id
})

// 5. Share stack
const { shareUrl } = await trpc.stacks.share.mutate({
  id: stack.id,
  public: true
})
```

### Error Handling

```typescript
try {
  await trpc.stacks.save.mutate({
    name: "My Stack",
    services: []  // Empty services - will fail validation
  })
} catch (error) {
  if (error.data?.code === 'BAD_REQUEST') {
    console.error('Validation error:', error.data.zodError)
  } else if (error.data?.code === 'UNAUTHORIZED') {
    console.error('Please log in')
  } else {
    console.error('Server error:', error.message)
  }
}
```

### Pagination

```typescript
let cursor: string | null = null
const allServices: Service[] = []

do {
  const { services, nextCursor } = await trpc.services.list.query({
    limit: 50,
    cursor
  })

  allServices.push(...services)
  cursor = nextCursor
} while (cursor)

console.log(`Loaded ${allServices.length} services`)
```

---

## Best Practices

### 1. Type Safety
Always use the generated types from tRPC:
```typescript
import type { AppRouter } from '@/server/root'
import { createTRPCProxyClient } from '@trpc/client'

const trpc = createTRPCProxyClient<AppRouter>({ ... })
```

### 2. Error Handling
Always handle errors appropriately:
```typescript
try {
  const result = await trpc.stacks.save.mutate(input)
} catch (error) {
  // Handle specific error codes
  if (error.data?.code === 'UNAUTHORIZED') {
    router.push('/login')
  }
}
```

### 3. Rate Limiting
Respect rate limits and implement exponential backoff:
```typescript
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      if (error.data?.code === 'TOO_MANY_REQUESTS' && i < maxRetries - 1) {
        await sleep(Math.pow(2, i) * 1000)
      } else {
        throw error
      }
    }
  }
}
```

### 4. Caching
Use React Query (built into tRPC) for caching:
```typescript
const { data, isLoading, refetch } = trpc.services.list.useQuery({
  limit: 20
}, {
  staleTime: 5 * 60 * 1000,  // 5 minutes
  cacheTime: 10 * 60 * 1000  // 10 minutes
})
```

---

## Support

**Documentation:** [https://buildmystack.com/docs](https://buildmystack.com/docs)
**GitHub:** [https://github.com/buildmystack/buildmystack](https://github.com/buildmystack/buildmystack)
**Email:** support@buildmystack.com

---

**Last Updated:** 2025-11-10
**API Version:** 1.0.0
**Documentation Version:** 1.0.0
