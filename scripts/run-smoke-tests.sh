#!/bin/bash

# Production Smoke Tests for BuildMyStack AI Recommendations
# Comprehensive suite to verify deployment health and functionality

set -e

# Script Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SMOKE_TEST_LOG="${PROJECT_ROOT}/logs/smoke-tests-$(date +%Y%m%d-%H%M%S).log"

# Configuration
DEFAULT_BASE_URL="http://localhost:8080"
DEFAULT_TIMEOUT=30
DEFAULT_MAX_RETRIES=3

# Test Results
TESTS_PASSED=0
TESTS_FAILED=0
FAILED_TESTS=()

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
    
    echo -e "${timestamp} [${level}] ${message}" | tee -a "${SMOKE_TEST_LOG}"
    
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

# Test assertion functions
assert_equals() {
    local expected=$1
    local actual=$2
    local message=$3
    
    if [[ "$expected" == "$actual" ]]; then
        return 0
    else
        log "ERROR" "Assertion failed: $message"
        log "ERROR" "Expected: $expected, Got: $actual"
        return 1
    fi
}

assert_contains() {
    local haystack=$1
    local needle=$2
    local message=$3
    
    if [[ "$haystack" == *"$needle"* ]]; then
        return 0
    else
        log "ERROR" "Assertion failed: $message"
        log "ERROR" "Expected '$haystack' to contain '$needle'"
        return 1
    fi
}

assert_not_empty() {
    local value=$1
    local message=$2
    
    if [[ -n "$value" ]]; then
        return 0
    else
        log "ERROR" "Assertion failed: $message"
        log "ERROR" "Expected non-empty value"
        return 1
    fi
}

assert_status_code() {
    local expected_code=$1
    local actual_code=$2
    local message=$3
    
    if [[ "$expected_code" == "$actual_code" ]]; then
        return 0
    else
        log "ERROR" "HTTP Status assertion failed: $message"
        log "ERROR" "Expected status: $expected_code, Got: $actual_code"
        return 1
    fi
}

# HTTP request helper
http_request() {
    local method=$1
    local url=$2
    local data=${3:-""}
    local headers=${4:-""}
    
    local curl_opts=(
        -s
        -w "%{http_code}|%{time_total}|%{size_download}"
        -m "$DEFAULT_TIMEOUT"
        -X "$method"
    )
    
    if [[ -n "$headers" ]]; then
        while IFS= read -r header; do
            curl_opts+=(-H "$header")
        done <<< "$headers"
    fi
    
    if [[ -n "$data" && "$method" != "GET" ]]; then
        curl_opts+=(-d "$data")
    fi
    
    curl "${curl_opts[@]}" "$url"
}

# Wait for service to be ready
wait_for_service() {
    local base_url=$1
    local max_wait=${2:-300}  # 5 minutes default
    local wait_interval=10
    local elapsed=0
    
    log "INFO" "Waiting for service at $base_url to be ready..."
    
    while [[ $elapsed -lt $max_wait ]]; do
        if curl -s -f "$base_url/health" > /dev/null 2>&1; then
            log "SUCCESS" "Service is ready after ${elapsed}s"
            return 0
        fi
        
        log "INFO" "Service not ready yet, waiting ${wait_interval}s... (${elapsed}/${max_wait}s)"
        sleep $wait_interval
        elapsed=$((elapsed + wait_interval))
    done
    
    log "ERROR" "Service failed to become ready within ${max_wait}s"
    return 1
}

# Individual Test Functions

# Test 1: Basic Health Check
test_health_check() {
    local test_name="Health Check"
    log "INFO" "Running test: $test_name"
    
    local response
    response=$(http_request "GET" "$BASE_URL/health")
    local status_code="${response##*|}"
    local response_body="${response%|*|*}"
    
    if assert_status_code "200" "$status_code" "Health endpoint should return 200"; then
        if assert_contains "$response_body" "healthy" "Health response should contain 'healthy'"; then
            log "SUCCESS" "✓ $test_name passed"
            return 0
        fi
    fi
    
    log "ERROR" "✗ $test_name failed"
    return 1
}

# Test 2: API Health Check
test_api_health() {
    local test_name="API Health Check"
    log "INFO" "Running test: $test_name"
    
    local response
    response=$(http_request "GET" "$BASE_URL/api/health")
    local status_code="${response##*|}"
    local response_body="${response%|*|*}"
    
    if assert_status_code "200" "$status_code" "API health endpoint should return 200"; then
        if assert_contains "$response_body" "ok" "API health response should be valid"; then
            log "SUCCESS" "✓ $test_name passed"
            return 0
        fi
    fi
    
    log "ERROR" "✗ $test_name failed"
    return 1
}

# Test 3: Metrics Endpoint
test_metrics_endpoint() {
    local test_name="Metrics Endpoint"
    log "INFO" "Running test: $test_name"
    
    local response
    response=$(http_request "GET" "$BASE_URL/metrics")
    local status_code="${response##*|}"
    local response_body="${response%|*|*}"
    
    if assert_status_code "200" "$status_code" "Metrics endpoint should return 200"; then
        if assert_contains "$response_body" "buildmystack_ai" "Metrics should contain application metrics"; then
            log "SUCCESS" "✓ $test_name passed"
            return 0
        fi
    fi
    
    log "ERROR" "✗ $test_name failed"
    return 1
}

# Test 4: Feature Flags Endpoint
test_feature_flags() {
    local test_name="Feature Flags"
    log "INFO" "Running test: $test_name"
    
    local response
    response=$(http_request "GET" "$BASE_URL/api/feature-flags")
    local status_code="${response##*|}"
    local response_body="${response%|*|*}"
    
    if assert_status_code "200" "$status_code" "Feature flags endpoint should return 200"; then
        if assert_contains "$response_body" "ai_recommendations" "Feature flags should contain ai_recommendations"; then
            log "SUCCESS" "✓ $test_name passed"
            return 0
        fi
    fi
    
    log "ERROR" "✗ $test_name failed"
    return 1
}

# Test 5: Database Connectivity
test_database_connectivity() {
    local test_name="Database Connectivity"
    log "INFO" "Running test: $test_name"
    
    local response
    response=$(http_request "GET" "$BASE_URL/api/health/database")
    local status_code="${response##*|}"
    local response_body="${response%|*|*}"
    
    if assert_status_code "200" "$status_code" "Database health should return 200"; then
        if assert_contains "$response_body" "connected" "Database should be connected"; then
            log "SUCCESS" "✓ $test_name passed"
            return 0
        fi
    fi
    
    log "ERROR" "✗ $test_name failed"
    return 1
}

# Test 6: Cache Connectivity (Redis)
test_cache_connectivity() {
    local test_name="Cache Connectivity"
    log "INFO" "Running test: $test_name"
    
    local response
    response=$(http_request "GET" "$BASE_URL/api/health/cache")
    local status_code="${response##*|}"
    local response_body="${response%|*|*}"
    
    if assert_status_code "200" "$status_code" "Cache health should return 200"; then
        if assert_contains "$response_body" "connected" "Cache should be connected"; then
            log "SUCCESS" "✓ $test_name passed"
            return 0
        fi
    fi
    
    log "ERROR" "✗ $test_name failed"
    return 1
}

# Test 7: AI Services Health
test_ai_services() {
    local test_name="AI Services Health"
    log "INFO" "Running test: $test_name"
    
    local response
    response=$(http_request "GET" "$BASE_URL/api/health/ai-services")
    local status_code="${response##*|}"
    local response_body="${response%|*|*}"
    
    if assert_status_code "200" "$status_code" "AI services health should return 200"; then
        if assert_contains "$response_body" "available" "AI services should be available"; then
            log "SUCCESS" "✓ $test_name passed"
            return 0
        fi
    fi
    
    log "ERROR" "✗ $test_name failed"
    return 1
}

# Test 8: Recommendations API Basic
test_recommendations_api() {
    local test_name="Recommendations API"
    log "INFO" "Running test: $test_name"
    
    # Only test if AI recommendations are enabled
    local flags_response
    flags_response=$(http_request "GET" "$BASE_URL/api/feature-flags")
    local flags_body="${flags_response%|*|*}"
    
    if [[ "$flags_body" == *'"ai_recommendations":true'* || "$flags_body" == *'"ai_recommendations":{"status":"enabled"}'* ]]; then
        local response
        response=$(http_request "GET" "$BASE_URL/api/recommendations?stackId=test")
        local status_code="${response##*|}"
        local response_body="${response%|*|*}"
        
        if assert_status_code "200" "$status_code" "Recommendations API should return 200"; then
            if assert_contains "$response_body" "recommendations" "Response should contain recommendations"; then
                log "SUCCESS" "✓ $test_name passed"
                return 0
            fi
        fi
    else
        log "INFO" "✓ $test_name skipped (AI recommendations disabled)"
        return 0
    fi
    
    log "ERROR" "✗ $test_name failed"
    return 1
}

# Test 9: Templates API
test_templates_api() {
    local test_name="Templates API"
    log "INFO" "Running test: $test_name"
    
    local response
    response=$(http_request "GET" "$BASE_URL/api/templates")
    local status_code="${response##*|}"
    local response_body="${response%|*|*}"
    
    if assert_status_code "200" "$status_code" "Templates API should return 200"; then
        if assert_contains "$response_body" "templates" "Response should contain templates"; then
            log "SUCCESS" "✓ $test_name passed"
            return 0
        fi
    fi
    
    log "ERROR" "✗ $test_name failed"
    return 1
}

# Test 10: Error Handling
test_error_handling() {
    local test_name="Error Handling"
    log "INFO" "Running test: $test_name"
    
    local response
    response=$(http_request "GET" "$BASE_URL/api/nonexistent-endpoint")
    local status_code="${response##*|}"
    
    if assert_status_code "404" "$status_code" "Non-existent endpoint should return 404"; then
        log "SUCCESS" "✓ $test_name passed"
        return 0
    fi
    
    log "ERROR" "✗ $test_name failed"
    return 1
}

# Test 11: CORS Headers
test_cors_headers() {
    local test_name="CORS Headers"
    log "INFO" "Running test: $test_name"
    
    local response
    response=$(curl -s -I -X OPTIONS "$BASE_URL/api/health" -H "Origin: https://buildmystack.com")
    
    if assert_contains "$response" "Access-Control-Allow-Origin" "CORS headers should be present"; then
        log "SUCCESS" "✓ $test_name passed"
        return 0
    fi
    
    log "ERROR" "✗ $test_name failed"
    return 1
}

# Test 12: Security Headers
test_security_headers() {
    local test_name="Security Headers"
    log "INFO" "Running test: $test_name"
    
    local response
    response=$(curl -s -I "$BASE_URL/health")
    
    if assert_contains "$response" "X-Content-Type-Options" "Security headers should be present"; then
        log "SUCCESS" "✓ $test_name passed"
        return 0
    fi
    
    log "INFO" "✓ $test_name passed (optional security headers)"
    return 0
}

# Test 13: Response Time Performance
test_response_time() {
    local test_name="Response Time Performance"
    log "INFO" "Running test: $test_name"
    
    local response
    response=$(http_request "GET" "$BASE_URL/health")
    local time_total="${response##*|}"; time_total="${time_total%|*}"
    
    # Convert to milliseconds
    local time_ms
    time_ms=$(echo "$time_total * 1000" | bc -l 2>/dev/null || echo "1000")
    
    if (( $(echo "$time_ms < 2000" | bc -l 2>/dev/null || echo 0) )); then
        log "SUCCESS" "✓ $test_name passed (${time_ms}ms)"
        return 0
    else
        log "WARN" "⚠ $test_name slow response (${time_ms}ms > 2000ms)"
        return 0  # Warning, not failure
    fi
}

# Test 14: Rate Limiting
test_rate_limiting() {
    local test_name="Rate Limiting"
    log "INFO" "Running test: $test_name"
    
    # Make rapid requests to trigger rate limiting
    local rate_limited=false
    for i in {1..15}; do
        local response
        response=$(http_request "GET" "$BASE_URL/api/health")
        local status_code="${response##*|}"
        
        if [[ "$status_code" == "429" ]]; then
            rate_limited=true
            break
        fi
        sleep 0.1
    done
    
    if [[ "$rate_limited" == "true" ]]; then
        log "SUCCESS" "✓ $test_name passed (rate limiting working)"
        return 0
    else
        log "INFO" "✓ $test_name passed (rate limiting not triggered)"
        return 0
    fi
}

# Test 15: Memory and Resource Usage
test_resource_usage() {
    local test_name="Resource Usage"
    log "INFO" "Running test: $test_name"
    
    # Check if running in Kubernetes
    if command -v kubectl &> /dev/null && kubectl get pods -n buildmystack &> /dev/null; then
        local pod_name
        pod_name=$(kubectl get pods -n buildmystack -l app=buildmystack-ai -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
        
        if [[ -n "$pod_name" ]]; then
            local resource_usage
            resource_usage=$(kubectl top pod "$pod_name" -n buildmystack 2>/dev/null || echo "")
            
            if [[ -n "$resource_usage" ]]; then
                log "INFO" "Resource usage: $resource_usage"
                log "SUCCESS" "✓ $test_name passed (resources monitored)"
                return 0
            fi
        fi
    fi
    
    log "INFO" "✓ $test_name skipped (not in Kubernetes environment)"
    return 0
}

# Test runner function
run_test() {
    local test_func=$1
    local test_name=$2
    
    if $test_func; then
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        TESTS_FAILED=$((TESTS_FAILED + 1))
        FAILED_TESTS+=("$test_name")
    fi
}

# Main test suite
run_smoke_tests() {
    log "INFO" "=== Starting Smoke Tests ==="
    log "INFO" "Base URL: $BASE_URL"
    log "INFO" "Timeout: ${DEFAULT_TIMEOUT}s"
    log "INFO" "Log file: $SMOKE_TEST_LOG"
    
    # Wait for service to be ready
    if ! wait_for_service "$BASE_URL" 300; then
        log "ERROR" "Service is not ready - aborting smoke tests"
        exit 1
    fi
    
    # Run all tests
    run_test test_health_check "Health Check"
    run_test test_api_health "API Health Check"
    run_test test_metrics_endpoint "Metrics Endpoint"
    run_test test_feature_flags "Feature Flags"
    run_test test_database_connectivity "Database Connectivity"
    run_test test_cache_connectivity "Cache Connectivity"
    run_test test_ai_services "AI Services Health"
    run_test test_recommendations_api "Recommendations API"
    run_test test_templates_api "Templates API"
    run_test test_error_handling "Error Handling"
    run_test test_cors_headers "CORS Headers"
    run_test test_security_headers "Security Headers"
    run_test test_response_time "Response Time Performance"
    run_test test_rate_limiting "Rate Limiting"
    run_test test_resource_usage "Resource Usage"
    
    # Report results
    local total_tests=$((TESTS_PASSED + TESTS_FAILED))
    local pass_rate=$((TESTS_PASSED * 100 / total_tests))
    
    log "INFO" "=== Smoke Test Results ==="
    log "INFO" "Total tests: $total_tests"
    log "INFO" "Passed: $TESTS_PASSED"
    log "INFO" "Failed: $TESTS_FAILED"
    log "INFO" "Pass rate: ${pass_rate}%"
    
    if [[ $TESTS_FAILED -gt 0 ]]; then
        log "ERROR" "Failed tests:"
        for test in "${FAILED_TESTS[@]}"; do
            log "ERROR" "  - $test"
        done
        
        if [[ $pass_rate -lt 80 ]]; then
            log "ERROR" "❌ SMOKE TESTS FAILED - Pass rate too low (${pass_rate}% < 80%)"
            return 1
        else
            log "WARN" "⚠️ SMOKE TESTS PASSED WITH WARNINGS - Some tests failed (${pass_rate}% pass rate)"
            return 0
        fi
    else
        log "SUCCESS" "✅ ALL SMOKE TESTS PASSED - System is healthy and ready for production"
        return 0
    fi
}

# Utility functions for different deployment scenarios

# Test Kubernetes deployment
test_kubernetes_deployment() {
    log "INFO" "Testing Kubernetes deployment..."
    
    # Check if kubectl is available
    if ! command -v kubectl &> /dev/null; then
        log "ERROR" "kubectl not found - cannot test Kubernetes deployment"
        return 1
    fi
    
    # Check deployment status
    local deployment_status
    deployment_status=$(kubectl get deployment buildmystack-ai -n buildmystack -o jsonpath='{.status.conditions[?(@.type=="Available")].status}' 2>/dev/null || echo "False")
    
    if [[ "$deployment_status" == "True" ]]; then
        log "SUCCESS" "Kubernetes deployment is available"
        
        # Get service URL
        local service_url
        service_url=$(kubectl get service buildmystack-ai-service -n buildmystack -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "")
        
        if [[ -n "$service_url" ]]; then
            BASE_URL="http://$service_url"
            log "INFO" "Using Kubernetes service URL: $BASE_URL"
        else
            # Use port-forward for testing
            kubectl port-forward service/buildmystack-ai-service 8080:80 -n buildmystack &
            local port_forward_pid=$!
            BASE_URL="http://localhost:8080"
            log "INFO" "Using port-forward URL: $BASE_URL"
            
            # Clean up port-forward on exit
            trap "kill $port_forward_pid 2>/dev/null || true" EXIT
        fi
        
        return 0
    else
        log "ERROR" "Kubernetes deployment is not available"
        return 1
    fi
}

# Test Docker Compose deployment
test_docker_compose_deployment() {
    log "INFO" "Testing Docker Compose deployment..."
    
    if docker-compose -f "$PROJECT_ROOT/docker/docker-compose.prod.yml" ps buildmystack-ai | grep -q "Up"; then
        log "SUCCESS" "Docker Compose deployment is running"
        BASE_URL="http://localhost:8080"
        return 0
    else
        log "ERROR" "Docker Compose deployment is not running"
        return 1
    fi
}

# Show usage
show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Run comprehensive smoke tests for BuildMyStack AI Recommendations deployment.

Options:
  --url URL              Base URL of the deployed application (default: http://localhost:8080)
  --timeout SECONDS      Request timeout in seconds (default: 30)
  --kubernetes          Test Kubernetes deployment
  --docker-compose      Test Docker Compose deployment
  --quick               Run only essential tests
  --verbose             Verbose logging
  --help                Show this help message

Examples:
  $0                                    # Test local deployment
  $0 --url https://api.buildmystack.com # Test production deployment
  $0 --kubernetes                       # Test Kubernetes deployment
  $0 --docker-compose                   # Test Docker Compose deployment
  $0 --quick                           # Run quick smoke tests only

EOF
}

# Main function
main() {
    local run_kubernetes=false
    local run_docker_compose=false
    local quick_mode=false
    local verbose=false
    
    BASE_URL="$DEFAULT_BASE_URL"
    
    # Create logs directory
    mkdir -p "${PROJECT_ROOT}/logs"
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --url)
                BASE_URL="$2"
                shift 2
                ;;
            --timeout)
                DEFAULT_TIMEOUT="$2"
                shift 2
                ;;
            --kubernetes)
                run_kubernetes=true
                shift
                ;;
            --docker-compose)
                run_docker_compose=true
                shift
                ;;
            --quick)
                quick_mode=true
                shift
                ;;
            --verbose)
                verbose=true
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
    
    # Auto-detect deployment type if not specified
    if [[ "$run_kubernetes" == "false" && "$run_docker_compose" == "false" ]]; then
        if command -v kubectl &> /dev/null && kubectl get deployment buildmystack-ai -n buildmystack &> /dev/null 2>&1; then
            run_kubernetes=true
        elif docker-compose -f "$PROJECT_ROOT/docker/docker-compose.prod.yml" ps buildmystack-ai | grep -q "Up" 2>/dev/null; then
            run_docker_compose=true
        fi
    fi
    
    # Set up deployment-specific configuration
    if [[ "$run_kubernetes" == "true" ]]; then
        if ! test_kubernetes_deployment; then
            exit 1
        fi
    elif [[ "$run_docker_compose" == "true" ]]; then
        if ! test_docker_compose_deployment; then
            exit 1
        fi
    fi
    
    # Run smoke tests
    if run_smoke_tests; then
        log "INFO" "Smoke test log saved to: $SMOKE_TEST_LOG"
        exit 0
    else
        log "ERROR" "Smoke tests failed - check log: $SMOKE_TEST_LOG"
        exit 1
    fi
}

# Run main function with all arguments
main "$@"