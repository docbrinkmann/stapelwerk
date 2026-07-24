# Deployments API

This document describes the tRPC procedures for managing deployment targets, overrides, artifacts, and jobs.

Base router: deployments (wired in src/server/root.ts)

Endpoints

- createTarget (mutation)
  - Input: { name: string, type: 'kubernetes' | 'docker', provider: string, config?: Record<string, any> }
  - Output: DeploymentTarget
  - Notes: Auth required. Assigns userId from session.

- listTargets (query)
  - Input: { limit?: number, cursor?: string | null } (optional)
  - Output: { targets: DeploymentTarget[] }
  - Notes: Returns current user's targets, newest first.

- getTarget (query)
  - Input: { id: UUID }
  - Output: DeploymentTarget
  - Errors: NOT_FOUND if not found for user.

- updateTarget (mutation)
  - Input: { id: UUID, name?: string, provider?: string, config?: Record<string, any> }
  - Output: DeploymentTarget
  - Errors: NOT_FOUND if not owned by user.

- deleteTarget (mutation)
  - Input: { id: UUID }
  - Output: { success: true }
  - Errors: NOT_FOUND if not owned by user.

- upsertOverride (mutation)
  - Input: { targetId: UUID, serviceId: number, stackId?: UUID, overrides: Record<string, any> }
  - Output: DeploymentTargetOverride
  - Notes: Auth/ownership enforced via targetId; Upserts by (targetId, serviceId, stackId|null).

- listOverrides (query)
  - Input: { targetId: UUID }
  - Output: { items: DeploymentTargetOverride[] }
  - Notes: Ownership enforced.

- deleteOverride (mutation)
  - Input: { targetId: UUID, serviceId: number, stackId?: UUID }
  - Output: { success: true }
  - Notes: Deletes matching override records.

- createArtifact (mutation)
  - Input: { type: 'yaml'|'helm'|'kustomize', checksum: string, location?: string, metadata?: Record<string, any>, stackId: UUID, targetId?: UUID }
  - Output: DeploymentArtifact
  - Notes: If targetId provided, ownership validated.

- listArtifacts (query)
  - Input: { stackId: UUID }
  - Output: { items: DeploymentArtifact[] }

- getArtifact (query)
  - Input: { id: UUID }
  - Output: DeploymentArtifact
  - Errors: NOT_FOUND

- createJob (mutation)
  - Input: { mode: 'export'|'apply'|'provision'|'destroy', stackId?: UUID, targetId?: UUID, artifactId?: UUID }
  - Output: DeploymentJob
  - Notes: If targetId provided, ownership validated. Status starts as 'queued'.

- getJob (query)
  - Input: { id: UUID }
  - Output: DeploymentJob
  - Errors: NOT_FOUND

- getJobLogs (query)
  - Input: { id: UUID }
  - Output: { entries: any[] }
  - Notes: Returns parsed JSON logs.

- getJobStatus (query)
  - Input: { id: UUID }
  - Output: { id: UUID, mode: string, status: string, updatedAt: Date }
  - Notes: Lightweight polling endpoint for job status.

- getJobLogTail (query)
  - Input: { id: UUID, since?: number }
  - Output: { entries: { t: number, msg: string }[], lastTimestamp: number }
  - Notes: Returns only log entries with t > since. Clients can poll with lastTimestamp to simulate streaming.

- renderApplyCi (query)
  - Input: { targetId: UUID, manifestPath: string }
  - Output: { yaml: string, useAgent: boolean, kubeContext?: string }
  - Notes: Generates CI YAML snippet for apply. If target config.apply.method == 'gitlab-agent' and config.apply.kubeContext present, uses agent context.

- serverApply (mutation)
  - Input: { id: UUID, kubeconfigB64: base64 string, manifest: string, dryRun?: boolean }
  - Output: DeploymentJob
  - Notes: Performs server-side apply using an ephemeral kubeconfig. Defaults to dry-run; never persists kubeconfig.

Client examples (tRPC client)

- Create target

```ts path=null start=null
import { api } from '@/trpc/client'

await api.mutation('deployments.createTarget', {
  name: 'Local K3s',
  type: 'kubernetes',
  provider: 'self-managed',
  config: { kubecontext: 'default' },
})
```

- Upsert override

```ts path=null start=null
await api.mutation('deployments.upsertOverride', {
  targetId,
  serviceId: 123,
  overrides: {
    ingress: { enabled: true, host: 'app.local' },
    resources: { requests: { cpu: '100m', memory: '128Mi' } },
  },
})
```

- Create artifact and list by stack

```ts path=null start=null
const artifact = await api.mutation('deployments.createArtifact', {
  stackId,
  targetId,
  type: 'yaml',
  checksum: 'abc123',
  location: '/tmp/artifacts/my-stack.yaml',
})

const list = await api.query('deployments.listArtifacts', { stackId })
```

- Create export job and fetch status/logs

```ts path=null start=null
const job = await api.mutation('deployments.createJob', {
  mode: 'export',
  stackId,
  targetId,
})

const current = await api.query('deployments.getJob', { id: job.id })
const logs = await api.query('deployments.getJobLogs', { id: job.id })
```
