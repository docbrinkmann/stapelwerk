# Direct Apply UI Guide

This guide explains how to use the Direct Apply UI to create and monitor deployment jobs for your stack.

What you get
- A modal that lets you choose a deployment Target and (optionally) a saved Stack
- A one-click Create & Start Apply button to kick off an apply job
- Live job status and log tailing while the job runs
- Inline creation of a new Target if you don’t have one yet

Key components
- ApplyModal: Wrapper UI (Dialog) that includes target/stack pickers and the ApplyPanel
- ApplyPanel: Creates an apply job and renders JobStatusPanel for status/logs
- JobStatusPanel: Polls getJobStatus and getJobLogTail and displays status + logs

Basic flow
1) Open the Stack Builder and click the Deploy button
2) In the modal, pick a Target (create one if none exist) and optionally select a saved Stack
3) Press Create & Start Apply
4) Watch the job status badge and live logs; the panel auto-updates until success/failure

Creating a deployment Target
If no targets are found, a callout appears with a Create Target button.
- Fields: Name (required), Provider, Type (kubernetes|docker), Config (optional JSON)
- Example Config JSON (for GitLab Agent-based CI rendering):

```json path=null start=null
{
  "apply": {
    "method": "gitlab-agent",
    "kubeContext": "my/cluster/context"
  }
}
```

After creating a target, the list refreshes and the new target is auto-selected.

How it works under the hood
- tRPC endpoints (src/server/routers/deployments.ts):
  - createJob(mode: 'apply', stackId?, targetId?, artifactId?)
  - startApply(id) – transitions job to running and appends logs
  - getJobStatus(id) – lightweight polling endpoint for status updates
  - getJobLogTail(id, since?) – returns only new log entries with lastTimestamp
  - serverApply(id, kubeconfigB64, manifest, dryRun?) – optional server-side apply with TTL checks
  - renderApplyCi(targetId, manifestPath) – returns CI YAML snippet; supports GitLab Agent context if configured

Security and safety
- Secret redaction: server logs redact common credential patterns before storing
- Ephemeral credentials window: server-side apply enforces a 10-minute TTL from job creation
- Payload limits: manifests larger than 1MB are rejected

Troubleshooting
- No targets appear: Create a target inline with the callout
- Status doesn’t change: Ensure startApply was called (ApplyPanel triggers it automatically on create)
- Logs are empty: Polling uses lastTimestamp; wait briefly or click Refresh
- CI rendering shows plain kubecontext: supply a config.apply.method of "gitlab-agent" and a config.apply.kubeContext string

Related docs
- deployments API reference: docs/api/deployments.md
- E2E Smoke Test: docs/deployment/e2e-smoke-test.md
