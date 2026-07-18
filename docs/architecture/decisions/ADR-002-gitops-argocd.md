# ADR-002: GitOps with ArgoCD

**Status:** Accepted  
**Date:** 2024-06-01  
**Decision Makers:** DevOps Team, Architecture Team

## Context

We need a deployment strategy for Kubernetes workloads that supports:
- Declarative configuration management
- Automated deployments from Git
- Multi-environment and multi-cluster support
- Audit trail and rollback capabilities

### Options Considered

1. **ArgoCD** - GitOps continuous delivery for Kubernetes
2. **Flux** - GitOps toolkit from Weaveworks
3. **Jenkins X** - CI/CD for Kubernetes
4. **Manual kubectl** - Direct Kubernetes deployments

## Decision

We chose **ArgoCD** as our GitOps platform.

## Rationale

### Advantages

1. **Declarative GitOps**
   - Git as single source of truth
   - Automatic sync from repository to cluster
   - Self-healing when cluster state drifts

2. **User Interface**
   - Rich web UI for visualization
   - Application health monitoring
   - Sync status and history

3. **Multi-Cluster Support**
   - Manage multiple clusters from single ArgoCD
   - ApplicationSets for templating across environments
   - Centralized deployment management

4. **Integration Capabilities**
   - Supports Helm, Kustomize, and plain YAML
   - Webhook notifications
   - SSO integration

### Trade-offs

1. **Operational Complexity** - Requires ArgoCD cluster management
2. **Learning Curve** - Team needs GitOps training
3. **Resource Overhead** - ArgoCD runs in-cluster

## Consequences

### Positive
- Automated deployments reduce manual errors
- Full audit trail of all deployments
- Easy rollback to any previous state
- Better security through Git-based access control

### Negative
- Additional infrastructure to maintain
- Requires restructuring deployment pipelines

## Implementation

### CLI Wrapper Pattern

```typescript
// src/lib/gitops/argocd-client.ts
export function createArgoCDClient() {
  return {
    listApplications: async () => {
      const result = await execCommand('argocd app list -o json');
      return JSON.parse(result);
    },
    syncApplication: async (name: string) => {
      return execCommand(`argocd app sync ${name}`);
    },
  };
}
```

### Application Manifest Generation

```typescript
// src/lib/gitops/argocd-manifest-generator.ts
export function generateStackApplicationManifest(config: StackDeploymentConfig) {
  return {
    apiVersion: 'argoproj.io/v1alpha1',
    kind: 'Application',
    metadata: {
      name: `${config.stackName}-${config.environment}`,
      namespace: 'argocd',
    },
    spec: {
      project: 'default',
      source: {
        repoURL: config.gitRepoURL,
        path: config.gitPath,
        targetRevision: config.gitRevision || 'HEAD',
      },
      destination: {
        server: config.clusterServer || 'https://kubernetes.default.svc',
        namespace: config.namespace,
      },
      syncPolicy: config.autoSync ? {
        automated: {
          prune: config.autoPrune,
          selfHeal: config.selfHeal,
        },
      } : undefined,
    },
  };
}
```

## Environment Configuration

| Environment | ArgoCD Instance | Target Clusters |
|-------------|-----------------|-----------------|
| Development | Local | Local K8s |
| Staging | Shared ArgoCD | Staging EKS |
| Production | Dedicated ArgoCD | Production EKS |

## Related Decisions
- ADR-003: Pulumi for Infrastructure as Code
- ADR-004: OpenTelemetry for Observability
