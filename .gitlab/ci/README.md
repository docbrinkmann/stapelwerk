# GitLab CI templates for Kubernetes apply

Use these templates to apply Kubernetes manifests via CI using either:
- Base64-encoded kubeconfig stored in CI variable KUBECONFIG_B64 (ephemeral)
- GitLab Kubernetes Agent (recommended)

Include example:

include:
  - local: ".gitlab/ci/templates/k8s-apply.yml"

variables:
  MANIFEST_PATH: "manifest.yaml"
  DRY_RUN: "client" # set to 'none' to actually apply
  # Option A (ephemeral kubeconfig): set KUBECONFIG_B64 in CI/CD Variables
  # Option B (agent): set KUBE_CONTEXT to your agent context (e.g., gitlab-agent:group/project:agent-name)

k8s_apply:
  stage: deploy
  extends: .k8s_apply_base
