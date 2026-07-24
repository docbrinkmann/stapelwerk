# Kubernetes E2E Smoke Test

This guide describes a minimal smoke test to verify that a deployment rolled out successfully and all pods are ready in your test cluster.

Prerequisites
- A reachable Kubernetes cluster
- kubectl configured (via current context or KUBECONFIG)
- The target deployment labeled with app=<deployment-name> for pod selection in readiness checks

Script
- scripts/k8s-smoke-test.sh

Usage
```bash path=null start=null
# Optionally set the kubeconfig path (do not echo or print secrets!)
# export KUBECONFIG=/path/to/kubeconfig

bash scripts/k8s-smoke-test.sh --namespace app --deployment web --timeout 180s
```

What it does
- Verifies access to the cluster
- Waits for Deployment rollout to complete within the timeout
- Checks pod readiness under label app=<deployment>
- Prints an error and exits non-zero if any container is not ready

CI integration (example)
```yaml path=null start=null
smoke_test_k8s:
  stage: test
  image: bitnami/kubectl:latest
  variables:
    # Store kubeconfig as CI masked variable and write to a file
    # NEVER echo secrets; use an environment file instead
    KUBECONFIG: "$CI_PROJECT_DIR/kubeconfig"
  script:
    - echo "$KUBECONFIG_B64" | base64 -d > "$KUBECONFIG"
    - bash scripts/k8s-smoke-test.sh --namespace app --deployment web --timeout 180s
  rules:
    - if: "$CI_COMMIT_BRANCH"
```

Notes
- Keep kubeconfig ephemeral and never check it into the repo.
- If you use a GitLab Agent, ensure the agent handles cluster connectivity; the smoke test can run from inside the cluster or via remote context.
