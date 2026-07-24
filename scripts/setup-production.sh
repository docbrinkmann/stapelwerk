#!/usr/bin/env bash
set -euo pipefail

# Stapelwerk - Production Setup Script
# - Generates secrets
# - Initializes Docker Swarm (if needed)
# - Creates/updates Docker secrets
# - Deploys the stack via docker stack deploy
# - Runs basic health checks

STACK_NAME="stapelwerk"
COMPOSE_FILE="docker/docker-compose.prod.yml"
SECRETS_DIR="secrets"
SECRETS=(db_password redis_password jwt_secret)

log() { echo -e "\033[1;34m[setup]\033[0m $*"; }
warn() { echo -e "\033[1;33m[warn]\033[0m $*"; }
err() { echo -e "\033[1;31m[error]\033[0m $*"; }

require() {
  command -v "$1" >/dev/null 2>&1 || { err "'$1' is required but not installed"; exit 1; }
}

main() {
  log "Validating prerequisites..."
  require docker
  require openssl

  if [ ! -f "$COMPOSE_FILE" ]; then
    err "Compose file not found at $COMPOSE_FILE"
    exit 1
  fi

  log "Ensuring secrets directory exists..."
  mkdir -p "$SECRETS_DIR"

  log "Generating secrets (if missing)..."
  [ -f "$SECRETS_DIR/db_password.txt" ] || openssl rand -base64 32 > "$SECRETS_DIR/db_password.txt"
  [ -f "$SECRETS_DIR/redis_password.txt" ] || openssl rand -base64 32 > "$SECRETS_DIR/redis_password.txt"
  [ -f "$SECRETS_DIR/jwt_secret.txt" ] || openssl rand -hex 64 > "$SECRETS_DIR/jwt_secret.txt"
  chmod 600 "$SECRETS_DIR"/*.txt || true

  log "Initializing Docker Swarm (if needed)..."
  if ! docker info --format '{{.Swarm.LocalNodeState}}' 2>/dev/null | grep -qE 'active|pending'; then
    docker swarm init || true
  fi

  log "Creating/Updating Docker secrets..."
  for s in "${SECRETS[@]}"; do
    if docker secret ls --format '{{.Name}}' | grep -qx "$s"; then
      warn "Secret '$s' exists; replacing"
      docker secret rm "$s" >/dev/null 2>&1 || true
    fi
    docker secret create "$s" "$SECRETS_DIR/${s}.txt" >/dev/null
  done

  log "Deploying stack '$STACK_NAME'..."
  docker stack deploy -c "$COMPOSE_FILE" "$STACK_NAME"

  log "Waiting for services to stabilize..."
  sleep 10
  docker stack services "$STACK_NAME"

  log "Basic health checks..."
  if command -v curl >/dev/null 2>&1; then
    set +e
    curl -sf http://localhost:8080/health && log "App health OK" || warn "App health check failed"
    curl -sf http://localhost:9090/-/healthy && log "Prometheus healthy" || warn "Prometheus not reachable"
    curl -sf http://localhost:3000/api/health && log "Grafana reachable" || warn "Grafana health check failed"
    set -e
  fi

  log "Production setup completed. For full validation, run:"
  echo "  ./scripts/validate-deployment.sh --quick"
}

main "$@"
