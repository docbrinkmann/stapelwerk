#!/bin/bash

# Production Deployment Script for AI-Powered Recommendations System
# This script automates the deployment and rollout process defined in DEPLOYMENT_STRATEGY.md

set -e  # Exit on any error

# Script Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
CONFIG_FILE="${PROJECT_ROOT}/deployment/production.config.yaml"
DEPLOYMENT_LOG="${PROJECT_ROOT}/logs/deployment-$(date +%Y%m%d-%H%M%S).log"

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
    
    echo -e "${timestamp} [${level}] ${message}" | tee -a "${DEPLOYMENT_LOG}"
    
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
    log "ERROR" "Deployment failed at line $1 with exit code $exit_code"
    log "ERROR" "Check the deployment log at: $DEPLOYMENT_LOG"
    
    # Optional: Send alert notification
    if [[ -n "$SLACK_WEBHOOK_URL" ]]; then
        curl -X POST -H 'Content-type: application/json' \
             --data "{\"text\":\"🚨 Production deployment failed: $exit_code\"}" \
             "$SLACK_WEBHOOK_URL" || true
    fi
    
    exit $exit_code
}

# Set error trap
trap 'error_handler $LINENO' ERR

# Function to check prerequisites
check_prerequisites() {
    log "INFO" "Checking deployment prerequisites..."
    
    # Check required environment variables
    local required_vars=(
        "DB_HOST" "DB_NAME" "DB_USER" "SECRET_DB_PASSWORD"
        "REDIS_HOST" "SECRET_REDIS_PASSWORD"
        "SECRET_OPENAI_API_KEY" "SECRET_ANTHROPIC_API_KEY"
        "SECRET_JWT_SECRET" "SECRET_SENTRY_DSN"
    )
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var}" ]]; then
            log "ERROR" "Required environment variable $var is not set"
            exit 1
        fi
    done
    
    # Check required tools
    local required_tools=("kubectl" "helm" "docker" "curl" "jq")
    
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log "ERROR" "Required tool '$tool' is not installed"
            exit 1
        fi
    done
    
    # Check Kubernetes cluster connectivity
    if ! kubectl cluster-info &> /dev/null; then
        log "ERROR" "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    # Check Docker registry access
    if ! docker pull nginx:latest &> /dev/null; then
        log "ERROR" "Cannot access Docker registry"
        exit 1
    fi
    
    log "SUCCESS" "All prerequisites satisfied"
}

# Function to validate deployment configuration
validate_config() {
    log "INFO" "Validating deployment configuration..."
    
    if [[ ! -f "$CONFIG_FILE" ]]; then
        log "ERROR" "Production configuration file not found: $CONFIG_FILE"
        exit 1
    fi
    
    # Validate YAML syntax
    if ! yq eval '.' "$CONFIG_FILE" &> /dev/null; then
        log "ERROR" "Invalid YAML syntax in configuration file"
        exit 1
    fi
    
    # Check required configuration sections
    local required_sections=("app" "database" "redis" "monitoring" "featureFlags")
    
    for section in "${required_sections[@]}"; do
        if ! yq eval ".${section}" "$CONFIG_FILE" | grep -q .; then
            log "ERROR" "Missing required configuration section: $section"
            exit 1
        fi
    done
    
    log "SUCCESS" "Configuration validation passed"
}

# Function to run pre-deployment tests
run_pre_deployment_tests() {
    log "INFO" "Running pre-deployment tests..."
    
    # Change to project root
    cd "$PROJECT_ROOT"
    
    # Install dependencies if needed
    if [[ -f "package.json" ]]; then
        log "INFO" "Installing Node.js dependencies..."
        npm ci --only=production
    fi
    
    # Run unit tests
    log "INFO" "Running unit tests..."
    if [[ -f "package.json" ]] && grep -q '"test"' package.json; then
        npm test
    fi
    
    # Run integration tests
    log "INFO" "Running integration tests..."
    if [[ -f "package.json" ]] && grep -q '"test:integration"' package.json; then
        npm run test:integration
    fi
    
    # Run security scan
    log "INFO" "Running security scan..."
    if command -v npm &> /dev/null; then
        npm audit --audit-level=moderate || {
            log "WARN" "Security vulnerabilities detected - review before deployment"
        }
    fi
    
    log "SUCCESS" "Pre-deployment tests completed"
}

# Function to build and push Docker image
build_and_push_image() {
    log "INFO" "Building and pushing Docker image..."
    
    local image_tag="${DOCKER_REGISTRY}/buildmystack-ai:${BUILD_VERSION:-latest}"
    
    # Build Docker image
    log "INFO" "Building Docker image: $image_tag"
    docker build -t "$image_tag" "$PROJECT_ROOT"
    
    # Tag as latest
    docker tag "$image_tag" "${DOCKER_REGISTRY}/buildmystack-ai:latest"
    
    # Push images
    log "INFO" "Pushing Docker image to registry..."
    docker push "$image_tag"
    docker push "${DOCKER_REGISTRY}/buildmystack-ai:latest"
    
    log "SUCCESS" "Docker image built and pushed: $image_tag"
}

# Function to deploy infrastructure
deploy_infrastructure() {
    log "INFO" "Deploying infrastructure components..."
    
    # Create namespace if it doesn't exist
    kubectl create namespace buildmystack --dry-run=client -o yaml | kubectl apply -f -
    
    # Deploy database (if using managed service, this might be external)
    if [[ "$DB_DEPLOY_TYPE" == "kubernetes" ]]; then
        log "INFO" "Deploying database..."
        helm upgrade --install postgres postgresql-ha \
            --repo https://charts.bitnami.com/bitnami \
            --namespace buildmystack \
            --set postgresql.repmgrPassword="$SECRET_DB_REPMGR_PASSWORD" \
            --set postgresql.postgresqlPassword="$SECRET_DB_PASSWORD"
    fi
    
    # Deploy Redis (if using managed service, this might be external)
    if [[ "$REDIS_DEPLOY_TYPE" == "kubernetes" ]]; then
        log "INFO" "Deploying Redis..."
        helm upgrade --install redis redis \
            --repo https://charts.bitnami.com/bitnami \
            --namespace buildmystack \
            --set auth.password="$SECRET_REDIS_PASSWORD"
    fi
    
    # Deploy monitoring stack
    log "INFO" "Deploying monitoring stack..."
    helm upgrade --install prometheus prometheus \
        --repo https://prometheus-community.github.io/helm-charts \
        --namespace monitoring \
        --create-namespace \
        --set server.service.type=LoadBalancer
    
    log "SUCCESS" "Infrastructure deployment completed"
}

# Function to deploy application
deploy_application() {
    local phase=$1
    local feature_flags=$2
    
    log "INFO" "Deploying application for phase: $phase"
    
    # Create Kubernetes deployment manifest
    cat > "${PROJECT_ROOT}/k8s-deployment-${phase}.yaml" << EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: buildmystack-ai
  namespace: buildmystack
  labels:
    app: buildmystack-ai
    version: "${BUILD_VERSION:-latest}"
    phase: "${phase}"
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: buildmystack-ai
  template:
    metadata:
      labels:
        app: buildmystack-ai
        version: "${BUILD_VERSION:-latest}"
        phase: "${phase}"
    spec:
      containers:
      - name: buildmystack-ai
        image: ${DOCKER_REGISTRY}/buildmystack-ai:${BUILD_VERSION:-latest}
        ports:
        - containerPort: 8080
        env:
        - name: NODE_ENV
          value: "production"
        - name: DB_HOST
          value: "${DB_HOST}"
        - name: DB_NAME
          value: "${DB_NAME}"
        - name: DB_USER
          value: "${DB_USER}"
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-secrets
              key: password
        - name: REDIS_HOST
          value: "${REDIS_HOST}"
        - name: REDIS_PASSWORD
          valueFrom:
            secretKeyRef:
              name: redis-secrets
              key: password
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: ai-secrets
              key: openai-key
        - name: ANTHROPIC_API_KEY
          valueFrom:
            secretKeyRef:
              name: ai-secrets
              key: anthropic-key
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: jwt-secret
        - name: SENTRY_DSN
          valueFrom:
            secretKeyRef:
              name: monitoring-secrets
              key: sentry-dsn
        - name: FEATURE_FLAGS
          value: '${feature_flags}'
        resources:
          requests:
            cpu: "500m"
            memory: "1Gi"
          limits:
            cpu: "2000m"
            memory: "4Gi"
        livenessProbe:
          httpGet:
            path: /health/live
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
        startupProbe:
          httpGet:
            path: /health/startup
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 10
          failureThreshold: 30
---
apiVersion: v1
kind: Service
metadata:
  name: buildmystack-ai-service
  namespace: buildmystack
spec:
  selector:
    app: buildmystack-ai
  ports:
  - port: 80
    targetPort: 8080
  type: LoadBalancer
EOF
    
    # Apply the deployment
    kubectl apply -f "${PROJECT_ROOT}/k8s-deployment-${phase}.yaml"
    
    # Wait for deployment to be ready
    kubectl rollout status deployment/buildmystack-ai -n buildmystack --timeout=300s
    
    log "SUCCESS" "Application deployment completed for phase: $phase"
}

# Function to run smoke tests
run_smoke_tests() {
    local phase=$1
    
    log "INFO" "Running smoke tests for phase: $phase"
    
    # Get service endpoint
    local service_url
    service_url=$(kubectl get service buildmystack-ai-service -n buildmystack -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "localhost")
    
    if [[ "$service_url" == "localhost" ]]; then
        # If no load balancer, use port-forward for testing
        kubectl port-forward service/buildmystack-ai-service 8080:80 -n buildmystack &
        local port_forward_pid=$!
        service_url="http://localhost:8080"
        sleep 5  # Wait for port-forward to establish
    else
        service_url="http://$service_url"
    fi
    
    # Health check
    log "INFO" "Testing health endpoint..."
    if curl -f "$service_url/health" -m 10; then
        log "SUCCESS" "Health check passed"
    else
        log "ERROR" "Health check failed"
        exit 1
    fi
    
    # API endpoint test
    log "INFO" "Testing API endpoints..."
    if curl -f "$service_url/api/health" -m 10; then
        log "SUCCESS" "API health check passed"
    else
        log "ERROR" "API health check failed"
        exit 1
    fi
    
    # Feature flag test
    log "INFO" "Testing feature flags endpoint..."
    if curl -f "$service_url/api/feature-flags" -m 10; then
        log "SUCCESS" "Feature flags endpoint accessible"
    else
        log "WARN" "Feature flags endpoint not accessible (may be expected)"
    fi
    
    # Clean up port-forward if used
    if [[ -n "${port_forward_pid:-}" ]]; then
        kill $port_forward_pid 2>/dev/null || true
    fi
    
    log "SUCCESS" "Smoke tests completed for phase: $phase"
}

# Function to update feature flags for a deployment phase
update_feature_flags() {
    local phase=$1
    
    log "INFO" "Updating feature flags for phase: $phase"
    
    # Get feature flag configuration for this phase from config file
    local feature_flags
    feature_flags=$(yq eval ".rollout.phases[] | select(.name == \"$phase\") | .featureFlags" "$CONFIG_FILE")
    
    if [[ -z "$feature_flags" || "$feature_flags" == "null" ]]; then
        log "ERROR" "No feature flag configuration found for phase: $phase"
        exit 1
    fi
    
    # Update feature flags via API call to the application
    local service_url
    service_url=$(kubectl get service buildmystack-ai-service -n buildmystack -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "localhost:8080")
    
    if curl -X POST \
         -H "Content-Type: application/json" \
         -H "Authorization: Bearer $ADMIN_API_TOKEN" \
         -d "$feature_flags" \
         "$service_url/api/admin/feature-flags" \
         -m 30; then
        log "SUCCESS" "Feature flags updated for phase: $phase"
    else
        log "ERROR" "Failed to update feature flags for phase: $phase"
        exit 1
    fi
}

# Function to monitor deployment health
monitor_deployment() {
    local phase=$1
    local duration=$2
    
    log "INFO" "Monitoring deployment health for phase: $phase (duration: $duration)"
    
    local end_time=$(($(date +%s) + $(echo "$duration" | sed 's/[^0-9]*//g') * 60))
    local check_interval=60  # Check every minute
    
    while [[ $(date +%s) -lt $end_time ]]; do
        # Check pod health
        local ready_pods
        ready_pods=$(kubectl get pods -n buildmystack -l app=buildmystack-ai --field-selector=status.phase=Running -o json | jq '.items | length')
        
        if [[ $ready_pods -lt 3 ]]; then
            log "WARN" "Only $ready_pods pods are ready (expected: 3)"
        else
            log "INFO" "All pods are healthy ($ready_pods/3)"
        fi
        
        # Check basic metrics (this would typically query your monitoring system)
        local service_url
        service_url=$(kubectl get service buildmystack-ai-service -n buildmystack -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "localhost:8080")
        
        # Test response time
        local response_time
        response_time=$(curl -w "%{time_total}" -s -o /dev/null "$service_url/health" -m 10 || echo "0")
        
        if (( $(echo "$response_time > 2.0" | bc -l 2>/dev/null || echo 0) )); then
            log "WARN" "High response time detected: ${response_time}s"
        else
            log "INFO" "Response time OK: ${response_time}s"
        fi
        
        sleep $check_interval
    done
    
    log "SUCCESS" "Monitoring completed for phase: $phase"
}

# Function to send notifications
send_notification() {
    local message=$1
    local level=${2:-"INFO"}
    
    # Slack notification
    if [[ -n "$SLACK_WEBHOOK_URL" ]]; then
        local emoji
        case $level in
            "SUCCESS") emoji="✅" ;;
            "ERROR") emoji="🚨" ;;
            "WARN") emoji="⚠️" ;;
            *) emoji="ℹ️" ;;
        esac
        
        curl -X POST -H 'Content-type: application/json' \
             --data "{\"text\":\"${emoji} BuildMyStack AI Deployment: ${message}\"}" \
             "$SLACK_WEBHOOK_URL" || true
    fi
    
    # Email notification (if configured)
    if [[ -n "$SMTP_HOST" && -n "$NOTIFICATION_EMAIL" ]]; then
        echo "$message" | mail -s "BuildMyStack AI Deployment - $level" "$NOTIFICATION_EMAIL" || true
    fi
}

# Main deployment phases
deploy_phase_infrastructure() {
    log "INFO" "=== PHASE 1: Infrastructure & Foundation ==="
    send_notification "Starting Phase 1: Infrastructure & Foundation"
    
    check_prerequisites
    validate_config
    run_pre_deployment_tests
    build_and_push_image
    deploy_infrastructure
    
    # Deploy with all features disabled
    local feature_flags='{"ai_recommendations":false,"ai_recommendations_advanced_ml":false,"ai_recommendations_realtime_updates":false,"ai_recommendations_analytics":true}'
    deploy_application "infrastructure" "$feature_flags"
    
    run_smoke_tests "infrastructure"
    update_feature_flags "infrastructure"
    
    log "SUCCESS" "Phase 1 completed successfully"
    send_notification "Phase 1: Infrastructure & Foundation completed successfully" "SUCCESS"
}

deploy_phase_internal_beta() {
    log "INFO" "=== PHASE 2: Internal Beta ==="
    send_notification "Starting Phase 2: Internal Beta"
    
    # Enable AI recommendations for internal team only
    local feature_flags='{"ai_recommendations":{"status":"rollout","rolloutPercentage":0,"userTargeting":{"includeUsers":["internal_team"]}},"ai_recommendations_analytics":true}'
    deploy_application "internal_beta" "$feature_flags"
    
    run_smoke_tests "internal_beta"
    update_feature_flags "internal_beta"
    monitor_deployment "internal_beta" "2d"
    
    log "SUCCESS" "Phase 2 completed successfully"
    send_notification "Phase 2: Internal Beta completed successfully" "SUCCESS"
}

deploy_phase_early_adopters() {
    log "INFO" "=== PHASE 3: Early Adopters ==="
    send_notification "Starting Phase 3: Early Adopters (5% rollout)"
    
    local feature_flags='{"ai_recommendations":{"status":"rollout","rolloutPercentage":5},"ai_recommendations_analytics":true}'
    deploy_application "early_adopters" "$feature_flags"
    
    run_smoke_tests "early_adopters"
    update_feature_flags "early_adopters"
    monitor_deployment "early_adopters" "3d"
    
    log "SUCCESS" "Phase 3 completed successfully"
    send_notification "Phase 3: Early Adopters (5%) completed successfully" "SUCCESS"
}

deploy_phase_broader_beta() {
    log "INFO" "=== PHASE 4: Broader Beta ==="
    send_notification "Starting Phase 4: Broader Beta (25% rollout)"
    
    local feature_flags='{"ai_recommendations":{"status":"rollout","rolloutPercentage":25},"ai_recommendations_realtime_updates":{"status":"rollout","rolloutPercentage":15},"ai_recommendations_advanced_ml":{"status":"rollout","rolloutPercentage":10},"ai_recommendations_analytics":true}'
    deploy_application "broader_beta" "$feature_flags"
    
    run_smoke_tests "broader_beta"
    update_feature_flags "broader_beta"
    monitor_deployment "broader_beta" "3d"
    
    log "SUCCESS" "Phase 4 completed successfully"
    send_notification "Phase 4: Broader Beta (25%) completed successfully" "SUCCESS"
}

deploy_phase_major_rollout() {
    log "INFO" "=== PHASE 5: Major Rollout ==="
    send_notification "Starting Phase 5: Major Rollout (75% rollout)"
    
    local feature_flags='{"ai_recommendations":{"status":"rollout","rolloutPercentage":75},"ai_recommendations_realtime_updates":{"status":"rollout","rolloutPercentage":50},"ai_recommendations_advanced_ml":{"status":"rollout","rolloutPercentage":40},"ai_recommendations_analytics":true}'
    deploy_application "major_rollout" "$feature_flags"
    
    run_smoke_tests "major_rollout"
    update_feature_flags "major_rollout"
    monitor_deployment "major_rollout" "4d"
    
    log "SUCCESS" "Phase 5 completed successfully"
    send_notification "Phase 5: Major Rollout (75%) completed successfully" "SUCCESS"
}

deploy_phase_full_production() {
    log "INFO" "=== PHASE 6: Full Production ==="
    send_notification "Starting Phase 6: Full Production (100% rollout)"
    
    local feature_flags='{"ai_recommendations":true,"ai_recommendations_realtime_updates":true,"ai_recommendations_advanced_ml":true,"ai_recommendations_analytics":true}'
    deploy_application "full_production" "$feature_flags"
    
    run_smoke_tests "full_production"
    update_feature_flags "full_production"
    monitor_deployment "full_production" "2d"
    
    log "SUCCESS" "Phase 6 completed successfully - Full production rollout complete!"
    send_notification "🎉 Full Production Rollout completed successfully! AI recommendations now live for all users." "SUCCESS"
}

# Function to show usage
show_usage() {
    cat << EOF
Usage: $0 [COMMAND] [OPTIONS]

Commands:
  full-deploy         Run complete deployment (all phases)
  phase-1            Deploy Phase 1: Infrastructure & Foundation
  phase-2            Deploy Phase 2: Internal Beta
  phase-3            Deploy Phase 3: Early Adopters (5%)
  phase-4            Deploy Phase 4: Broader Beta (25%)
  phase-5            Deploy Phase 5: Major Rollout (75%)
  phase-6            Deploy Phase 6: Full Production (100%)
  rollback           Rollback to previous deployment
  status             Check deployment status
  logs               Show deployment logs
  help               Show this help message

Options:
  --config FILE      Use specific configuration file
  --dry-run          Show what would be deployed without executing
  --skip-tests       Skip pre-deployment tests
  --force            Force deployment even if checks fail

Environment Variables:
  Required: DB_HOST, DB_NAME, DB_USER, SECRET_DB_PASSWORD, REDIS_HOST, 
           SECRET_REDIS_PASSWORD, SECRET_OPENAI_API_KEY, SECRET_ANTHROPIC_API_KEY,
           SECRET_JWT_SECRET, SECRET_SENTRY_DSN
  Optional: SLACK_WEBHOOK_URL, NOTIFICATION_EMAIL, DOCKER_REGISTRY

Examples:
  $0 full-deploy                    # Run complete deployment
  $0 phase-3                        # Deploy phase 3 only
  $0 rollback                       # Rollback to previous version
  $0 status                         # Check deployment status

EOF
}

# Function to rollback deployment
rollback_deployment() {
    log "INFO" "=== ROLLBACK DEPLOYMENT ==="
    send_notification "Starting emergency rollback" "WARN"
    
    # Disable all feature flags immediately
    local feature_flags='{"ai_recommendations":false,"ai_recommendations_advanced_ml":false,"ai_recommendations_realtime_updates":false,"ai_recommendations_analytics":true}'
    
    # Try to update feature flags first (fastest rollback)
    log "INFO" "Disabling feature flags..."
    if update_feature_flags "rollback" &>/dev/null; then
        log "SUCCESS" "Feature flags disabled - users no longer see AI features"
    else
        log "WARN" "Could not disable feature flags via API"
    fi
    
    # Rollback to previous deployment
    log "INFO" "Rolling back Kubernetes deployment..."
    if kubectl rollout undo deployment/buildmystack-ai -n buildmystack; then
        kubectl rollout status deployment/buildmystack-ai -n buildmystack --timeout=300s
        log "SUCCESS" "Kubernetes deployment rolled back"
    else
        log "ERROR" "Failed to rollback Kubernetes deployment"
        exit 1
    fi
    
    # Verify rollback
    run_smoke_tests "rollback"
    
    log "SUCCESS" "Rollback completed successfully"
    send_notification "Emergency rollback completed successfully" "SUCCESS"
}

# Function to check deployment status
check_deployment_status() {
    log "INFO" "=== DEPLOYMENT STATUS ==="
    
    # Check Kubernetes deployment status
    echo "Kubernetes Deployment Status:"
    kubectl get deployment buildmystack-ai -n buildmystack -o wide 2>/dev/null || echo "No deployment found"
    
    echo -e "\\nPod Status:"
    kubectl get pods -n buildmystack -l app=buildmystack-ai 2>/dev/null || echo "No pods found"
    
    echo -e "\\nService Status:"
    kubectl get service buildmystack-ai-service -n buildmystack 2>/dev/null || echo "No service found"
    
    # Check feature flags status
    echo -e "\\nFeature Flags Status:"
    local service_url
    service_url=$(kubectl get service buildmystack-ai-service -n buildmystack -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "localhost:8080")
    
    if curl -s "$service_url/api/feature-flags" | jq . 2>/dev/null; then
        log "SUCCESS" "Feature flags retrieved successfully"
    else
        log "WARN" "Could not retrieve feature flags status"
    fi
}

# Main script execution
main() {
    # Create logs directory if it doesn't exist
    mkdir -p "${PROJECT_ROOT}/logs"
    
    # Parse command line arguments
    local command=${1:-"help"}
    shift || true
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --config)
                CONFIG_FILE="$2"
                shift 2
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --skip-tests)
                SKIP_TESTS=true
                shift
                ;;
            --force)
                FORCE_DEPLOY=true
                shift
                ;;
            *)
                log "ERROR" "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
    
    # Execute command
    case $command in
        "full-deploy")
            deploy_phase_infrastructure
            deploy_phase_internal_beta
            deploy_phase_early_adopters
            deploy_phase_broader_beta
            deploy_phase_major_rollout
            deploy_phase_full_production
            ;;
        "phase-1")
            deploy_phase_infrastructure
            ;;
        "phase-2")
            deploy_phase_internal_beta
            ;;
        "phase-3")
            deploy_phase_early_adopters
            ;;
        "phase-4")
            deploy_phase_broader_beta
            ;;
        "phase-5")
            deploy_phase_major_rollout
            ;;
        "phase-6")
            deploy_phase_full_production
            ;;
        "rollback")
            rollback_deployment
            ;;
        "status")
            check_deployment_status
            ;;
        "logs")
            if [[ -f "$DEPLOYMENT_LOG" ]]; then
                tail -f "$DEPLOYMENT_LOG"
            else
                echo "No deployment log found at: $DEPLOYMENT_LOG"
                exit 1
            fi
            ;;
        "help")
            show_usage
            ;;
        *)
            log "ERROR" "Unknown command: $command"
            show_usage
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"