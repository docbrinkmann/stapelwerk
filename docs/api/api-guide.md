# Build My Stack API Guide

This guide covers authentication, API usage patterns, and code examples for integrating with the Build My Stack API.

## Table of Contents

- [Authentication](#authentication)
- [API Overview](#api-overview)
- [GitOps API](#gitops-api)
- [Infrastructure API](#infrastructure-api)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Code Examples](#code-examples)

---

## Authentication

Build My Stack uses NextAuth.js for authentication with session-based cookies.

### Session Authentication

Protected endpoints require a valid session cookie obtained through the authentication flow.

```typescript
// Client-side authentication with NextAuth
import { signIn, signOut, useSession } from 'next-auth/react';

// Check authentication status
const { data: session, status } = useSession();

// Sign in with providers
await signIn('github');  // GitHub OAuth
await signIn('google');  // Google OAuth
```

### API Authorization Levels

| Level | Endpoints | Description |
|-------|-----------|-------------|
| Public | `health.*`, `*.list*` | No authentication required |
| Protected | Most mutation endpoints | Requires valid user session |
| Admin | `admin.*` | Requires admin role |

### Using with tRPC Client

```typescript
import { api } from '@/utils/api';

// Public queries work without authentication
const { data: apps } = api.gitops.listApplications.useQuery({});

// Protected mutations require session
const deployMutation = api.gitops.deployStack.useMutation({
  onSuccess: (data) => {
    console.log('Deployed:', data.applicationName);
  },
  onError: (error) => {
    if (error.data?.code === 'UNAUTHORIZED') {
      // Redirect to login
    }
  },
});
```

---

## API Overview

### Base URL

| Environment | Base URL |
|-------------|----------|
| Development | `http://localhost:3000/api/trpc` |
| Staging | `https://staging.stapelwerk.dev/api/trpc` |
| Production | `https://stapelwerk.dev/api/trpc` |

### Router Structure

The API is organized into routers by domain:

- `gitops` - ArgoCD GitOps operations
- `infrastructure` - Pulumi infrastructure provisioning
- `stacks` - Technology stack management
- `services` - Service catalog
- `deployments` - Deployment management
- `monitoring` - Monitoring and metrics
- `health` - Health checks

---

## GitOps API

The GitOps API provides endpoints for managing ArgoCD applications.

### List Applications

Returns all ArgoCD applications.

```typescript
// Query
const { data } = api.gitops.listApplications.useQuery({
  project: 'default',      // Optional: filter by project
  selector: 'env=prod',    // Optional: label selector
});

// Response
{
  success: true,
  applications: [
    {
      name: 'my-app-prod',
      namespace: 'argocd',
      project: 'default',
      status: 'Healthy',
      syncStatus: 'Synced',
      repoURL: 'https://github.com/org/repo.git',
      path: 'manifests/prod',
      revision: 'main'
    }
  ],
  count: 1
}
```

### Get Application Details

```typescript
const { data } = api.gitops.getApplication.useQuery({
  name: 'my-app-prod'
});
```

### Deploy Stack

Creates and deploys an ArgoCD application for a technology stack.

```typescript
const deploy = api.gitops.deployStack.useMutation();

await deploy.mutateAsync({
  stackId: 'stack-123',
  stackName: 'My Web App',
  environment: 'production',
  gitRepoURL: 'https://github.com/org/repo.git',
  gitPath: 'manifests/prod',
  gitRevision: 'main',
  namespace: 'my-app',
  deploymentType: 'helm',
  autoSync: true,
  autoPrune: true,
  selfHeal: true,
});
```

### Sync Application

Triggers a sync operation.

```typescript
const sync = api.gitops.syncApplication.useMutation();

await sync.mutateAsync({
  name: 'my-app-prod',
  prune: true,
  dryRun: false,
  force: false,
});
```

### Get Status

```typescript
// Sync status
const { data: syncStatus } = api.gitops.getSyncStatus.useQuery({
  name: 'my-app-prod'
});

// Health status
const { data: healthStatus } = api.gitops.getHealthStatus.useQuery({
  name: 'my-app-prod'
});
```

---

## Infrastructure API

The Infrastructure API provides Pulumi-based infrastructure provisioning.

### Available Templates

| Template | Description |
|----------|-------------|
| `aws-vpc` | AWS VPC with subnets, NAT gateway, routing |
| `database` | RDS PostgreSQL with security groups |
| `static-site` | S3 + CloudFront static website hosting |
| `container-app` | ECS Fargate container deployment |

### List Stacks

```typescript
const { data } = api.infrastructure.listStacks.useQuery({
  projectName: 'my-project'
});

// Response
{
  success: true,
  stacks: [
    {
      name: 'dev',
      current: true,
      lastUpdate: '2024-01-15T10:30:00Z',
      resourceCount: 15,
      url: 'https://app.pulumi.com/org/my-project/dev'
    }
  ],
  count: 1
}
```

### Preview Infrastructure

Preview changes before applying.

```typescript
const { data } = api.infrastructure.previewInfrastructure.useQuery({
  stackName: 'prod',
  projectName: 'my-project',
  template: 'aws-vpc',
  templateConfig: {
    vpcCidr: '10.0.0.0/16',
    azCount: 3,
    enableNatGateway: true,
  },
});

// Response
{
  success: true,
  changeSummary: {
    create: 12,
    update: 0,
    delete: 0,
    same: 0
  },
  steps: [
    { op: 'create', urn: 'urn:pulumi:prod::my-project::aws:ec2/vpc:Vpc::main-vpc', type: 'aws:ec2/vpc:Vpc' }
  ]
}
```

### Deploy Infrastructure

```typescript
const deploy = api.infrastructure.deployInfrastructure.useMutation();

const result = await deploy.mutateAsync({
  stackName: 'prod',
  projectName: 'my-project',
  environment: 'production',
  region: 'us-west-2',
  template: 'aws-vpc',
  templateConfig: {
    vpcCidr: '10.0.0.0/16',
    azCount: 3,
    enableNatGateway: true,
  },
  config: {
    'aws:region': 'us-west-2',
  },
});

// Response
{
  success: true,
  outputs: {
    vpcId: 'vpc-0123456789abcdef0',
    publicSubnetIds: ['subnet-abc', 'subnet-def'],
    privateSubnetIds: ['subnet-ghi', 'subnet-jkl']
  },
  summary: { create: 12, update: 0, delete: 0 },
  message: 'Successfully deployed prod'
}
```

### Template Configurations

#### AWS VPC

```typescript
const vpcConfig = {
  vpcCidr: '10.0.0.0/16',
  azCount: 2,               // Number of availability zones
  enableNatGateway: true,   // NAT for private subnets
  enableVpnGateway: false,
  tags: { Environment: 'prod' },
};
```

#### Database (RDS)

```typescript
const dbConfig = {
  instanceClass: 'db.t3.medium',
  engine: 'postgres',
  engineVersion: '15.4',
  allocatedStorage: 50,
  dbName: 'myapp',
  username: 'admin',
  multiAz: true,
  backupRetentionDays: 7,
};
```

#### Static Site

```typescript
const siteConfig = {
  domain: 'www.example.com',
  certificateArn: 'arn:aws:acm:...',
  indexDocument: 'index.html',
  errorDocument: '404.html',
  priceClass: 'PriceClass_100',
};
```

#### Container App

```typescript
const containerConfig = {
  image: 'nginx:latest',
  cpu: 256,
  memory: 512,
  desiredCount: 2,
  port: 80,
  healthCheckPath: '/health',
  environmentVariables: {
    NODE_ENV: 'production',
  },
};
```

### Destroy Infrastructure

```typescript
const destroy = api.infrastructure.destroyInfrastructure.useMutation();

await destroy.mutateAsync({
  stackName: 'dev',
  projectName: 'my-project',
  template: 'aws-vpc',
  templateConfig: { /* same config used for deploy */ },
});
```

---

## Error Handling

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `BAD_REQUEST` | 400 | Invalid input parameters |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `INTERNAL_SERVER_ERROR` | 500 | Server error |

### Error Handling Example

```typescript
import { TRPCClientError } from '@trpc/client';

try {
  await api.gitops.deployStack.mutate(input);
} catch (error) {
  if (error instanceof TRPCClientError) {
    switch (error.data?.code) {
      case 'UNAUTHORIZED':
        // Redirect to login
        break;
      case 'NOT_FOUND':
        // Show not found message
        break;
      case 'BAD_REQUEST':
        // Show validation errors
        console.error('Validation:', error.message);
        break;
      default:
        // Generic error handling
        console.error('Error:', error.message);
    }
  }
}
```

---

## Rate Limiting

API requests are rate limited per user:

| Endpoint Type | Limit |
|---------------|-------|
| Public | 100 requests/minute |
| Protected | 500 requests/minute |
| Admin | 1000 requests/minute |

Rate limit headers are included in responses:

```
X-RateLimit-Limit: 500
X-RateLimit-Remaining: 499
X-RateLimit-Reset: 1609459200
```

---

## Code Examples

### React Component: Deploy Stack

```tsx
import { api } from '@/utils/api';
import { useState } from 'react';

export function DeployButton({ stackId, stackName }: Props) {
  const [isDeploying, setIsDeploying] = useState(false);
  
  const deploy = api.gitops.deployStack.useMutation({
    onSuccess: (data) => {
      toast.success(`Deployed: ${data.applicationName}`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
    onSettled: () => {
      setIsDeploying(false);
    },
  });

  const handleDeploy = async () => {
    setIsDeploying(true);
    await deploy.mutateAsync({
      stackId,
      stackName,
      environment: 'production',
      gitRepoURL: 'https://github.com/org/repo.git',
      gitPath: 'manifests/prod',
      namespace: 'default',
      deploymentType: 'helm',
    });
  };

  return (
    <button onClick={handleDeploy} disabled={isDeploying}>
      {isDeploying ? 'Deploying...' : 'Deploy'}
    </button>
  );
}
```

### Node.js Script: Infrastructure Automation

```typescript
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '@/server/root';

const client = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: 'http://localhost:3000/api/trpc',
      headers: {
        cookie: 'next-auth.session-token=...',
      },
    }),
  ],
});

async function deployInfrastructure() {
  // Preview changes first
  const preview = await client.infrastructure.previewInfrastructure.query({
    stackName: 'prod',
    projectName: 'my-project',
    template: 'aws-vpc',
    templateConfig: {
      vpcCidr: '10.0.0.0/16',
      azCount: 2,
    },
  });

  console.log('Preview:', preview.changeSummary);

  // Deploy if changes look good
  if (preview.changeSummary.create > 0) {
    const result = await client.infrastructure.deployInfrastructure.mutate({
      stackName: 'prod',
      projectName: 'my-project',
      environment: 'production',
      template: 'aws-vpc',
      templateConfig: {
        vpcCidr: '10.0.0.0/16',
        azCount: 2,
      },
    });

    console.log('Deployed:', result.outputs);
  }
}

deployInfrastructure();
```

---

## Related Documentation

- [OpenAPI Specification](./openapi.yaml) - Full API specification
- [GitOps Workflow Guide](../user-guide/gitops-workflow.md) - User guide for GitOps
- [Development Setup](../development/setup.md) - Local development setup
