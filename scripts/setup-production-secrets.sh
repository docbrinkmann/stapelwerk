#!/bin/bash

# Production Secrets Setup Script for Stapelwerk AI Recommendations
# This script sets up all required secrets for production deployment using Kubernetes Secrets

set -e  # Exit on any error

# Script Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
NAMESPACE="stapelwerk"
SECRET_LOG="${PROJECT_ROOT}/logs/secrets-setup-$(date +%Y%m%d-%H%M%S).log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    echo -e "${timestamp} [${level}] ${message}" | tee -a "${SECRET_LOG}"
    
    case $level in
        "ERROR")
            echo -e "${RED}${timestamp} [${level}] ${message}${NC}" >&2
            ;;
        "WARN")
            echo -e "${YELLOW}${timestamp} [${level}] ${message}${NC}"
            ;;
        "SUCCESS")
            echo -e "${GREEN}${timestamp} [${level}] ${message}${NC}"
            ;;
        "INFO")
            echo -e "${BLUE}${timestamp} [${level}] ${message}${NC}"
            ;;
    esac
}

# Error handler
error_handler() {
    local exit_code=$?
    log "ERROR" "Secret setup failed at line $1 with exit code $exit_code"
    log "ERROR" "Check the setup log at: $SECRET_LOG"
    exit $exit_code
}

# Set error trap
trap 'error_handler $LINENO' ERR

# Function to generate secure random password
generate_password() {
    local length=${1:-32}
    openssl rand -base64 $length | tr -d "=+/" | cut -c1-$length
}

# Function to generate secure hex secret
generate_hex_secret() {
    local length=${1:-64}
    openssl rand -hex $((length/2))
}

# Function to validate required environment variables
validate_required_vars() {
    log "INFO" "Validating required environment variables..."
    
    local required_vars=(
        "PROD_DB_HOST"
        "PROD_DB_NAME" 
        "PROD_DB_USER"
        "PROD_REDIS_HOST"
        "OPENAI_API_KEY"
        "ANTHROPIC_API_KEY"
        "SENTRY_DSN"
        "SLACK_WEBHOOK_URL"
        "SMTP_HOST"
        "SMTP_USERNAME"
        "PAGERDUTY_INTEGRATION_KEY"
    )
    
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            missing_vars+=("$var")
        fi
    done
    
    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        log "ERROR" "Missing required environment variables:"
        for var in "${missing_vars[@]}"; do
            log "ERROR" "  - $var"
        done
        log "ERROR" "Please set all required variables before running this script"
        exit 1
    fi
    
    log "SUCCESS" "All required environment variables are set"
}

# Function to check if kubectl is available and cluster is accessible
check_kubernetes_access() {
    log "INFO" "Checking Kubernetes cluster access..."
    
    if ! command -v kubectl &> /dev/null; then
        log "ERROR" "kubectl command not found. Please install kubectl."
        exit 1
    fi
    
    if ! kubectl cluster-info &> /dev/null; then
        log "ERROR" "Cannot connect to Kubernetes cluster. Please check your kubeconfig."
        exit 1
    fi
    
    log "SUCCESS" "Kubernetes cluster access verified"
}

# Function to create namespace if it doesn't exist
create_namespace() {
    log "INFO" "Creating namespace: $NAMESPACE"
    
    if kubectl get namespace "$NAMESPACE" &> /dev/null; then
        log "INFO" "Namespace $NAMESPACE already exists"
    else
        kubectl create namespace "$NAMESPACE"
        log "SUCCESS" "Created namespace: $NAMESPACE"
    fi
}

# Function to generate and store database secrets
setup_database_secrets() {
    log "INFO" "Setting up database secrets..."
    
    local db_password="${PROD_DB_PASSWORD:-$(generate_password 32)}"
    local db_monitor_password="${PROD_DB_MONITOR_PASSWORD:-$(generate_password 32)}"
    
    # Create database secrets
    kubectl create secret generic db-secrets \
        --namespace="$NAMESPACE" \
        --from-literal=host="${PROD_DB_HOST}" \
        --from-literal=name="${PROD_DB_NAME}" \
        --from-literal=user="${PROD_DB_USER}" \
        --from-literal=password="$db_password" \
        --from-literal=monitor-password="$db_monitor_password" \
        --dry-run=client -o yaml | kubectl apply -f -
    
    log "SUCCESS" "Database secrets configured"
    
    # Output database setup instructions
    log "INFO" "Database setup required:"
    log "INFO" "  Host: ${PROD_DB_HOST}"
    log "INFO" "  Database: ${PROD_DB_NAME}"
    log "INFO" "  User: ${PROD_DB_USER}"
    log "INFO" "  Password: [STORED IN SECRET]"
    
    # Store passwords for database setup (encrypted)
    echo "DB_PASSWORD=$db_password" > "${PROJECT_ROOT}/.db-setup.env.encrypted" || true
    echo "DB_MONITOR_PASSWORD=$db_monitor_password" >> "${PROJECT_ROOT}/.db-setup.env.encrypted" || true
    
    if command -v gpg &> /dev/null; then
        gpg --symmetric --cipher-algo AES256 "${PROJECT_ROOT}/.db-setup.env.encrypted" && \
        rm "${PROJECT_ROOT}/.db-setup.env.encrypted"
        log "INFO" "Database passwords encrypted and saved to .db-setup.env.encrypted.gpg"
    else
        log "WARN" "GPG not available - database passwords stored in plain text at .db-setup.env.encrypted"
        log "WARN" "Please encrypt or delete this file after database setup"
    fi
}

# Function to generate and store Redis secrets
setup_redis_secrets() {
    log "INFO" "Setting up Redis secrets..."
    
    local redis_password="${PROD_REDIS_PASSWORD:-$(generate_password 32)}"
    
    kubectl create secret generic redis-secrets \
        --namespace="$NAMESPACE" \
        --from-literal=host="${PROD_REDIS_HOST}" \
        --from-literal=port="6379" \
        --from-literal=password="$redis_password" \
        --dry-run=client -o yaml | kubectl apply -f -
    
    log "SUCCESS" "Redis secrets configured"
    log "INFO" "Redis configuration:"
    log "INFO" "  Host: ${PROD_REDIS_HOST}"
    log "INFO" "  Port: 6379"
    log "INFO" "  Password: [STORED IN SECRET]"
}

# Function to store AI service API keys
setup_ai_secrets() {
    log "INFO" "Setting up AI service secrets..."
    
    kubectl create secret generic ai-secrets \
        --namespace="$NAMESPACE" \
        --from-literal=openai-key="${OPENAI_API_KEY}" \
        --from-literal=anthropic-key="${ANTHROPIC_API_KEY}" \
        --dry-run=client -o yaml | kubectl apply -f -
    
    log "SUCCESS" "AI service secrets configured"
}

# Function to generate and store application secrets
setup_app_secrets() {
    log "INFO" "Setting up application secrets..."
    
    local jwt_secret="${PROD_JWT_SECRET:-$(generate_hex_secret 64)}"
    local admin_token="${PROD_ADMIN_API_TOKEN:-$(generate_hex_secret 32)}"
    local feature_flag_token="${PROD_FEATURE_FLAG_TOKEN:-$(generate_hex_secret 32)}"
    
    kubectl create secret generic app-secrets \
        --namespace="$NAMESPACE" \
        --from-literal=jwt-secret="$jwt_secret" \
        --from-literal=admin-api-token="$admin_token" \
        --from-literal=feature-flag-token="$feature_flag_token" \
        --dry-run=client -o yaml | kubectl apply -f -
    
    log "SUCCESS" "Application secrets configured"
    
    # Store admin tokens for reference (encrypted)
    echo "ADMIN_API_TOKEN=$admin_token" > "${PROJECT_ROOT}/.admin-tokens.env.encrypted" || true
    echo "FEATURE_FLAG_TOKEN=$feature_flag_token" >> "${PROJECT_ROOT}/.admin-tokens.env.encrypted" || true
    
    if command -v gpg &> /dev/null; then
        gpg --symmetric --cipher-algo AES256 "${PROJECT_ROOT}/.admin-tokens.env.encrypted" && \
        rm "${PROJECT_ROOT}/.admin-tokens.env.encrypted"
        log "INFO" "Admin tokens encrypted and saved to .admin-tokens.env.encrypted.gpg"
    else
        log "WARN" "Admin tokens stored in plain text at .admin-tokens.env.encrypted"
        log "WARN" "Please encrypt or delete this file after copying tokens to secure storage"
    fi
}

# Function to store monitoring secrets
setup_monitoring_secrets() {
    log "INFO" "Setting up monitoring secrets..."
    
    kubectl create secret generic monitoring-secrets \
        --namespace="$NAMESPACE" \
        --from-literal=sentry-dsn="${SENTRY_DSN}" \
        --from-literal=slack-webhook="${SLACK_WEBHOOK_URL}" \
        --from-literal=pagerduty-key="${PAGERDUTY_INTEGRATION_KEY}" \
        --dry-run=client -o yaml | kubectl apply -f -
    
    log "SUCCESS" "Monitoring secrets configured"
}

# Function to store SMTP secrets
setup_smtp_secrets() {
    log "INFO" "Setting up SMTP secrets..."
    
    kubectl create secret generic smtp-secrets \
        --namespace="$NAMESPACE" \
        --from-literal=host="${SMTP_HOST}" \
        --from-literal=username="${SMTP_USERNAME}" \
        --from-literal=password="${SMTP_PASSWORD:-$(generate_password 24)}" \
        --from-literal=from="${SMTP_FROM:-alerts@stapelwerk.com}" \
        --from-literal=to="${SMTP_TO:-devops@stapelwerk.com}" \
        --dry-run=client -o yaml | kubectl apply -f -
    
    log "SUCCESS" "SMTP secrets configured"
}

# Function to create TLS secrets (if certificates are provided)
setup_tls_secrets() {
    log "INFO" "Setting up TLS secrets..."
    
    local cert_path="${TLS_CERT_PATH:-}"
    local key_path="${TLS_KEY_PATH:-}"
    
    if [[ -n "$cert_path" && -n "$key_path" ]]; then
        if [[ -f "$cert_path" && -f "$key_path" ]]; then
            kubectl create secret tls stapelwerk-tls \
                --namespace="$NAMESPACE" \
                --cert="$cert_path" \
                --key="$key_path" \
                --dry-run=client -o yaml | kubectl apply -f -
            
            log "SUCCESS" "TLS secrets configured from provided certificates"
        else
            log "WARN" "TLS certificate files not found at specified paths"
            log "WARN" "TLS secrets not configured - using cluster default certificates"
        fi
    else
        log "INFO" "TLS certificate paths not provided - using cluster default certificates"
    fi
}

# Function to create service account and RBAC
setup_service_account() {
    log "INFO" "Setting up service account and RBAC..."
    
    # Create service account
    cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: ServiceAccount
metadata:
  name: stapelwerk-ai-sa
  namespace: ${NAMESPACE}
automountServiceAccountToken: true
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: ${NAMESPACE}
  name: stapelwerk-ai-role
rules:
- apiGroups: [""]
  resources: ["secrets", "configmaps"]
  verbs: ["get", "list"]
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "list"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: stapelwerk-ai-rolebinding
  namespace: ${NAMESPACE}
subjects:
- kind: ServiceAccount
  name: stapelwerk-ai-sa
  namespace: ${NAMESPACE}
roleRef:
  kind: Role
  name: stapelwerk-ai-role
  apiGroup: rbac.authorization.k8s.io
EOF
    
    log "SUCCESS" "Service account and RBAC configured"
}

# Function to create production ConfigMap
setup_config_map() {
    log "INFO" "Setting up production ConfigMap..."
    
    kubectl create configmap stapelwerk-config \
        --namespace="$NAMESPACE" \
        --from-literal=NODE_ENV="production" \
        --from-literal=APP_NAME="Stapelwerk AI Recommendations" \
        --from-literal=APP_PORT="8080" \
        --from-literal=LOG_LEVEL="info" \
        --from-literal=LOG_FORMAT="json" \
        --from-literal=PROMETHEUS_ENABLED="true" \
        --from-literal=HEALTH_CHECK_ENABLED="true" \
        --from-literal=FEATURE_FLAGS_PROVIDER="internal" \
        --from-literal=RATE_LIMITING_ENABLED="true" \
        --from-literal=CORS_ALLOWED_ORIGINS="https://stapelwerk.com,https://www.stapelwerk.com" \
        --from-literal=AI_CACHE_ENABLED="true" \
        --from-literal=AI_CACHE_TTL="1h" \
        --from-literal=DEPLOYMENT_ENVIRONMENT="production" \
        --dry-run=client -o yaml | kubectl apply -f -
    
    log "SUCCESS" "Production ConfigMap configured"
}

# Function to validate all secrets are created
validate_secrets() {
    log "INFO" "Validating created secrets..."
    
    local required_secrets=(
        "db-secrets"
        "redis-secrets"
        "ai-secrets"
        "app-secrets"
        "monitoring-secrets"
        "smtp-secrets"
    )
    
    local missing_secrets=()
    
    for secret in "${required_secrets[@]}"; do
        if ! kubectl get secret "$secret" -n "$NAMESPACE" &> /dev/null; then
            missing_secrets+=("$secret")
        fi
    done
    
    if [[ ${#missing_secrets[@]} -gt 0 ]]; then
        log "ERROR" "Missing required secrets:"
        for secret in "${missing_secrets[@]}"; do
            log "ERROR" "  - $secret"
        done
        exit 1
    fi
    
    log "SUCCESS" "All required secrets validated"
}

# Function to show secret summary
show_secret_summary() {
    log "INFO" "=== SECRET SETUP SUMMARY ==="
    
    echo -e "\nCreated secrets in namespace '${NAMESPACE}':"
    kubectl get secrets -n "$NAMESPACE" --no-headers | grep -E "(db-secrets|redis-secrets|ai-secrets|app-secrets|monitoring-secrets|smtp-secrets)" | awk '{print "  ✓ " $1}'
    
    echo -e "\nCreated ConfigMaps:"
    kubectl get configmaps -n "$NAMESPACE" --no-headers | grep -E "stapelwerk-config" | awk '{print "  ✓ " $1}'
    
    echo -e "\nService Account:"
    kubectl get serviceaccount stapelwerk-ai-sa -n "$NAMESPACE" --no-headers | awk '{print "  ✓ " $1}'
    
    echo -e "\nNext Steps:"
    echo "  1. Set up your production database with the generated credentials"
    echo "  2. Configure your Redis instance with the generated password"
    echo "  3. Update your DNS to point to your production cluster"
    echo "  4. Run the deployment script: ./scripts/deploy-production.sh"
    
    if [[ -f "${PROJECT_ROOT}/.db-setup.env.encrypted.gpg" ]]; then
        echo -e "\nDatabase credentials are encrypted in: .db-setup.env.encrypted.gpg"
        echo "Decrypt with: gpg --decrypt .db-setup.env.encrypted.gpg"
    fi
    
    if [[ -f "${PROJECT_ROOT}/.admin-tokens.env.encrypted.gpg" ]]; then
        echo -e "\nAdmin tokens are encrypted in: .admin-tokens.env.encrypted.gpg"
        echo "Decrypt with: gpg --decrypt .admin-tokens.env.encrypted.gpg"
    fi
}

# Function to generate environment file for local reference
generate_env_reference() {
    log "INFO" "Generating environment reference file..."
    
    cat > "${PROJECT_ROOT}/deployment/.env.production.reference" << EOF
# Production Environment Reference
# This file shows the structure of production environment variables
# Actual values are stored in Kubernetes secrets

# Database Configuration
DB_HOST=${PROD_DB_HOST}
DB_NAME=${PROD_DB_NAME}
DB_USER=${PROD_DB_USER}
DB_PASSWORD=[STORED IN k8s secret: db-secrets.password]

# Redis Configuration  
REDIS_HOST=${PROD_REDIS_HOST}
REDIS_PORT=6379
REDIS_PASSWORD=[STORED IN k8s secret: redis-secrets.password]

# AI Service Configuration
OPENAI_API_KEY=[STORED IN k8s secret: ai-secrets.openai-key]
ANTHROPIC_API_KEY=[STORED IN k8s secret: ai-secrets.anthropic-key]

# Application Secrets
JWT_SECRET=[STORED IN k8s secret: app-secrets.jwt-secret]
ADMIN_API_TOKEN=[STORED IN k8s secret: app-secrets.admin-api-token]
FEATURE_FLAG_TOKEN=[STORED IN k8s secret: app-secrets.feature-flag-token]

# Monitoring Configuration
SENTRY_DSN=[STORED IN k8s secret: monitoring-secrets.sentry-dsn]
SLACK_WEBHOOK_URL=[STORED IN k8s secret: monitoring-secrets.slack-webhook]
PAGERDUTY_INTEGRATION_KEY=[STORED IN k8s secret: monitoring-secrets.pagerduty-key]

# SMTP Configuration
SMTP_HOST=[STORED IN k8s secret: smtp-secrets.host]
SMTP_USERNAME=[STORED IN k8s secret: smtp-secrets.username]
SMTP_PASSWORD=[STORED IN k8s secret: smtp-secrets.password]
SMTP_FROM=[STORED IN k8s secret: smtp-secrets.from]
SMTP_TO=[STORED IN k8s secret: smtp-secrets.to]

# Application Configuration (stored in ConfigMap)
NODE_ENV=production
APP_NAME=Stapelwerk AI Recommendations
APP_PORT=8080
LOG_LEVEL=info
LOG_FORMAT=json

# Generated on: $(date)
# Namespace: ${NAMESPACE}
EOF
    
    log "SUCCESS" "Environment reference file created at: deployment/.env.production.reference"
}

# Function to show usage
show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

This script sets up all production secrets for the Stapelwerk AI Recommendations system.

Required Environment Variables:
  PROD_DB_HOST                   Production database hostname
  PROD_DB_NAME                   Production database name
  PROD_DB_USER                   Production database username
  PROD_REDIS_HOST                Production Redis hostname
  OPENAI_API_KEY                 OpenAI API key
  ANTHROPIC_API_KEY              Anthropic API key
  SENTRY_DSN                     Sentry project DSN
  SLACK_WEBHOOK_URL              Slack webhook URL for notifications
  SMTP_HOST                      SMTP server hostname
  SMTP_USERNAME                  SMTP username
  PAGERDUTY_INTEGRATION_KEY      PagerDuty integration key

Optional Environment Variables:
  PROD_DB_PASSWORD               Database password (auto-generated if not provided)
  PROD_REDIS_PASSWORD            Redis password (auto-generated if not provided)
  PROD_JWT_SECRET                JWT signing secret (auto-generated if not provided)
  PROD_ADMIN_API_TOKEN           Admin API token (auto-generated if not provided)
  PROD_FEATURE_FLAG_TOKEN        Feature flag token (auto-generated if not provided)
  SMTP_PASSWORD                  SMTP password (auto-generated if not provided)
  SMTP_FROM                      SMTP from address (defaults to alerts@stapelwerk.com)
  SMTP_TO                        SMTP to addresses (defaults to devops@stapelwerk.com)
  TLS_CERT_PATH                  Path to TLS certificate file
  TLS_KEY_PATH                   Path to TLS private key file

Options:
  --namespace NAME               Kubernetes namespace (default: stapelwerk)
  --validate-only                Only validate environment variables
  --dry-run                      Show what would be created without executing
  --help                         Show this help message

Examples:
  $0                             Set up all production secrets
  $0 --namespace prod            Use 'prod' namespace
  $0 --validate-only             Only check if variables are set
  $0 --dry-run                   Preview what would be created

EOF
}

# Main function
main() {
    # Create logs directory if it doesn't exist
    mkdir -p "${PROJECT_ROOT}/logs"
    
    log "INFO" "Starting production secrets setup..."
    log "INFO" "Namespace: $NAMESPACE"
    log "INFO" "Log file: $SECRET_LOG"
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --namespace)
                NAMESPACE="$2"
                shift 2
                ;;
            --validate-only)
                validate_required_vars
                log "SUCCESS" "Environment variables validation passed"
                exit 0
                ;;
            --dry-run)
                log "INFO" "DRY RUN MODE - No changes will be made"
                DRY_RUN=true
                shift
                ;;
            --help)
                show_usage
                exit 0
                ;;
            *)
                log "ERROR" "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
    
    # Validate prerequisites
    validate_required_vars
    check_kubernetes_access
    
    if [[ "${DRY_RUN:-}" == "true" ]]; then
        log "INFO" "DRY RUN: Would create secrets in namespace '$NAMESPACE'"
        log "INFO" "DRY RUN: Would create database, Redis, AI, app, monitoring, and SMTP secrets"
        log "INFO" "DRY RUN: Would create service account and RBAC"
        log "INFO" "DRY RUN: Would create production ConfigMap"
        exit 0
    fi
    
    # Execute setup steps
    create_namespace
    setup_database_secrets
    setup_redis_secrets
    setup_ai_secrets
    setup_app_secrets
    setup_monitoring_secrets
    setup_smtp_secrets
    setup_tls_secrets
    setup_service_account
    setup_config_map
    
    # Validate and summarize
    validate_secrets
    generate_env_reference
    show_secret_summary
    
    log "SUCCESS" "Production secrets setup completed successfully!"
    log "INFO" "Setup log saved to: $SECRET_LOG"
}

# Run main function with all arguments
main "$@"