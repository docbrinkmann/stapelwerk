# API Reference

This document provides a comprehensive reference for all Enterprise Team Features APIs, including authentication, organization management, collaboration, workflows, and more.

## Table of Contents

- [Authentication](#authentication)
- [Organization Management](#organization-management)
- [User Management](#user-management)
- [RBAC & Permissions](#rbac--permissions)
- [Real-Time Collaboration](#real-time-collaboration)
- [Approval Workflows](#approval-workflows)
- [Enterprise Templates](#enterprise-templates)
- [Audit Logging](#audit-logging)
- [AI Recommendations](#ai-recommendations)
- [Feature Flags](#feature-flags)
- [Monitoring](#monitoring)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Webhooks](#webhooks)

## Base URL

```
Production: https://api.stapelwerk.com
Development: http://localhost:3000/api
```

## Authentication

All API requests require authentication using JWT tokens provided through NextAuth.js sessions.

### Headers

```http
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

### Session Context

Each request includes organization context in the session:

```typescript
interface SessionContext {
  user: {
    id: string
    email: string
    name: string
  }
  organizationId?: string
  role?: 'owner' | 'admin' | 'member' | 'viewer'
  permissions?: string[]
}
```

## Organization Management

### Create Organization

```http
POST /api/trpc/organization.create
```

**Request Body:**
```json
{
  "name": "Acme Corporation",
  "slug": "acme-corp",
  "description": "Leading innovation company",
  "settings": {
    "allowPublicTemplates": true,
    "requireApprovalForDeployments": true,
    "auditLogRetentionDays": 2555
  }
}
```

**Response:**
```json
{
  "id": "org_1234567890",
  "name": "Acme Corporation",
  "slug": "acme-corp",
  "description": "Leading innovation company",
  "settings": { ... },
  "createdAt": "2024-01-10T12:00:00Z",
  "updatedAt": "2024-01-10T12:00:00Z",
  "memberCount": 1,
  "stackCount": 0
}
```

### List Organizations

```http
GET /api/trpc/organization.list
```

**Query Parameters:**
- `page`: Page number (default: 1)
- `pageSize`: Items per page (default: 20, max: 100)
- `search`: Search term for name/description

**Response:**
```json
{
  "items": [
    {
      "id": "org_1234567890",
      "name": "Acme Corporation",
      "slug": "acme-corp",
      "description": "Leading innovation company",
      "memberCount": 15,
      "stackCount": 8,
      "role": "admin",
      "createdAt": "2024-01-10T12:00:00Z"
    }
  ],
  "totalCount": 1,
  "hasNextPage": false
}
```

### Update Organization

```http
PUT /api/trpc/organization.update
```

**Request Body:**
```json
{
  "organizationId": "org_1234567890",
  "name": "Acme Corporation Ltd",
  "description": "Updated description",
  "settings": {
    "allowPublicTemplates": false
  }
}
```

**Required Permission:** `organization:update`

### Delete Organization

```http
DELETE /api/trpc/organization.delete
```

**Request Body:**
```json
{
  "organizationId": "org_1234567890"
}
```

**Required Permission:** `organization:delete`

### Member Management

#### Invite Member

```http
POST /api/trpc/organization.inviteMember
```

**Request Body:**
```json
{
  "organizationId": "org_1234567890",
  "email": "john@example.com",
  "role": "member",
  "message": "Welcome to our team!"
}
```

**Response:**
```json
{
  "invitationId": "inv_1234567890",
  "email": "john@example.com",
  "role": "member",
  "expiresAt": "2024-01-17T12:00:00Z",
  "status": "pending"
}
```

#### List Members

```http
GET /api/trpc/organization.getMembers
```

**Query Parameters:**
- `organizationId`: Organization ID
- `page`: Page number (default: 1)
- `pageSize`: Items per page (default: 50)
- `role`: Filter by role

**Response:**
```json
{
  "items": [
    {
      "userId": "user_1234567890",
      "email": "john@example.com",
      "name": "John Doe",
      "role": "member",
      "joinedAt": "2024-01-10T12:00:00Z",
      "lastActiveAt": "2024-01-15T14:30:00Z"
    }
  ],
  "totalCount": 15
}
```

#### Update Member Role

```http
PUT /api/trpc/organization.updateMemberRole
```

**Request Body:**
```json
{
  "organizationId": "org_1234567890",
  "userId": "user_1234567890",
  "newRole": "admin"
}
```

**Required Permission:** `organization:manage_members`

#### Remove Member

```http
DELETE /api/trpc/organization.removeMember
```

**Request Body:**
```json
{
  "organizationId": "org_1234567890",
  "userId": "user_1234567890"
}
```

**Required Permission:** `organization:manage_members`

## Real-Time Collaboration

### WebSocket Connection

```javascript
// Connect to collaboration socket
const socket = io('/collaboration', {
  auth: {
    token: sessionToken,
    organizationId: 'org_1234567890'
  }
})
```

### Join Stack Collaboration

```http
POST /api/trpc/collaboration.joinSession
```

**Request Body:**
```json
{
  "stackId": "stack_1234567890",
  "organizationId": "org_1234567890"
}
```

**Response:**
```json
{
  "sessionId": "session_1234567890",
  "activeUsers": [
    {
      "userId": "user_1234567890",
      "name": "John Doe",
      "cursor": { "x": 100, "y": 200 },
      "lastSeen": "2024-01-10T14:30:00Z"
    }
  ],
  "stackConfig": { ... }
}
```

### Apply Operation

```http
POST /api/trpc/collaboration.applyOperation
```

**Request Body:**
```json
{
  "stackId": "stack_1234567890",
  "operation": {
    "type": "replace",
    "path": "/services/api/image",
    "value": "node:18-alpine",
    "userId": "user_1234567890",
    "timestamp": 1704902400000
  }
}
```

**Response:**
```json
{
  "operationId": "op_1234567890",
  "applied": true,
  "conflicts": [],
  "finalValue": "node:18-alpine"
}
```

### WebSocket Events

#### Outgoing Events

```javascript
// Apply an operation
socket.emit('operation', {
  stackId: 'stack_1234567890',
  operation: {
    type: 'replace',
    path: '/services/api/ports',
    value: ['3000:3000'],
    userId: 'user_1234567890',
    timestamp: Date.now()
  }
})

// Update cursor position
socket.emit('cursor', {
  stackId: 'stack_1234567890',
  position: { x: 150, y: 250 }
})

// Send user activity
socket.emit('activity', {
  stackId: 'stack_1234567890',
  type: 'editing',
  data: { component: 'services' }
})
```

#### Incoming Events

```javascript
// Operation applied
socket.on('operation_applied', (data) => {
  console.log('Operation applied:', data)
})

// User cursor updated
socket.on('user_cursor', (data) => {
  console.log('User cursor:', data)
})

// User joined/left
socket.on('user_joined', (user) => {
  console.log('User joined:', user)
})

socket.on('user_left', (user) => {
  console.log('User left:', user)
})

// Conflict detected
socket.on('conflict', (conflict) => {
  console.log('Conflict detected:', conflict)
})
```

## Approval Workflows

### Create Workflow

```http
POST /api/trpc/workflow.create
```

**Request Body:**
```json
{
  "stackId": "stack_1234567890",
  "organizationId": "org_1234567890",
  "title": "Add Redis Service",
  "description": "Adding Redis for session storage",
  "changes": {
    "services": {
      "redis": {
        "image": "redis:7-alpine",
        "ports": ["6379:6379"]
      }
    }
  },
  "requestedBy": "user_1234567890"
}
```

**Response:**
```json
{
  "id": "workflow_1234567890",
  "status": "draft",
  "title": "Add Redis Service",
  "description": "Adding Redis for session storage",
  "changes": { ... },
  "createdAt": "2024-01-10T12:00:00Z",
  "requestedBy": {
    "id": "user_1234567890",
    "name": "John Doe"
  }
}
```

### Submit Workflow for Approval

```http
POST /api/trpc/workflow.submit
```

**Request Body:**
```json
{
  "workflowId": "workflow_1234567890",
  "message": "Ready for review - tested locally"
}
```

**Response:**
```json
{
  "id": "workflow_1234567890",
  "status": "pending",
  "submittedAt": "2024-01-10T12:30:00Z"
}
```

### List Workflows

```http
GET /api/trpc/workflow.list
```

**Query Parameters:**
- `organizationId`: Organization ID
- `stackId`: Filter by stack (optional)
- `status`: Filter by status (optional)
- `page`: Page number (default: 1)
- `pageSize`: Items per page (default: 20)

**Response:**
```json
{
  "items": [
    {
      "id": "workflow_1234567890",
      "title": "Add Redis Service",
      "status": "pending",
      "stackName": "My API Stack",
      "requestedBy": {
        "name": "John Doe"
      },
      "createdAt": "2024-01-10T12:00:00Z",
      "commentCount": 3
    }
  ],
  "totalCount": 5
}
```

### Approve/Reject Workflow

```http
POST /api/trpc/workflow.approve
```

**Request Body:**
```json
{
  "workflowId": "workflow_1234567890",
  "action": "approve",
  "comment": "LGTM! Deploying to staging first."
}
```

**Required Permission:** `workflow:approve`

### Add Comment

```http
POST /api/trpc/workflow.addComment
```

**Request Body:**
```json
{
  "workflowId": "workflow_1234567890",
  "content": "Could we use Redis 6 instead for compatibility?",
  "mentions": ["user_0987654321"]
}
```

**Response:**
```json
{
  "id": "comment_1234567890",
  "content": "Could we use Redis 6 instead for compatibility?",
  "author": {
    "id": "user_1234567890",
    "name": "Jane Smith"
  },
  "mentions": [
    {
      "id": "user_0987654321",
      "name": "John Doe"
    }
  ],
  "createdAt": "2024-01-10T13:15:00Z"
}
```

### Deploy Workflow

```http
POST /api/trpc/workflow.deploy
```

**Request Body:**
```json
{
  "workflowId": "workflow_1234567890",
  "environment": "production"
}
```

**Required Permission:** `workflow:deploy`

## Feature Flags

### Evaluate Flag

```http
POST /api/trpc/featureFlag.evaluate
```

**Request Body:**
```json
{
  "flagKey": "enterprise_collaboration",
  "context": {
    "userId": "user_1234567890",
    "organizationId": "org_1234567890",
    "plan": "enterprise",
    "environment": "production"
  }
}
```

**Response:**
```json
{
  "flagKey": "enterprise_collaboration",
  "value": true,
  "variant": null,
  "reason": "rule_match",
  "ruleId": "rule_1234567890",
  "timestamp": "2024-01-10T12:00:00Z"
}
```

### Bulk Evaluate Flags

```http
POST /api/trpc/featureFlag.evaluateMultiple
```

**Request Body:**
```json
{
  "flagKeys": ["enterprise_collaboration", "new_dashboard_ui", "beta_features"],
  "context": {
    "userId": "user_1234567890",
    "organizationId": "org_1234567890",
    "plan": "enterprise"
  }
}
```

**Response:**
```json
{
  "enterprise_collaboration": {
    "value": true,
    "reason": "rule_match"
  },
  "new_dashboard_ui": {
    "value": "variant_a",
    "variant": "variant_a",
    "reason": "variant_selected"
  },
  "beta_features": {
    "value": false,
    "reason": "not_in_rollout"
  }
}
```

### Create Flag (Admin)

```http
POST /api/trpc/featureFlag.create
```

**Request Body:**
```json
{
  "key": "new_feature",
  "name": "New Feature Toggle",
  "description": "Controls access to the new feature",
  "type": "boolean",
  "defaultValue": false,
  "environments": ["staging", "production"],
  "rolloutPercentage": 25,
  "tags": ["experiment", "ui"]
}
```

**Required Permission:** `feature_flags:manage`

### Update Flag

```http
PUT /api/trpc/featureFlag.update
```

**Request Body:**
```json
{
  "flagKey": "new_feature",
  "enabled": true,
  "rolloutPercentage": 50,
  "environments": ["staging", "production"]
}
```

**Required Permission:** `feature_flags:manage`

### List Flags

```http
GET /api/trpc/featureFlag.list
```

**Query Parameters:**
- `tag`: Filter by tag (optional)
- `environment`: Filter by environment (optional)
- `enabled`: Filter by enabled status (optional)

**Response:**
```json
{
  "items": [
    {
      "id": "flag_1234567890",
      "key": "enterprise_collaboration",
      "name": "Enterprise Collaboration",
      "enabled": true,
      "rolloutPercentage": 75,
      "environments": ["production"],
      "evaluations": 1250,
      "tags": ["enterprise", "collaboration"]
    }
  ]
}
```

### A/B Test Results

```http
GET /api/trpc/featureFlag.getABTestResults
```

**Query Parameters:**
- `testId`: A/B test ID
- `startDate`: Start date for results (optional)
- `endDate`: End date for results (optional)

**Response:**
```json
{
  "test": {
    "id": "test_1234567890",
    "name": "Dashboard UI Test",
    "flagKey": "new_dashboard_ui"
  },
  "results": {
    "control": {
      "variant": "control",
      "evaluations": 1600,
      "uniqueUsers": 1600,
      "conversions": 240,
      "conversionRate": 0.15
    },
    "variant_a": {
      "variant": "variant_a", 
      "evaluations": 1600,
      "uniqueUsers": 1600,
      "conversions": 280,
      "conversionRate": 0.175
    }
  },
  "totalEvaluations": 3200,
  "totalUniqueUsers": 3200,
  "statisticalSignificance": 0.95
}
```

## Audit Logging

### Query Audit Logs

```http
GET /api/trpc/audit.getLogs
```

**Query Parameters:**
- `organizationId`: Organization ID
- `startDate`: Start date (ISO 8601)
- `endDate`: End date (ISO 8601)
- `action`: Filter by action (optional)
- `userId`: Filter by user (optional)
- `page`: Page number (default: 1)
- `pageSize`: Items per page (default: 50, max: 200)

**Response:**
```json
{
  "items": [
    {
      "id": "audit_1234567890",
      "action": "workflow.approved",
      "userId": "user_1234567890",
      "organizationId": "org_1234567890",
      "metadata": {
        "workflowId": "workflow_1234567890",
        "stackId": "stack_1234567890",
        "approver": "user_0987654321"
      },
      "timestamp": "2024-01-10T12:30:00Z",
      "ipAddress": "***.***.***",
      "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)..."
    }
  ],
  "totalCount": 156,
  "hasNextPage": true
}
```

### Export Audit Logs

```http
POST /api/trpc/audit.exportLogs
```

**Request Body:**
```json
{
  "organizationId": "org_1234567890",
  "startDate": "2024-01-01T00:00:00Z",
  "endDate": "2024-01-31T23:59:59Z",
  "format": "csv",
  "filters": {
    "actions": ["workflow.approved", "stack.deployed"],
    "users": ["user_1234567890"]
  }
}
```

**Response:**
```json
{
  "exportId": "export_1234567890",
  "status": "processing",
  "estimatedCompletionTime": "2024-01-10T12:35:00Z"
}
```

### Generate Compliance Report

```http
POST /api/trpc/audit.generateComplianceReport
```

**Request Body:**
```json
{
  "organizationId": "org_1234567890",
  "complianceType": "SOX",
  "startDate": "2024-01-01T00:00:00Z",
  "endDate": "2024-01-31T23:59:59Z",
  "includeRecommendations": true
}
```

**Response:**
```json
{
  "reportId": "report_1234567890",
  "complianceType": "SOX",
  "score": 0.95,
  "summary": {
    "totalEvents": 1247,
    "compliantEvents": 1186,
    "nonCompliantEvents": 61
  },
  "recommendations": [
    "Enable audit logging for stack modifications",
    "Implement approval workflow for production deployments"
  ],
  "generatedAt": "2024-01-10T12:00:00Z",
  "downloadUrl": "/api/reports/report_1234567890.pdf"
}
```

## Monitoring

### Get Dashboard Data

```http
GET /api/trpc/monitoring.getDashboard
```

**Response:**
```json
{
  "healthStatus": "healthy",
  "systemMetrics": {
    "totalOrganizations": 127,
    "totalUsers": 2543,
    "activeCollaborationSessions": 34,
    "auditLogsLast24h": 15632
  },
  "recentHealthChecks": {
    "database": [
      {
        "service": "database",
        "status": "healthy",
        "responseTime": 45,
        "timestamp": "2024-01-10T12:00:00Z"
      }
    ]
  },
  "activeAlerts": [
    {
      "id": "alert_1234567890",
      "severity": "medium",
      "service": "websocket",
      "message": "WebSocket response time above threshold",
      "timestamp": "2024-01-10T11:55:00Z"
    }
  ],
  "timestamp": "2024-01-10T12:00:00Z"
}
```

### Record Custom Metric

```http
POST /api/trpc/monitoring.recordMetric
```

**Request Body:**
```json
{
  "name": "custom_operation_duration",
  "value": 156.7,
  "tags": {
    "operation": "stack_deploy",
    "environment": "production",
    "organizationId": "org_1234567890"
  }
}
```

### Query Metrics

```http
GET /api/trpc/monitoring.getMetrics
```

**Query Parameters:**
- `name`: Metric name
- `startDate`: Start date (ISO 8601)
- `endDate`: End date (ISO 8601)
- `tags`: Filter by tags (JSON object as string)

**Response:**
```json
{
  "metrics": [
    {
      "name": "health_check_response_time",
      "value": 45,
      "tags": {
        "service": "database"
      },
      "timestamp": "2024-01-10T12:00:00Z"
    }
  ]
}
```

## Error Handling

All API errors follow a consistent format:

### Error Response Format

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "You don't have permission to access this resource",
    "details": {
      "requiredPermission": "organization:update",
      "userRole": "member"
    },
    "timestamp": "2024-01-10T12:00:00Z",
    "traceId": "trace_1234567890"
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Authentication required or failed |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `CONFLICT` | 409 | Resource conflict (e.g., duplicate) |
| `RATE_LIMITED` | 429 | Rate limit exceeded |
| `INTERNAL_ERROR` | 500 | Internal server error |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable |

### Validation Errors

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": {
      "fields": {
        "email": "Invalid email format",
        "organizationId": "Organization ID is required"
      }
    }
  }
}
```

## Rate Limiting

API requests are rate limited per user and organization:

### Rate Limits

| Endpoint Type | Limit | Window |
|---------------|--------|---------|
| **Authentication** | 10 requests | 15 minutes |
| **Read Operations** | 1000 requests | 15 minutes |
| **Write Operations** | 200 requests | 15 minutes |
| **WebSocket Connections** | 50 connections | per user |
| **Export Operations** | 5 requests | 1 hour |

### Rate Limit Headers

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1704902400
X-RateLimit-Window: 900
```

### Rate Limit Exceeded Response

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Rate limit exceeded",
    "details": {
      "limit": 1000,
      "window": 900,
      "resetAt": "2024-01-10T12:15:00Z"
    }
  }
}
```

## Webhooks

### Webhook Events

Configure webhook endpoints to receive real-time notifications:

#### Organization Events
- `organization.created`
- `organization.updated`
- `organization.deleted`
- `organization.member_invited`
- `organization.member_joined`
- `organization.member_removed`

#### Workflow Events
- `workflow.created`
- `workflow.submitted`
- `workflow.approved`
- `workflow.rejected`
- `workflow.deployed`
- `workflow.comment_added`

#### Collaboration Events
- `collaboration.session_started`
- `collaboration.session_ended`
- `collaboration.operation_applied`
- `collaboration.conflict_detected`

#### System Events
- `system.alert_triggered`
- `system.alert_resolved`
- `audit.compliance_violation`

### Webhook Payload Format

```json
{
  "event": "workflow.approved",
  "timestamp": "2024-01-10T12:30:00Z",
  "organizationId": "org_1234567890",
  "data": {
    "workflow": {
      "id": "workflow_1234567890",
      "title": "Add Redis Service",
      "approvedBy": {
        "id": "user_0987654321",
        "name": "Jane Smith"
      }
    }
  },
  "signature": "sha256=1a2b3c4d5e6f..."
}
```

### Webhook Configuration

```http
POST /api/trpc/webhook.create
```

**Request Body:**
```json
{
  "url": "https://your-app.com/webhooks/stapelwerk",
  "events": ["workflow.approved", "workflow.deployed"],
  "secret": "your-webhook-secret",
  "active": true
}
```

---

This API reference provides comprehensive coverage of all enterprise features. For implementation examples and detailed guides, see the feature-specific documentation in this directory.