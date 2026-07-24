#!/bin/bash

# Production Deployment Orchestrator
# Executes staged production deployment with proper validation and rollback capabilities
# Usage: ./execute-production-deployment.sh [options]

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$PROJECT_DIR/logs/deployment"
BACKUP_DIR="$PROJECT_DIR/backups"
REPORTS_DIR="$PROJECT_DIR/reports/deployment"

# Colors and formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Deployment configuration
DEPLOYMENT_ID="deploy-$(date +%Y%m%d-%H%M%S)"
START_TIME=$(date +%s)
DEPLOYMENT_ENV="${DEPLOYMENT_ENV:-production}"
DRY_RUN="${DRY_RUN:-false}"
SKIP_TESTS="${SKIP_TESTS:-false}"
FEATURE_FLAG_ROLLOUT="${FEATURE_FLAG_ROLLOUT:-10}" # Start with 10% rollout
MAX_ROLLBACK_TIME=1800 # 30 minutes
HEALTH_CHECK_TIMEOUT=300 # 5 minutes

# Deployment phases
declare -A DEPLOYMENT_PHASES=(
    [1]="pre_deployment_validation"
    [2]="infrastructure_deployment"
    [3]="database_migration"
    [4]="application_deployment"
    [5]="feature_flag_activation"
    [6]="smoke_testing"
    [7]="gradual_rollout"
    [8]="post_deployment_validation"
)

# Global variables
CURRENT_PHASE=""
DEPLOYMENT_STATUS="starting"
ROLLBACK_INITIATED=false
DEPLOYMENT_ERRORS=()
DEPLOYMENT_WARNINGS=()
DEPLOYED_SERVICES=()

# Initialize logging and directories
init_deployment() {
    echo -e "${BOLD}${BLUE}=== Stapelwerk Production Deployment ===${NC}"
    echo -e "${CYAN}Deployment ID: $DEPLOYMENT_ID${NC}"
    echo -e "${CYAN}Environment: $DEPLOYMENT_ENV${NC}"
    echo -e "${CYAN}Started: $(date)${NC}"
    echo

    # Create necessary directories
    mkdir -p "$LOG_DIR" "$BACKUP_DIR" "$REPORTS_DIR"
    
    # Initialize deployment log
    local log_file="$LOG_DIR/${DEPLOYMENT_ID}.log"
    exec 1> >(tee -a "$log_file")
    exec 2> >(tee -a "$log_file" >&2)
    
    # Initialize deployment report
    cat > "$REPORTS_DIR/${DEPLOYMENT_ID}.json" << EOF
{
  "deploymentId": "$DEPLOYMENT_ID",
  "environment": "$DEPLOYMENT_ENV",
  "startTime": "$(date -Iseconds)",
  "phases": [],
  "status": "starting",
  "errors": [],
  "warnings": [],
  "deployedServices": [],
  "rollbackInitiated": false
}
EOF
}

# Logging functions
log_info() {
    echo -e "${CYAN}[INFO]${NC} $1"
    update_deployment_report "info" "$1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
    update_deployment_report "success" "$1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
    DEPLOYMENT_WARNINGS+=("$1")
    update_deployment_report "warning" "$1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    DEPLOYMENT_ERRORS+=("$1")
    update_deployment_report "error" "$1"
}

log_phase() {
    echo
    echo -e "${BOLD}${PURPLE}=== Phase $1: $2 ===${NC}"
    CURRENT_PHASE="$2"
    update_deployment_report "phase_start" "Phase $1: $2"
}

# Update deployment report
update_deployment_report() {
    local level="$1"
    local message="$2"
    local timestamp=$(date -Iseconds)
    
    # Create temporary report update
    local temp_file="$REPORTS_DIR/${DEPLOYMENT_ID}.tmp"
    jq --arg level "$level" \
       --arg message "$message" \
       --arg timestamp "$timestamp" \
       --arg phase "$CURRENT_PHASE" \
       --arg status "$DEPLOYMENT_STATUS" \
       --argjson errors "$(printf '%s\n' "${DEPLOYMENT_ERRORS[@]}" | jq -R . | jq -s .)" \
       --argjson warnings "$(printf '%s\n' "${DEPLOYMENT_WARNINGS[@]}" | jq -R . | jq -s .)" \
       --argjson services "$(printf '%s\n' "${DEPLOYED_SERVICES[@]}" | jq -R . | jq -s .)" \
       '.phases += [{level: $level, message: $message, timestamp: $timestamp, phase: $phase}] |
        .status = $status |
        .errors = $errors |
        .warnings = $warnings |
        .deployedServices = $services |
        .rollbackInitiated = $ARGS.named.rollbackInitiated |
        .lastUpdated = $timestamp' \
        --argjson rollbackInitiated "$ROLLBACK_INITIATED" \
       "$REPORTS_DIR/${DEPLOYMENT_ID}.json" > "$temp_file"
    
    mv "$temp_file" "$REPORTS_DIR/${DEPLOYMENT_ID}.json"
}

# Send deployment notifications
send_notification() {
    local status="$1"
    local message="$2"
    local webhook_url="${SLACK_WEBHOOK_URL:-}"
    
    if [[ -n "$webhook_url" ]]; then
        local color="good"
        [[ "$status" == "error" ]] && color="danger"
        [[ "$status" == "warning" ]] && color="warning"
        
        curl -X POST -H 'Content-type: application/json' \
            --data "{
                \"attachments\": [{
                    \"color\": \"$color\",
                    \"title\": \"Stapelwerk Deployment: $DEPLOYMENT_ID\",
                    \"text\": \"$message\",
                    \"fields\": [
                        {\"title\": \"Environment\", \"value\": \"$DEPLOYMENT_ENV\", \"short\": true},
                        {\"title\": \"Phase\", \"value\": \"$CURRENT_PHASE\", \"short\": true},
                        {\"title\": \"Status\", \"value\": \"$DEPLOYMENT_STATUS\", \"short\": true}
                    ],
                    \"ts\": $(date +%s)
                }]
            }" \
            "$webhook_url" &>/dev/null || true
    fi
    
    # Also send email if configured
    if command -v sendmail &>/dev/null && [[ -n "${DEPLOYMENT_EMAIL:-}" ]]; then
        {
            echo "To: $DEPLOYMENT_EMAIL"
            echo "Subject: Stapelwerk Deployment $DEPLOYMENT_ID - $status"
            echo "Content-Type: text/html"
            echo
            echo "<h2>Stapelwerk Deployment Report</h2>"
            echo "<p><strong>Deployment ID:</strong> $DEPLOYMENT_ID</p>"
            echo "<p><strong>Environment:</strong> $DEPLOYMENT_ENV</p>"
            echo "<p><strong>Phase:</strong> $CURRENT_PHASE</p>"
            echo "<p><strong>Status:</strong> $DEPLOYMENT_STATUS</p>"
            echo "<p><strong>Message:</strong> $message</p>"
            echo "<p><strong>Time:</strong> $(date)</p>"
        } | sendmail "$DEPLOYMENT_EMAIL" || true
    fi
}

# Phase 1: Pre-deployment validation
phase_pre_deployment_validation() {
    log_phase 1 "Pre-deployment Validation"
    
    # Check prerequisites
    log_info "Checking deployment prerequisites..."
    
    # Verify environment variables
    local required_vars=(
        "DATABASE_URL"
        "NEXTAUTH_SECRET"
        "OPENAI_API_KEY"
        "REDIS_URL"
    )
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            log_error "Required environment variable $var is not set"
            return 1
        fi
    done
    
    # Verify dependencies
    local required_commands=("node" "npm" "docker" "kubectl" "jq")
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &>/dev/null; then
            log_error "Required command '$cmd' is not available"
            return 1
        fi
    done
    
    # Run pre-deployment tests
    if [[ "$SKIP_TESTS" != "true" ]]; then
        log_info "Running pre-deployment tests..."
        if ! npm run test:ci; then
            log_error "Pre-deployment tests failed"
            return 1
        fi
        log_success "All pre-deployment tests passed"
    fi
    
    # Verify Kubernetes cluster access
    log_info "Verifying Kubernetes cluster access..."
    if ! kubectl cluster-info &>/dev/null; then
        log_error "Cannot access Kubernetes cluster"
        return 1
    fi
    
    # Check cluster resources
    local node_count=$(kubectl get nodes --no-headers | wc -l)
    if [[ $node_count -lt 2 ]]; then
        log_warning "Cluster has fewer than 2 nodes ($node_count nodes available)"
    fi
    
    log_success "Pre-deployment validation completed"
    return 0
}

# Phase 2: Infrastructure deployment
phase_infrastructure_deployment() {
    log_phase 2 "Infrastructure Deployment"
    
    log_info "Deploying infrastructure components..."
    
    # Deploy namespace if not exists
    if ! kubectl get namespace stapelwerk-prod &>/dev/null; then
        log_info "Creating production namespace..."
        kubectl create namespace stapelwerk-prod
    fi
    
    # Apply ConfigMaps and Secrets
    log_info "Applying configuration and secrets..."
    if [[ -f "$PROJECT_DIR/k8s/configmap.yaml" ]]; then
        kubectl apply -f "$PROJECT_DIR/k8s/configmap.yaml" -n stapelwerk-prod
    fi
    
    if [[ -f "$PROJECT_DIR/k8s/secrets.yaml" ]]; then
        kubectl apply -f "$PROJECT_DIR/k8s/secrets.yaml" -n stapelwerk-prod
    fi
    
    # Deploy Redis
    log_info "Deploying Redis..."
    if [[ -f "$PROJECT_DIR/k8s/redis.yaml" ]]; then
        kubectl apply -f "$PROJECT_DIR/k8s/redis.yaml" -n stapelwerk-prod
        kubectl rollout status deployment/redis -n stapelwerk-prod --timeout=300s
        DEPLOYED_SERVICES+=("redis")
    fi
    
    # Deploy PostgreSQL (if not using external)
    if [[ "${USE_EXTERNAL_DB:-false}" != "true" ]]; then
        log_info "Deploying PostgreSQL..."
        if [[ -f "$PROJECT_DIR/k8s/postgres.yaml" ]]; then
            kubectl apply -f "$PROJECT_DIR/k8s/postgres.yaml" -n stapelwerk-prod
            kubectl rollout status statefulset/postgres -n stapelwerk-prod --timeout=300s
            DEPLOYED_SERVICES+=("postgres")
        fi
    fi
    
    log_success "Infrastructure deployment completed"
    return 0
}

# Phase 3: Database migration
phase_database_migration() {
    log_phase 3 "Database Migration"
    
    log_info "Starting database migration..."
    
    # Create database backup
    log_info "Creating pre-migration backup..."
    if [[ -f "$SCRIPT_DIR/db-backup-restore.sh" ]]; then
        if ! bash "$SCRIPT_DIR/db-backup-restore.sh" backup "pre-migration-${DEPLOYMENT_ID}"; then
            log_error "Failed to create pre-migration backup"
            return 1
        fi
        log_success "Pre-migration backup created"
    fi
    
    # Run database migrations
    log_info "Executing database migrations..."
    if [[ -f "$SCRIPT_DIR/db-migrate-production.sh" ]]; then
        if ! bash "$SCRIPT_DIR/db-migrate-production.sh" --environment "$DEPLOYMENT_ENV"; then
            log_error "Database migration failed"
            return 1
        fi
        log_success "Database migrations completed"
    fi
    
    # Verify database integrity
    log_info "Verifying database integrity..."
    if ! npx prisma db push --accept-data-loss=false; then
        log_error "Database integrity check failed"
        return 1
    fi
    
    # Seed production data if needed
    if [[ "${SEED_PRODUCTION_DATA:-true}" == "true" ]]; then
        log_info "Seeding production data..."
        if [[ -f "$SCRIPT_DIR/db-init-production.sh" ]]; then
            bash "$SCRIPT_DIR/db-init-production.sh" --skip-migration --level production
        fi
    fi
    
    log_success "Database migration completed"
    return 0
}

# Phase 4: Application deployment
phase_application_deployment() {
    log_phase 4 "Application Deployment"
    
    log_info "Building and deploying application..."
    
    # Build Docker image
    local image_tag="stapelwerk:${DEPLOYMENT_ID}"
    log_info "Building Docker image: $image_tag"
    
    if [[ "$DRY_RUN" != "true" ]]; then
        if ! docker build -t "$image_tag" .; then
            log_error "Docker image build failed"
            return 1
        fi
        
        # Push to registry if configured
        if [[ -n "${DOCKER_REGISTRY:-}" ]]; then
            local registry_image="$DOCKER_REGISTRY/$image_tag"
            docker tag "$image_tag" "$registry_image"
            docker push "$registry_image"
            image_tag="$registry_image"
        fi
    fi
    
    # Update Kubernetes deployment
    log_info "Deploying application to Kubernetes..."
    
    # Update deployment image
    if [[ -f "$PROJECT_DIR/k8s/deployment.yaml" ]]; then
        # Create temporary deployment file with new image
        local temp_deployment="$PROJECT_DIR/k8s/deployment-${DEPLOYMENT_ID}.yaml"
        sed "s|image: stapelwerk:.*|image: $image_tag|g" \
            "$PROJECT_DIR/k8s/deployment.yaml" > "$temp_deployment"
        
        kubectl apply -f "$temp_deployment" -n stapelwerk-prod
        rm -f "$temp_deployment"
        
        # Wait for rollout
        kubectl rollout status deployment/stapelwerk -n stapelwerk-prod --timeout=600s
        DEPLOYED_SERVICES+=("stapelwerk")
        
        log_success "Application deployment completed"
    fi
    
    # Deploy services
    if [[ -f "$PROJECT_DIR/k8s/service.yaml" ]]; then
        kubectl apply -f "$PROJECT_DIR/k8s/service.yaml" -n stapelwerk-prod
    fi
    
    # Deploy ingress
    if [[ -f "$PROJECT_DIR/k8s/ingress.yaml" ]]; then
        kubectl apply -f "$PROJECT_DIR/k8s/ingress.yaml" -n stapelwerk-prod
    fi
    
    return 0
}

# Phase 5: Feature flag activation
phase_feature_flag_activation() {
    log_phase 5 "Feature Flag Activation"
    
    log_info "Activating feature flags with gradual rollout..."
    
    # Use feature flag management script
    if [[ -f "$SCRIPT_DIR/manage-feature-flags.js" ]]; then
        # Start with low percentage rollout
        log_info "Setting AI recommendations feature to ${FEATURE_FLAG_ROLLOUT}% rollout"
        
        if [[ "$DRY_RUN" != "true" ]]; then
            node "$SCRIPT_DIR/manage-feature-flags.js" set \
                --flag "ai_recommendations" \
                --enabled true \
                --percentage "$FEATURE_FLAG_ROLLOUT" \
                --environment "$DEPLOYMENT_ENV"
                
            node "$SCRIPT_DIR/manage-feature-flags.js" set \
                --flag "template_system" \
                --enabled true \
                --percentage "$FEATURE_FLAG_ROLLOUT" \
                --environment "$DEPLOYMENT_ENV"
        fi
        
        log_success "Feature flags activated with ${FEATURE_FLAG_ROLLOUT}% rollout"
    fi
    
    return 0
}

# Phase 6: Smoke testing
phase_smoke_testing() {
    log_phase 6 "Smoke Testing"
    
    log_info "Running smoke tests..."
    
    if [[ -f "$SCRIPT_DIR/run-smoke-tests.sh" ]]; then
        if ! bash "$SCRIPT_DIR/run-smoke-tests.sh" --environment "$DEPLOYMENT_ENV"; then
            log_error "Smoke tests failed"
            return 1
        fi
        log_success "All smoke tests passed"
    fi
    
    # Additional health checks
    log_info "Performing additional health checks..."
    
    # Check application pods
    local ready_pods=$(kubectl get pods -n stapelwerk-prod -l app=stapelwerk -o jsonpath='{.items[?(@.status.phase=="Running")].metadata.name}' | wc -w)
    local total_pods=$(kubectl get pods -n stapelwerk-prod -l app=stapelwerk --no-headers | wc -l)
    
    if [[ $ready_pods -lt 1 ]]; then
        log_error "No application pods are ready ($ready_pods/$total_pods)"
        return 1
    fi
    
    log_info "Application pods status: $ready_pods/$total_pods ready"
    
    return 0
}

# Phase 7: Gradual rollout
phase_gradual_rollout() {
    log_phase 7 "Gradual Rollout"
    
    if [[ "$FEATURE_FLAG_ROLLOUT" -ge 100 ]]; then
        log_info "Full rollout already configured, skipping gradual rollout"
        return 0
    fi
    
    local rollout_stages=(25 50 75 100)
    local current_rollout="$FEATURE_FLAG_ROLLOUT"
    
    for stage in "${rollout_stages[@]}"; do
        if [[ $stage -le $current_rollout ]]; then
            continue
        fi
        
        log_info "Increasing rollout to ${stage}%..."
        
        if [[ "$DRY_RUN" != "true" ]] && [[ -f "$SCRIPT_DIR/manage-feature-flags.js" ]]; then
            node "$SCRIPT_DIR/manage-feature-flags.js" set \
                --flag "ai_recommendations" \
                --percentage "$stage" \
                --environment "$DEPLOYMENT_ENV"
                
            node "$SCRIPT_DIR/manage-feature-flags.js" set \
                --flag "template_system" \
                --percentage "$stage" \
                --environment "$DEPLOYMENT_ENV"
        fi
        
        # Wait and monitor
        log_info "Monitoring for 2 minutes before next stage..."
        sleep 120
        
        # Check error rates
        if command -v curl &>/dev/null; then
            local health_url="${APP_URL:-http://localhost:3000}/api/health"
            local health_check=$(curl -s "$health_url" | jq -r '.status // "error"')
            
            if [[ "$health_check" != "ok" ]]; then
                log_warning "Health check failed at ${stage}% rollout"
            fi
        fi
        
        log_success "Rollout increased to ${stage}%"
    done
    
    log_success "Gradual rollout completed - 100% rollout achieved"
    return 0
}

# Phase 8: Post-deployment validation
phase_post_deployment_validation() {
    log_phase 8 "Post-deployment Validation"
    
    log_info "Running comprehensive post-deployment validation..."
    
    # Run deployment verification
    if [[ -f "$SCRIPT_DIR/verify-deployment.sh" ]]; then
        if ! bash "$SCRIPT_DIR/verify-deployment.sh" --environment "$DEPLOYMENT_ENV"; then
            log_error "Deployment verification failed"
            return 1
        fi
        log_success "Deployment verification passed"
    fi
    
    # Performance validation
    log_info "Validating performance metrics..."
    if command -v curl &>/dev/null; then
        local start_time=$(date +%s%N)
        curl -s "${APP_URL:-http://localhost:3000}/api/health" &>/dev/null
        local end_time=$(date +%s%N)
        local response_time=$(( (end_time - start_time) / 1000000 ))
        
        if [[ $response_time -gt 1000 ]]; then
            log_warning "Response time is high: ${response_time}ms"
        else
            log_info "Response time: ${response_time}ms"
        fi
    fi
    
    log_success "Post-deployment validation completed"
    return 0
}

# Rollback function
initiate_rollback() {
    log_error "Initiating rollback due to deployment failure"
    ROLLBACK_INITIATED=true
    DEPLOYMENT_STATUS="rolling_back"
    
    send_notification "error" "Deployment failed, initiating rollback"
    
    # Disable feature flags immediately
    if [[ -f "$SCRIPT_DIR/manage-feature-flags.js" ]]; then
        log_info "Disabling feature flags..."
        node "$SCRIPT_DIR/manage-feature-flags.js" set \
            --flag "ai_recommendations" \
            --enabled false \
            --environment "$DEPLOYMENT_ENV" &>/dev/null || true
            
        node "$SCRIPT_DIR/manage-feature-flags.js" set \
            --flag "template_system" \
            --enabled false \
            --environment "$DEPLOYMENT_ENV" &>/dev/null || true
    fi
    
    # Rollback Kubernetes deployment
    log_info "Rolling back Kubernetes deployment..."
    kubectl rollout undo deployment/stapelwerk -n stapelwerk-prod &>/dev/null || true
    kubectl rollout status deployment/stapelwerk -n stapelwerk-prod --timeout=300s &>/dev/null || true
    
    # Restore database backup if needed
    local restore_db="${ROLLBACK_DATABASE:-false}"
    if [[ "$restore_db" == "true" ]] && [[ -f "$SCRIPT_DIR/db-backup-restore.sh" ]]; then
        log_info "Restoring database backup..."
        bash "$SCRIPT_DIR/db-backup-restore.sh" restore "pre-migration-${DEPLOYMENT_ID}" || true
    fi
    
    DEPLOYMENT_STATUS="rolled_back"
    log_success "Rollback completed"
    
    return 0
}

# Cleanup function
cleanup_deployment() {
    local exit_code=$?
    local end_time=$(date +%s)
    local duration=$((end_time - START_TIME))
    
    # Final status update
    if [[ $exit_code -eq 0 && "$ROLLBACK_INITIATED" != "true" ]]; then
        DEPLOYMENT_STATUS="completed"
        log_success "Deployment completed successfully in ${duration}s"
        send_notification "success" "Deployment completed successfully in ${duration}s"
    else
        DEPLOYMENT_STATUS="failed"
        log_error "Deployment failed after ${duration}s"
        send_notification "error" "Deployment failed after ${duration}s"
    fi
    
    # Update final report
    update_deployment_report "deployment_end" "Deployment ended with status: $DEPLOYMENT_STATUS"
    
    # Generate summary
    echo
    echo -e "${BOLD}=== Deployment Summary ===${NC}"
    echo -e "Deployment ID: ${CYAN}$DEPLOYMENT_ID${NC}"
    echo -e "Duration: ${CYAN}${duration}s${NC}"
    echo -e "Status: ${CYAN}$DEPLOYMENT_STATUS${NC}"
    echo -e "Errors: ${CYAN}${#DEPLOYMENT_ERRORS[@]}${NC}"
    echo -e "Warnings: ${CYAN}${#DEPLOYMENT_WARNINGS[@]}${NC}"
    echo -e "Services Deployed: ${CYAN}${#DEPLOYED_SERVICES[@]}${NC}"
    
    if [[ ${#DEPLOYED_SERVICES[@]} -gt 0 ]]; then
        echo -e "Deployed Services: ${CYAN}$(IFS=', '; echo "${DEPLOYED_SERVICES[*]}")${NC}"
    fi
    
    echo
    echo -e "Reports available in: ${CYAN}$REPORTS_DIR${NC}"
    echo -e "Logs available in: ${CYAN}$LOG_DIR${NC}"
    
    return $exit_code
}

# Signal handlers
trap 'initiate_rollback; cleanup_deployment' ERR
trap 'log_info "Deployment interrupted by user"; initiate_rollback; cleanup_deployment' INT TERM

# Help function
show_help() {
    cat << EOF
Stapelwerk Production Deployment Orchestrator

Usage: $0 [options]

Options:
  --environment ENV     Deployment environment (default: production)
  --dry-run            Simulate deployment without making changes
  --skip-tests         Skip pre-deployment tests
  --feature-rollout N   Initial feature flag rollout percentage (default: 10)
  --rollback-database   Include database rollback in case of failure
  --help               Show this help message

Environment Variables:
  DATABASE_URL         Production database connection string
  NEXTAUTH_SECRET      NextAuth.js secret
  OPENAI_API_KEY       OpenAI API key
  REDIS_URL           Redis connection string
  SLACK_WEBHOOK_URL    Slack webhook for notifications
  DEPLOYMENT_EMAIL     Email for deployment notifications
  DOCKER_REGISTRY      Docker registry for image storage
  APP_URL             Application URL for health checks

Examples:
  # Standard production deployment
  $0

  # Dry run with 50% initial rollout
  $0 --dry-run --feature-rollout 50

  # Staging deployment with database rollback protection
  $0 --environment staging --rollback-database
EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --environment)
            DEPLOYMENT_ENV="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN="true"
            shift
            ;;
        --skip-tests)
            SKIP_TESTS="true"
            shift
            ;;
        --feature-rollout)
            FEATURE_FLAG_ROLLOUT="$2"
            shift 2
            ;;
        --rollback-database)
            ROLLBACK_DATABASE="true"
            shift
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Main deployment execution
main() {
    init_deployment
    
    # Execute deployment phases
    for phase_num in "${!DEPLOYMENT_PHASES[@]}"; do
        local phase_name="${DEPLOYMENT_PHASES[$phase_num]}"
        local phase_function="phase_${phase_name}"
        
        DEPLOYMENT_STATUS="phase_${phase_num}"
        
        if [[ "$DRY_RUN" == "true" ]]; then
            log_info "[DRY RUN] Would execute: $phase_function"
            continue
        fi
        
        if ! "$phase_function"; then
            log_error "Phase $phase_num ($phase_name) failed"
            return 1
        fi
    done
    
    DEPLOYMENT_STATUS="completed"
    log_success "All deployment phases completed successfully"
    
    return 0
}

# Execute main function
main "$@"
exit $?