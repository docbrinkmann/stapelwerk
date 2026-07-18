#!/usr/bin/env bash
set -euo pipefail

# k8s-smoke-test.sh
# Simple E2E smoke test against a Kubernetes cluster to verify rollout and pod readiness.
# Requires kubectl and access to the cluster (via $KUBECONFIG or default kube context).

usage() {
  cat <<EOF
Usage: $0 --namespace <ns> --deployment <name> [--timeout 120s]
            [--svc <service>] [--svc-port <port>] [--local-port <port>] [--path </health>] [--expect-status 200]

Environment:
  KUBECONFIG   Path to kubeconfig file (optional, defaults to current context)

Examples:
  # Basic rollout check
  $0 --namespace app --deployment web --timeout 180s

  # Validate health endpoint via port-forward after rollout completes
  $0 --namespace app --deployment web --svc web --svc-port 8080 --local-port 18080 --path /healthz --expect-status 200
EOF
}

NS=""
DEP=""
TIMEOUT="120s"
SVC=""
SVC_PORT=""
LOCAL_PORT="18080"
HEALTH_PATH="/health"
EXPECT_STATUS="200"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --namespace|-n)
      NS="$2"; shift 2;;
    --deployment|-d)
      DEP="$2"; shift 2;;
    --timeout|-t)
      TIMEOUT="$2"; shift 2;;
    --help|-h)
      usage; exit 0;;
    --svc)
      SVC="$2"; shift 2;;
    --svc-port)
      SVC_PORT="$2"; shift 2;;
    --local-port)
      LOCAL_PORT="$2"; shift 2;;
    --path)
      HEALTH_PATH="$2"; shift 2;;
    --expect-status)
      EXPECT_STATUS="$2"; shift 2;;
    *)
      echo "Unknown arg: $1" >&2; usage; exit 1;;
  esac
done

if [[ -z "$NS" || -z "$DEP" ]]; then
  echo "Missing required args." >&2
  usage
  exit 1
fi

echo "[INFO] Using kubeconfig: ${KUBECONFIG:-<default>}"
echo "[INFO] Namespace: $NS, Deployment: $DEP, Timeout: $TIMEOUT"

# Check connectivity
kubectl version --client >/dev/null
kubectl -n "$NS" get deploy "$DEP" >/dev/null

# Wait for rollout
echo "[INFO] Waiting for rollout to complete..."
kubectl -n "$NS" rollout status deploy/"$DEP" --timeout="$TIMEOUT"

echo "[INFO] Checking pods readiness..."
PODS_JSON=$(kubectl -n "$NS" get pods -l app="$DEP" -o json)

# Use jq if available, otherwise fallback to kubectl jsonpath
if command -v jq >/dev/null 2>&1; then
  NOT_READY=$(echo "$PODS_JSON" | jq '.items[] | select(.status.containerStatuses | any(.ready == false)) | .metadata.name' -r | wc -l | tr -d ' ')
else
  # naive fallback: check for "ready": false occurrences
  NOT_READY=$(echo "$PODS_JSON" | grep -c '"ready": false' || true)
fi

if [[ "$NOT_READY" -gt 0 ]]; then
  echo "[ERROR] Some containers are not ready." >&2
  kubectl -n "$NS" get pods -l app="$DEP"
  kubectl -n "$NS" describe deploy "$DEP" || true
  exit 2
fi

echo "[OK] Rollout complete and all containers ready."

# Optional health endpoint validation via port-forward
if [[ -n "$SVC" && -n "$SVC_PORT" ]]; then
  echo "[INFO] Validating service health via port-forward: svc/$SVC -> localhost:$LOCAL_PORT$HEALTH_PATH (expect $EXPECT_STATUS)"
  kubectl -n "$NS" port-forward svc/"$SVC" "$LOCAL_PORT":"$SVC_PORT" >/dev/null 2>&1 &
  PF_PID=$!
  trap 'kill $PF_PID >/dev/null 2>&1 || true' EXIT
  # Give port-forward a moment
  sleep 2
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$LOCAL_PORT$HEALTH_PATH" || echo "000")
  kill $PF_PID >/dev/null 2>&1 || true
  trap - EXIT
  if [[ "$STATUS" != "$EXPECT_STATUS" ]]; then
    echo "[ERROR] Health check failed: got status $STATUS, expected $EXPECT_STATUS" >&2
    exit 3
  fi
  echo "[OK] Health check passed (status $STATUS)."
fi
