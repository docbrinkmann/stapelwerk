# BuildMyStack API Documentation

**Version:** 1.0.0  
**Last Updated:** 2025-10-27  
**Base URL:** `https://build-my-stack.vercel.app`

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Health & Monitoring Endpoints](#health--monitoring-endpoints)
4. [Service Endpoints](#service-endpoints)
5. [Stack Endpoints](#stack-endpoints)
6. [Category Endpoints](#category-endpoints)
7. [Error Handling](#error-handling)
8. [Rate Limiting](#rate-limiting)

---

## Overview

BuildMyStack provides a RESTful API and tRPC endpoints for managing technology stacks, services, and recommendations. The API uses JSON for request and response payloads.

### API Architecture

- **Framework:** Next.js 14.2+ API Routes + tRPC
- **Database:** PostgreSQL 18 with Prisma ORM
- **Cache:** Redis 7 for performance optimization
- **Authentication:** NextAuth.js with JWT tokens
- **Rate Limiting:** Redis-based rate limiting

### Base URLs

- **Production:** `https://build-my-stack.vercel.app`
- **Staging:** `https://build-my-stack-staging.vercel.app`
- **Development:** `http://localhost:3000`

---

## Authentication

### Overview

BuildMyStack uses NextAuth.js for authentication with support for multiple providers.

### Authentication Methods

1. **OAuth Providers:**
   - GitHub
   - Google
   - GitLab

2. **Session Management:**
   - JWT-based sessions
   - Secure HTTP-only cookies
   - CSRF protection

### Authentication Headers

```http
Authorization: Bearer <jwt_token>
Cookie: next-auth.session-token=<session_token>
```

### Example: Login Flow

```typescript
// Client-side authentication
import { signIn, signOut, useSession } from 'next-auth/react';

// Sign in with provider
await signIn('github');

// Check session status
const { data: session, status } = useSession();

// Sign out
await signOut();
```

---

## Health & Monitoring Endpoints

### GET /api/health

Comprehensive health check endpoint for monitoring application status.

**Response:**

```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2025-10-27T20:00:00Z",
  "uptime": 3600,
  "components": {
    "database": {
      "status": "healthy",
      "responseTime": 5,
      "details": {
        "connections": 18,
        "maxConnections": 100,
        "version": "PostgreSQL 18.0"
      }
    },
    "redis": {
      "status": "healthy",
      "responseTime": 2,
      "details": {
        "memory": "15MB",
        "connectedClients": 3
      }
    },
    "metrics": {
      "status": "healthy",
      "endpoint": "/api/metrics"
    }
  },
  "performance": {
    "avgResponseTime": 13,
    "requestsPerMinute": 150,
    "errorRate": 0.02
  },
  "alerts": []
}
```

**Status Codes:**
- `200 OK` - All components healthy
- `503 Service Unavailable` - One or more components unhealthy

---

### GET /api/metrics

Prometheus-compatible metrics endpoint for monitoring and alerting.

**Response Format:** Prometheus text format

**Example Response:**

```
# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",route="/api/services",status="200"} 1542

# HELP http_request_duration_seconds HTTP request duration in seconds
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{method="GET",route="/api/services",le="0.1"} 1234
http_request_duration_seconds_bucket{method="GET",route="/api/services",le="0.5"} 1520
http_request_duration_seconds_bucket{method="GET",route="/api/services",le="1"} 1540

# HELP services_viewed_total Total number of service views
# TYPE services_viewed_total counter
services_viewed_total 5432

# HELP stacks_created_total Total number of stacks created
# TYPE stacks_created_total counter
stacks_created_total 234
```

**Custom Metrics:**
- `http_requests_total` - Total HTTP requests by method, route, status
- `http_request_duration_seconds` - Request duration histogram
- `services_viewed_total` - Total service view count
- `stacks_created_total` - Total stack creation count
- `recommendations_generated_total` - Total AI recommendations generated

---

## Service Endpoints

### GET /api/services

Retrieve a list of all available services with optional filtering and pagination.

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | number | No | 1 | Page number for pagination |
| `limit` | number | No | 20 | Items per page (max 100) |
| `category` | string | No | - | Filter by category slug |
| `search` | string | No | - | Search in name and description |
| `status` | enum | No | `published` | Filter by status: `draft`, `published`, `archived` |
| `featured` | boolean | No | - | Filter featured services only |
| `sort` | enum | No | `name` | Sort by: `name`, `createdAt`, `popularity` |
| `order` | enum | No | `asc` | Sort order: `asc`, `desc` |

**Example Request:**

```http
GET /api/services?category=frontend&featured=true&limit=10&sort=popularity&order=desc
```

**Example Response:**

```json
{
  "services": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "React",
      "slug": "react",
      "description": "A JavaScript library for building user interfaces",
      "icon": "/icons/react.svg",
      "category": {
        "id": "cat-1",
        "name": "Frontend",
        "slug": "frontend"
      },
      "tags": ["javascript", "ui", "spa", "library"],
      "featured": true,
      "status": "published",
      "metadata": {
        "website": "https://react.dev",
        "github": "https://github.com/facebook/react",
        "documentation": "https://react.dev/learn",
        "license": "MIT"
      },
      "requirements": {
        "nodejs": ">=18.0.0",
        "npm": ">=9.0.0"
      },
      "popularity": 95,
      "createdAt": "2025-01-15T10:30:00Z",
      "updatedAt": "2025-10-20T14:22:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 156,
    "totalPages": 16,
    "hasNext": true,
    "hasPrevious": false
  }
}
```

**Status Codes:**
- `200 OK` - Services retrieved successfully
- `400 Bad Request` - Invalid query parameters
- `500 Internal Server Error` - Server error

---

### GET /api/services/:id

Retrieve detailed information about a specific service.

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | UUID | Yes | Service ID or slug |

**Example Request:**

```http
GET /api/services/react
```

**Example Response:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "React",
  "slug": "react",
  "description": "A JavaScript library for building user interfaces. React makes it painless to create interactive UIs with a component-based architecture.",
  "longDescription": "React is a declarative, efficient, and flexible JavaScript library...",
  "icon": "/icons/react.svg",
  "category": {
    "id": "cat-1",
    "name": "Frontend",
    "slug": "frontend",
    "description": "Frontend frameworks and libraries"
  },
  "tags": ["javascript", "ui", "spa", "library", "hooks"],
  "featured": true,
  "status": "published",
  "metadata": {
    "website": "https://react.dev",
    "github": "https://github.com/facebook/react",
    "documentation": "https://react.dev/learn",
    "npmPackage": "react",
    "license": "MIT",
    "stars": 220000,
    "downloads": 20000000
  },
  "requirements": {
    "nodejs": ">=18.0.0",
    "npm": ">=9.0.0"
  },
  "features": [
    "Component-based architecture",
    "Virtual DOM for performance",
    "Hooks for state management",
    "Large ecosystem",
    "Server-side rendering support"
  ],
  "useCases": [
    "Single Page Applications (SPAs)",
    "Progressive Web Apps (PWAs)",
    "Mobile apps with React Native",
    "Static sites with Next.js"
  ],
  "alternatives": ["Vue.js", "Angular", "Svelte"],
  "compatibility": {
    "nextjs": "✅ Full support",
    "typescript": "✅ Native support",
    "tailwind": "✅ Compatible"
  },
  "popularity": 95,
  "viewCount": 15432,
  "createdAt": "2025-01-15T10:30:00Z",
  "updatedAt": "2025-10-20T14:22:00Z"
}
```

**Status Codes:**
- `200 OK` - Service retrieved successfully
- `404 Not Found` - Service not found
- `500 Internal Server Error` - Server error

---

## Stack Endpoints

### GET /api/stacks

Retrieve user's technology stacks (requires authentication).

**Authentication:** Required

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | number | No | 1 | Page number |
| `limit` | number | No | 20 | Items per page |
| `isPublic` | boolean | No | - | Filter public/private stacks |

**Example Request:**

```http
GET /api/stacks?limit=10
Authorization: Bearer <jwt_token>
```

**Example Response:**

```json
{
  "stacks": [
    {
      "id": "stack-1",
      "name": "My E-commerce Stack",
      "description": "Full-stack e-commerce platform",
      "services": [
        {
          "id": "react-1",
          "name": "React",
          "category": "Frontend"
        },
        {
          "id": "nextjs-1",
          "name": "Next.js",
          "category": "Framework"
        },
        {
          "id": "postgres-1",
          "name": "PostgreSQL",
          "category": "Database"
        }
      ],
      "isPublic": true,
      "userId": "user-123",
      "createdAt": "2025-10-15T08:30:00Z",
      "updatedAt": "2025-10-25T12:15:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 5,
    "totalPages": 1
  }
}
```

---

### POST /api/stacks

Create a new technology stack (requires authentication).

**Authentication:** Required

**Request Body:**

```json
{
  "name": "My Full-Stack Project",
  "description": "Modern web application stack",
  "serviceIds": [
    "550e8400-e29b-41d4-a716-446655440000",
    "660e8400-e29b-41d4-a716-446655440001"
  ],
  "isPublic": false
}
```

**Response:**

```json
{
  "id": "stack-456",
  "name": "My Full-Stack Project",
  "description": "Modern web application stack",
  "services": [...],
  "isPublic": false,
  "userId": "user-123",
  "createdAt": "2025-10-27T20:30:00Z",
  "updatedAt": "2025-10-27T20:30:00Z"
}
```

**Status Codes:**
- `201 Created` - Stack created successfully
- `400 Bad Request` - Invalid request body
- `401 Unauthorized` - Authentication required
- `500 Internal Server Error` - Server error

---

## Category Endpoints

### GET /api/categories

Retrieve all service categories.

**Example Response:**

```json
{
  "categories": [
    {
      "id": "cat-1",
      "name": "Frontend",
      "slug": "frontend",
      "description": "Frontend frameworks and libraries",
      "icon": "/icons/frontend.svg",
      "serviceCount": 45,
      "order": 1
    },
    {
      "id": "cat-2",
      "name": "Backend",
      "slug": "backend",
      "description": "Backend frameworks and runtimes",
      "icon": "/icons/backend.svg",
      "serviceCount": 38,
      "order": 2
    }
  ]
}
```

---

## Error Handling

### Error Response Format

All API errors follow a consistent format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": [
      {
        "field": "limit",
        "message": "Must be between 1 and 100"
      }
    ],
    "timestamp": "2025-10-27T20:30:00Z",
    "requestId": "req-abc123"
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid request parameters |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable |

---

## Rate Limiting

### Limits

- **Anonymous users:** 60 requests per minute
- **Authenticated users:** 120 requests per minute
- **Premium users:** 300 requests per minute

### Rate Limit Headers

```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1698432000
```

### Rate Limit Exceeded Response

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests",
    "retryAfter": 42,
    "timestamp": "2025-10-27T20:30:00Z"
  }
}
```

---

## Webhooks (Future Feature)

Coming soon: Webhook support for real-time notifications on stack updates, service changes, and recommendations.

---

## Support

For API support and questions:
- **Documentation:** https://build-my-stack.vercel.app/docs
- **GitHub Issues:** https://github.com/yourusername/build-my-stack/issues
- **Email:** support@buildmystack.com

---

**Last Updated:** 2025-10-27  
**API Version:** 1.0.0  
**Documentation Version:** 1.0.0
