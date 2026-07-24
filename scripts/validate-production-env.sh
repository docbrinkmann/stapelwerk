#!/bin/bash

# Production Environment Validation Script
# This script validates all production environment variables and configuration

set -e

# Script Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Validation results
VALIDATION_ERRORS=()
VALIDATION_WARNINGS=()
VALIDATION_INFO=()

# Function to add error
add_error() {
    VALIDATION_ERRORS+=("$1")
    echo -e "${RED}✗ ERROR: $1${NC}"
}

# Function to add warning
add_warning() {
    VALIDATION_WARNINGS+=("$1")
    echo -e "${YELLOW}⚠ WARNING: $1${NC}"
}

# Function to add info
add_info() {
    VALIDATION_INFO+=("$1")
    echo -e "${BLUE}ℹ INFO: $1${NC}"
}

# Function to add success
add_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# Function to validate required environment variables
validate_required_vars() {
    echo -e "\n${BLUE}=== Validating Required Environment Variables ===${NC}"
    
    local required_vars=(
        "PROD_DB_HOST:Production database hostname"
        "PROD_DB_NAME:Production database name"
        "PROD_DB_USER:Production database username"
        "PROD_REDIS_HOST:Production Redis hostname"
        "OPENAI_API_KEY:OpenAI API key for AI services"
        "ANTHROPIC_API_KEY:Anthropic API key for AI services"
        "SENTRY_DSN:Sentry project DSN for error tracking"
        "SLACK_WEBHOOK_URL:Slack webhook URL for notifications"
        "SMTP_HOST:SMTP server hostname for email notifications"
        "SMTP_USERNAME:SMTP username for email authentication"
        "PAGERDUTY_INTEGRATION_KEY:PagerDuty integration key for alerting"
    )
    
    local missing_count=0
    
    for var_info in "${required_vars[@]}"; do
        local var_name="${var_info%%:*}"
        local var_desc="${var_info##*:}"
        
        if [[ -z "${!var_name:-}" ]]; then
            add_error "Missing required variable: $var_name ($var_desc)"
            missing_count=$((missing_count + 1))
        else
            add_success "Required variable set: $var_name"
        fi
    done
    
    if [[ $missing_count -eq 0 ]]; then
        add_success "All required environment variables are set"
    else
        add_error "$missing_count required environment variables are missing"
    fi
}

# Function to validate optional environment variables
validate_optional_vars() {
    echo -e "\n${BLUE}=== Validating Optional Environment Variables ===${NC}"
    
    local optional_vars=(
        "PROD_DB_PASSWORD:Database password (auto-generated if not provided)"
        "PROD_REDIS_PASSWORD:Redis password (auto-generated if not provided)"
        "PROD_JWT_SECRET:JWT signing secret (auto-generated if not provided)"
        "PROD_ADMIN_API_TOKEN:Admin API token (auto-generated if not provided)"
        "PROD_FEATURE_FLAG_TOKEN:Feature flag token (auto-generated if not provided)"
        "SMTP_PASSWORD:SMTP password (auto-generated if not provided)"
        "SMTP_FROM:SMTP from address (defaults to alerts@stapelwerk.com)"
        "SMTP_TO:SMTP to addresses (defaults to devops@stapelwerk.com)"
        "TLS_CERT_PATH:Path to TLS certificate file"
        "TLS_KEY_PATH:Path to TLS private key file"
        "DOCKER_REGISTRY:Container registry for images (defaults to gcr.io/stapelwerk-prod)"
        "BUILD_VERSION:Build version for deployment (defaults to latest)"
    )
    
    local set_count=0
    
    for var_info in "${optional_vars[@]}"; do
        local var_name="${var_info%%:*}"
        local var_desc="${var_info##*:}"
        
        if [[ -n "${!var_name:-}" ]]; then
            add_success "Optional variable set: $var_name"
            set_count=$((set_count + 1))
        else
            add_info "Optional variable not set: $var_name ($var_desc)"
        fi
    done
    
    add_info "$set_count of ${#optional_vars[@]} optional variables are set"
}

# Function to validate environment variable formats
validate_var_formats() {
    echo -e "\n${BLUE}=== Validating Environment Variable Formats ===${NC}"
    
    # Validate URLs
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        if [[ "$SLACK_WEBHOOK_URL" =~ ^https://hooks\.slack\.com/services/ ]]; then
            add_success "Slack webhook URL format is valid"
        else
            add_warning "Slack webhook URL format may be invalid (should start with https://hooks.slack.com/services/)"
        fi
    fi
    
    if [[ -n "${SENTRY_DSN:-}" ]]; then
        if [[ "$SENTRY_DSN" =~ ^https://[a-f0-9]+@[a-z0-9]+\.ingest\.sentry\.io/ ]]; then
            add_success "Sentry DSN format appears valid"
        else
            add_warning "Sentry DSN format may be invalid"
        fi
    fi
    
    # Validate database host format
    if [[ -n "${PROD_DB_HOST:-}" ]]; then
        if [[ "$PROD_DB_HOST" =~ ^[a-zA-Z0-9.-]+$ ]]; then
            add_success "Database host format is valid"
        else
            add_warning "Database host format may be invalid"
        fi
    fi
    
    # Validate Redis host format
    if [[ -n "${PROD_REDIS_HOST:-}" ]]; then
        if [[ "$PROD_REDIS_HOST" =~ ^[a-zA-Z0-9.-]+$ ]]; then
            add_success "Redis host format is valid"
        else
            add_warning "Redis host format may be invalid"
        fi
    fi
    
    # Validate SMTP host format
    if [[ -n "${SMTP_HOST:-}" ]]; then
        if [[ "$SMTP_HOST" =~ ^[a-zA-Z0-9.-]+$ ]]; then
            add_success "SMTP host format is valid"
        else
            add_warning "SMTP host format may be invalid"
        fi
    fi
    
    # Validate email addresses
    local email_regex="^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    
    if [[ -n "${SMTP_FROM:-}" ]]; then
        if [[ "$SMTP_FROM" =~ $email_regex ]]; then
            add_success "SMTP from address format is valid"
        else
            add_warning "SMTP from address format may be invalid"
        fi
    fi
    
    if [[ -n "${SMTP_TO:-}" ]]; then
        # Split by comma and validate each email
        IFS=',' read -ra emails <<< "$SMTP_TO"
        local valid_emails=true
        for email in "${emails[@]}"; do
            email=$(echo "$email" | xargs)  # trim whitespace
            if [[ ! "$email" =~ $email_regex ]]; then
                valid_emails=false
                break
            fi
        done
        
        if [[ "$valid_emails" == "true" ]]; then
            add_success "SMTP to addresses format is valid"
        else
            add_warning "One or more SMTP to addresses may be invalid"
        fi
    fi
}

# Function to validate API key formats
validate_api_keys() {
    echo -e "\n${BLUE}=== Validating API Key Formats ===${NC}"
    
    # Validate OpenAI API key
    if [[ -n "${OPENAI_API_KEY:-}" ]]; then
        if [[ "$OPENAI_API_KEY" =~ ^sk- ]]; then
            add_success "OpenAI API key format appears valid"
        else
            add_warning "OpenAI API key should start with 'sk-'"
        fi
        
        if [[ ${#OPENAI_API_KEY} -ge 48 ]]; then
            add_success "OpenAI API key length appears valid"
        else
            add_warning "OpenAI API key may be too short (should be 48+ characters)"
        fi
    fi
    
    # Validate Anthropic API key
    if [[ -n "${ANTHROPIC_API_KEY:-}" ]]; then
        if [[ "$ANTHROPIC_API_KEY" =~ ^sk-ant- ]]; then
            add_success "Anthropic API key format appears valid"
        else
            add_warning "Anthropic API key should start with 'sk-ant-'"
        fi
        
        if [[ ${#ANTHROPIC_API_KEY} -ge 80 ]]; then
            add_success "Anthropic API key length appears valid"
        else
            add_warning "Anthropic API key may be too short (should be 80+ characters)"
        fi
    fi
    
    # Validate JWT secret length
    if [[ -n "${PROD_JWT_SECRET:-}" ]]; then
        if [[ ${#PROD_JWT_SECRET} -ge 32 ]]; then
            add_success "JWT secret length is adequate (${#PROD_JWT_SECRET} characters)"
        else
            add_warning "JWT secret should be at least 32 characters long (current: ${#PROD_JWT_SECRET})"
        fi
    fi
}

# Function to validate TLS certificates
validate_tls_certificates() {
    echo -e "\n${BLUE}=== Validating TLS Certificates ===${NC}"
    
    local cert_path="${TLS_CERT_PATH:-}"
    local key_path="${TLS_KEY_PATH:-}"
    
    if [[ -n "$cert_path" && -n "$key_path" ]]; then
        if [[ -f "$cert_path" ]]; then
            add_success "TLS certificate file exists: $cert_path"
            
            # Validate certificate format
            if openssl x509 -in "$cert_path" -noout -text &>/dev/null; then
                add_success "TLS certificate format is valid"
                
                # Check certificate expiration
                local exp_date=$(openssl x509 -in "$cert_path" -noout -enddate | cut -d= -f2)
                local exp_timestamp=$(date -d "$exp_date" +%s 2>/dev/null || date -j -f "%b %d %T %Y %Z" "$exp_date" +%s 2>/dev/null || echo "0")
                local current_timestamp=$(date +%s)
                local days_until_expiry=$(( (exp_timestamp - current_timestamp) / 86400 ))
                
                if [[ $days_until_expiry -gt 30 ]]; then
                    add_success "TLS certificate expires in $days_until_expiry days"
                elif [[ $days_until_expiry -gt 0 ]]; then
                    add_warning "TLS certificate expires in $days_until_expiry days (consider renewal)"
                else
                    add_error "TLS certificate has expired"
                fi
            else
                add_error "TLS certificate format is invalid"
            fi
        else
            add_error "TLS certificate file not found: $cert_path"
        fi
        
        if [[ -f "$key_path" ]]; then
            add_success "TLS private key file exists: $key_path"
            
            # Validate key format
            if openssl rsa -in "$key_path" -noout -check &>/dev/null || openssl ec -in "$key_path" -noout -check &>/dev/null; then
                add_success "TLS private key format is valid"
            else
                add_error "TLS private key format is invalid"
            fi
        else
            add_error "TLS private key file not found: $key_path"
        fi
        
        # Check if certificate and key match
        if [[ -f "$cert_path" && -f "$key_path" ]]; then
            local cert_hash=$(openssl x509 -in "$cert_path" -pubkey -noout | openssl rsa -pubin -outform der | openssl dgst -sha256)
            local key_hash=$(openssl rsa -in "$key_path" -pubout -outform der | openssl dgst -sha256)
            
            if [[ "$cert_hash" == "$key_hash" ]]; then
                add_success "TLS certificate and private key match"
            else
                add_error "TLS certificate and private key do not match"
            fi
        fi
    else
        add_info "TLS certificate paths not provided - will use cluster default certificates"
    fi
}

# Function to validate Docker registry access
validate_docker_registry() {
    echo -e "\n${BLUE}=== Validating Docker Registry Access ===${NC}"
    
    local registry="${DOCKER_REGISTRY:-gcr.io/stapelwerk-prod}"
    
    add_info "Using Docker registry: $registry"
    
    if command -v docker &> /dev/null; then
        add_success "Docker command is available"
        
        # Test registry access (this may require authentication)
        if docker info &>/dev/null; then
            add_success "Docker daemon is running"
        else
            add_warning "Docker daemon may not be running or accessible"
        fi
    else
        add_warning "Docker command not found - registry access cannot be tested"
    fi
}

# Function to validate Kubernetes access
validate_kubernetes_access() {
    echo -e "\n${BLUE}=== Validating Kubernetes Access ===${NC}"
    
    if command -v kubectl &> /dev/null; then
        add_success "kubectl command is available"
        
        if kubectl cluster-info &> /dev/null; then
            add_success "Kubernetes cluster is accessible"
            
            # Check cluster version
            local k8s_version=$(kubectl version --short --client 2>/dev/null | grep "Client Version" | cut -d: -f2 | xargs)
            add_info "Kubernetes client version: $k8s_version"
            
            # Check if namespace exists
            local namespace="${KUBERNETES_NAMESPACE:-stapelwerk}"
            if kubectl get namespace "$namespace" &> /dev/null; then
                add_success "Target namespace '$namespace' exists"
            else
                add_info "Target namespace '$namespace' does not exist (will be created during deployment)"
            fi
        else
            add_error "Cannot connect to Kubernetes cluster - check kubeconfig"
        fi
    else
        add_error "kubectl command not found - please install kubectl"
    fi
}

# Function to validate external service connectivity
validate_external_services() {
    echo -e "\n${BLUE}=== Validating External Service Connectivity ===${NC}"
    
    # Test database connectivity
    if [[ -n "${PROD_DB_HOST:-}" ]]; then
        add_info "Testing database connectivity to ${PROD_DB_HOST}..."
        if command -v nc &> /dev/null; then
            if nc -z "${PROD_DB_HOST}" 5432 2>/dev/null; then
                add_success "Database host ${PROD_DB_HOST}:5432 is reachable"
            else
                add_warning "Database host ${PROD_DB_HOST}:5432 is not reachable (may be behind firewall)"
            fi
        else
            add_info "netcat (nc) not available - cannot test database connectivity"
        fi
    fi
    
    # Test Redis connectivity
    if [[ -n "${PROD_REDIS_HOST:-}" ]]; then
        add_info "Testing Redis connectivity to ${PROD_REDIS_HOST}..."
        if command -v nc &> /dev/null; then
            if nc -z "${PROD_REDIS_HOST}" 6379 2>/dev/null; then
                add_success "Redis host ${PROD_REDIS_HOST}:6379 is reachable"
            else
                add_warning "Redis host ${PROD_REDIS_HOST}:6379 is not reachable (may be behind firewall)"
            fi
        else
            add_info "netcat (nc) not available - cannot test Redis connectivity"
        fi
    fi
    
    # Test SMTP connectivity
    if [[ -n "${SMTP_HOST:-}" ]]; then
        add_info "Testing SMTP connectivity to ${SMTP_HOST}..."
        if command -v nc &> /dev/null; then
            if nc -z "${SMTP_HOST}" 587 2>/dev/null || nc -z "${SMTP_HOST}" 25 2>/dev/null; then
                add_success "SMTP host ${SMTP_HOST} is reachable"
            else
                add_warning "SMTP host ${SMTP_HOST} is not reachable on ports 25/587"
            fi
        else
            add_info "netcat (nc) not available - cannot test SMTP connectivity"
        fi
    fi
    
    # Test Slack webhook
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        add_info "Testing Slack webhook connectivity..."
        if command -v curl &> /dev/null; then
            if curl -s -o /dev/null -w "%{http_code}" -X POST \
                -H "Content-Type: application/json" \
                -d '{"text":"Production environment validation test"}' \
                "${SLACK_WEBHOOK_URL}" | grep -q "200\|400"; then
                add_success "Slack webhook is reachable"
            else
                add_warning "Slack webhook may not be reachable or valid"
            fi
        else
            add_info "curl not available - cannot test Slack webhook"
        fi
    fi
    
    # Test OpenAI API
    if [[ -n "${OPENAI_API_KEY:-}" ]]; then
        add_info "Testing OpenAI API connectivity..."
        if command -v curl &> /dev/null; then
            local response=$(curl -s -w "%{http_code}" -o /dev/null \
                -H "Authorization: Bearer ${OPENAI_API_KEY}" \
                "https://api.openai.com/v1/models")
            
            if [[ "$response" == "200" ]]; then
                add_success "OpenAI API key is valid and service is reachable"
            elif [[ "$response" == "401" ]]; then
                add_error "OpenAI API key is invalid"
            else
                add_warning "OpenAI API service may not be reachable (HTTP $response)"
            fi
        else
            add_info "curl not available - cannot test OpenAI API"
        fi
    fi
}

# Function to generate validation report
generate_report() {
    echo -e "\n${BLUE}=== VALIDATION REPORT ===${NC}"
    
    local total_errors=${#VALIDATION_ERRORS[@]}
    local total_warnings=${#VALIDATION_WARNINGS[@]}
    local total_info=${#VALIDATION_INFO[@]}
    
    echo -e "\nSummary:"
    echo -e "  ${RED}Errors: $total_errors${NC}"
    echo -e "  ${YELLOW}Warnings: $total_warnings${NC}"
    echo -e "  ${BLUE}Info messages: $total_info${NC}"
    
    if [[ $total_errors -gt 0 ]]; then
        echo -e "\n${RED}ERRORS that must be fixed:${NC}"
        for error in "${VALIDATION_ERRORS[@]}"; do
            echo -e "  ${RED}✗ $error${NC}"
        done
    fi
    
    if [[ $total_warnings -gt 0 ]]; then
        echo -e "\n${YELLOW}WARNINGS (recommended to fix):${NC}"
        for warning in "${VALIDATION_WARNINGS[@]}"; do
            echo -e "  ${YELLOW}⚠ $warning${NC}"
        done
    fi
    
    echo -e "\n${BLUE}Deployment Readiness:${NC}"
    if [[ $total_errors -eq 0 ]]; then
        echo -e "  ${GREEN}✓ Ready for production deployment${NC}"
        echo -e "  ${GREEN}✓ All critical requirements are met${NC}"
        
        if [[ $total_warnings -gt 0 ]]; then
            echo -e "  ${YELLOW}⚠ Consider addressing warnings for optimal deployment${NC}"
        fi
        
        return 0
    else
        echo -e "  ${RED}✗ NOT ready for production deployment${NC}"
        echo -e "  ${RED}✗ $total_errors critical issues must be resolved${NC}"
        return 1
    fi
}

# Function to show usage
show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

This script validates the production environment configuration for Stapelwerk AI Recommendations.

Options:
  --skip-connectivity    Skip external service connectivity tests
  --skip-tls             Skip TLS certificate validation
  --skip-docker          Skip Docker registry validation
  --skip-k8s             Skip Kubernetes validation
  --quiet                Only show errors and warnings
  --help                 Show this help message

Examples:
  $0                             # Run full validation
  $0 --skip-connectivity         # Skip network connectivity tests
  $0 --quiet                     # Show only errors and warnings

Environment Variables:
  Set the required environment variables before running this script.
  See the production environment template for a complete list.

EOF
}

# Main function
main() {
    local skip_connectivity=false
    local skip_tls=false
    local skip_docker=false
    local skip_k8s=false
    local quiet=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-connectivity)
                skip_connectivity=true
                shift
                ;;
            --skip-tls)
                skip_tls=true
                shift
                ;;
            --skip-docker)
                skip_docker=true
                shift
                ;;
            --skip-k8s)
                skip_k8s=true
                shift
                ;;
            --quiet)
                quiet=true
                shift
                ;;
            --help)
                show_usage
                exit 0
                ;;
            *)
                echo "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
    
    echo -e "${BLUE}Stapelwerk AI Recommendations - Production Environment Validation${NC}"
    echo -e "${BLUE}=================================================================${NC}"
    
    # Run validations
    validate_required_vars
    
    if [[ "$quiet" != "true" ]]; then
        validate_optional_vars
    fi
    
    validate_var_formats
    validate_api_keys
    
    if [[ "$skip_tls" != "true" ]]; then
        validate_tls_certificates
    fi
    
    if [[ "$skip_docker" != "true" ]]; then
        validate_docker_registry
    fi
    
    if [[ "$skip_k8s" != "true" ]]; then
        validate_kubernetes_access
    fi
    
    if [[ "$skip_connectivity" != "true" ]]; then
        validate_external_services
    fi
    
    # Generate final report
    if generate_report; then
        exit 0
    else
        exit 1
    fi
}

# Run main function with all arguments
main "$@"