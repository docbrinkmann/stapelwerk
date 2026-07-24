#!/usr/bin/env bash
set -euo pipefail

# E2E smoke test on a local Kind cluster (best-effort)
# - Creates a Kind cluster (if Docker available)
# - Applies a sample app with readiness probe
# - Waits for rollout success
# If Docker/Kind are unavailable (e.g., CI w/o privileged), performs a kubeconform dry-run.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
NAMESPACE="stapelwerk"
CLUSTER_NAME="bms-e2e"
SAMPLE_MANIFEST="${SCRIPT_DIR}/sample-app.yaml"
TIMEOUT="180s"
CLEANUP="${CLEANUP:-true}"

log() { echo "[e2e-smoke] $*"; }
warn() { echo "[e2e-smoke][WARN] $*" >&2; }
err()  { echo "[e2e-smoke][ERROR] $*" >&2; }

has() { command -v "$1" >/dev/null 2>&1; }

ensure_kubectl() {
  if has kubectl; then return 0; fi
  warn "kubectl not found; attempting installation (Linux x86_64 assumed)"
  curl -fsSL -o kubectl https://storage.googleapis.com/kubernetes-release/release/$(curl -s https://storage.googleapis.com/kubernetes-release/release/stable.txt)/bin/linux/amd64/kubectl
  chmod +x kubectl && sudo mv kubectl /usr/local/bin/kubectl || mv kubectl "$ROOT_DIR/kubectl"
  export PATH="$ROOT_DIR:$PATH"
}

ensure_kubeconform() {
  if has kubeconform; then return 0; fi
  warn "kubeconform not found; attempting installation"
  curl -fsSL -o kubeconform.tar.gz https://github.com/yannh/kubeconform/releases/download/v0.6.4/kubeconform-linux-amd64.tar.gz
  tar -xzf kubeconform.tar.gz kubeconform && rm kubeconform.tar.gz
  chmod +x kubeconform && sudo mv kubeconform /usr/local/bin/kubeconform || mv kubeconform "$ROOT_DIR/kubeconform"
  export PATH="$ROOT_DIR:$PATH"
}

create_kind_cluster() {
  log "Creating Kind cluster: ${CLUSTER_NAME}"
  kind create cluster --name "$CLUSTER_NAME" --wait 120s
}

apply_sample() {
  kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
  kubectl -n "$NAMESPACE" apply -f "$SAMPLE_MANIFEST"
  kubectl -n "$NAMESPACE" rollout status deploy/bms-e2e --timeout="$TIMEOUT"
  kubectl -n "$NAMESPACE" get pods -o wide
}

cleanup() {
  if [[ "$CLEANUP" == "true" ]]; then
    log "Cleaning up Kind cluster: ${CLUSTER_NAME}"
    kind delete cluster --name "$CLUSTER_NAME" || true
  else
    log "Skipping cluster cleanup (CLEANUP=$CLEANUP)"
  fi
}

main() {
  ensure_kubectl || true
  ensure_kubeconform || true

  log "Validating sample manifest with kubeconform"
  kubeconform -strict -ignore-filename-pattern ".*CRD.*" -summary "$SAMPLE_MANIFEST" || {
    err "kubeconform validation failed"
    exit 2
  }

  if has docker && has kind; then
    # Full E2E on local Kind cluster
    trap cleanup EXIT
    create_kind_cluster
    apply_sample
    log "E2E smoke test succeeded"
  else
    warn "Docker or Kind not available; performing dry-run only"
    kubectl apply --dry-run=client -f "$SAMPLE_MANIFEST" >/dev/null 2>&1 || warn "kubectl dry-run skipped"
    log "Dry-run validation completed"
  fi
}

main "$@"