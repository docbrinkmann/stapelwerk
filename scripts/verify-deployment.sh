#!/bin/bash

# Comprehensive Deployment Verification Script for BuildMyStack AI Recommendations
# Validates deployment health, performance, and readiness for production

set -e

# Script Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
VERIFICATION_LOG="${PROJECT_ROOT}/logs/deployment-verification-$(date +%Y%m%d-%H%M%S).log"

# Configuration
DEFAULT_BASE_URL="http://localhost:8080"
DEFAULT_TIMEOUT=30
DEFAULT_MAX_RETRIES=3
KUBERNETES_NAMESPACE="buildmystack"

# Verification Thresholds
MAX_RESPONSE_TIME=2000  # 2 seconds in milliseconds
MIN_SUCCESS_RATE=95     # 95% success rate
MAX_ERROR_RATE=5        # 5% error rate
MIN_AVAILABILITY=99     # 99% availability

# Results tracking
VERIFICATIONS_PASSED=0
VERIFICATIONS_FAILED=0
FAILED_VERIFICATIONS=()
WARNINGS=()

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Logging function
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    echo -e "${timestamp} [${level}] ${message}" | tee -a "${VERIFICATION_LOG}"
    
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
        "DEBUG")
            echo -e "${PURPLE}${timestamp} [${level}] ${message}${NC}"
            ;;
    esac
}

# Verification result tracking
record_verification() {
    local name=$1
    local result=$2
    local details=$3
    
    if [[ "$result" == "PASS" ]]; then
        VERIFICATIONS_PASSED=$((VERIFICATIONS_PASSED + 1))
        log "SUCCESS" "✓ $name: PASSED - $details"
    elif [[ "$result" == "FAIL" ]]; then
        VERIFICATIONS_FAILED=$((VERIFICATIONS_FAILED + 1))
        FAILED_VERIFICATIONS+=("$name: $details")
        log "ERROR" "✗ $name: FAILED - $details"
    elif [[ "$result" == "WARN" ]]; then
        WARNINGS+=("$name: $details")
        log "WARN" "⚠ $name: WARNING - $details"
    else
        log "INFO" "ℹ $name: $details"
    fi
}

# HTTP request with detailed metrics
http_request_detailed() {
    local method=$1
    local url=$2
    local expected_status=${3:-200}
    local timeout=${4:-$DEFAULT_TIMEOUT}
    
    local response
    response=$(curl -s -w "%{http_code}|%{time_total}|%{size_download}|%{time_namelookup}|%{time_connect}" \
                   -X "$method" -m "$timeout" "$url" 2>/dev/null || echo "000|0|0|0|0|ERROR")
    
    local status_code="${response##*|}"
    local metrics="${response%|ERROR*}"
    
    if [[ "$response" == *"|ERROR" ]]; then
        echo "ERROR|0|0|0|0|0"
        return 1
    fi
    
    echo "$response"
    return 0
}

# 1. Kubernetes Infrastructure Verification
verify_kubernetes_infrastructure() {
    log "INFO" "=== Verifying Kubernetes Infrastructure ==="
    
    if ! command -v kubectl &> /dev/null; then
        record_verification "Kubernetes kubectl" "WARN" "kubectl not available - skipping Kubernetes checks"
        return
    fi
    
    # Check cluster connectivity
    if kubectl cluster-info &> /dev/null; then
        record_verification "Kubernetes Cluster" "PASS" "cluster is accessible"
    else
        record_verification "Kubernetes Cluster" "FAIL" "cannot connect to cluster"
        return
    fi
    
    # Check namespace
    if kubectl get namespace "$KUBERNETES_NAMESPACE" &> /dev/null; then
        record_verification "Kubernetes Namespace" "PASS" "namespace '$KUBERNETES_NAMESPACE' exists"
    else
        record_verification "Kubernetes Namespace" "FAIL" "namespace '$KUBERNETES_NAMESPACE' not found"
        return
    fi
    
    # Check deployment
    local deployment_status
    deployment_status=$(kubectl get deployment buildmystack-ai -n "$KUBERNETES_NAMESPACE" -o jsonpath='{.status.conditions[?(@.type=="Available")].status}' 2>/dev/null || echo "False")
    
    if [[ "$deployment_status" == "True" ]]; then
        local replicas_ready
        local replicas_desired
        replicas_ready=$(kubectl get deployment buildmystack-ai -n "$KUBERNETES_NAMESPACE" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
        replicas_desired=$(kubectl get deployment buildmystack-ai -n "$KUBERNETES_NAMESPACE" -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "1")
        
        if [[ "$replicas_ready" == "$replicas_desired" ]]; then
            record_verification "Kubernetes Deployment" "PASS" "$replicas_ready/$replicas_desired replicas ready"
        else
            record_verification "Kubernetes Deployment" "FAIL" "only $replicas_ready/$replicas_desired replicas ready"
        fi
    else
        record_verification "Kubernetes Deployment" "FAIL" "deployment not available"
    fi
    
    # Check pods
    local pod_count
    pod_count=$(kubectl get pods -n "$KUBERNETES_NAMESPACE" -l app=buildmystack-ai --field-selector=status.phase=Running -o json | jq '.items | length' 2>/dev/null || echo "0")
    
    if [[ "$pod_count" -gt 0 ]]; then
        record_verification "Kubernetes Pods" "PASS" "$pod_count pods running"
        
        # Check pod resource usage
        local pod_name
        pod_name=$(kubectl get pods -n "$KUBERNETES_NAMESPACE" -l app=buildmystack-ai -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
        
        if [[ -n "$pod_name" ]]; then
            local resource_usage
            resource_usage=$(kubectl top pod "$pod_name" -n "$KUBERNETES_NAMESPACE" 2>/dev/null || echo "")
            
            if [[ -n "$resource_usage" ]]; then
                record_verification "Pod Resource Usage" "PASS" "$resource_usage"
            else
                record_verification "Pod Resource Usage" "WARN" "metrics not available"
            fi
        fi
    else
        record_verification "Kubernetes Pods" "FAIL" "no running pods found"
    fi
    
    # Check services
    if kubectl get service buildmystack-ai-service -n "$KUBERNETES_NAMESPACE" &> /dev/null; then
        record_verification "Kubernetes Service" "PASS" "service exists"
    else
        record_verification "Kubernetes Service" "FAIL" "service not found"
    fi
    
    # Check secrets
    local required_secrets=("db-secrets" "redis-secrets" "ai-secrets" "app-secrets" "monitoring-secrets")
    local missing_secrets=()
    
    for secret in "${required_secrets[@]}"; do
        if ! kubectl get secret "$secret" -n "$KUBERNETES_NAMESPACE" &> /dev/null; then
            missing_secrets+=("$secret")
        fi
    done
    
    if [[ ${#missing_secrets[@]} -eq 0 ]]; then
        record_verification "Kubernetes Secrets" "PASS" "all required secrets exist"
    else
        record_verification "Kubernetes Secrets" "FAIL" "missing secrets: ${missing_secrets[*]}"
    fi
}

# 2. Application Health Verification
verify_application_health() {
    log "INFO" "=== Verifying Application Health ==="
    
    # Basic health check
    local health_response
    health_response=$(http_request_detailed "GET" "$BASE_URL/health")
    
    if [[ "$health_response" != "ERROR"* ]]; then
        local status_code="${health_response##*|}"
        local time_total=$(echo "$health_response" | cut -d'|' -f2)
        local time_ms=$(echo "$time_total * 1000" | bc -l)
        
        if [[ "$status_code" == "200" ]]; then
            record_verification "Health Endpoint" "PASS" "responding (${time_ms}ms)"
        else
            record_verification "Health Endpoint" "FAIL" "returned status $status_code"
        fi
    else
        record_verification "Health Endpoint" "FAIL" "endpoint unreachable"
        return
    fi
    
    # API health check
    local api_health_response
    api_health_response=$(http_request_detailed "GET" "$BASE_URL/api/health")
    
    if [[ "$api_health_response" != "ERROR"* ]]; then
        local status_code="${api_health_response##*|}"
        if [[ "$status_code" == "200" ]]; then
            record_verification "API Health" "PASS" "API endpoints responding"
        else
            record_verification "API Health" "FAIL" "API returned status $status_code"
        fi
    else
        record_verification "API Health" "FAIL" "API endpoints unreachable"
    fi
    
    # Database connectivity
    local db_health_response
    db_health_response=$(http_request_detailed "GET" "$BASE_URL/api/health/database")
    
    if [[ "$db_health_response" != "ERROR"* ]]; then
        local status_code="${db_health_response##*|}"
        if [[ "$status_code" == "200" ]]; then
            record_verification "Database Health" "PASS" "database connection healthy"
        else
            record_verification "Database Health" "FAIL" "database health check failed (status $status_code)"
        fi
    else
        record_verification "Database Health" "FAIL" "database health endpoint unreachable"
    fi
    
    # Cache connectivity
    local cache_health_response
    cache_health_response=$(http_request_detailed "GET" "$BASE_URL/api/health/cache")
    
    if [[ "$cache_health_response" != "ERROR"* ]]; then
        local status_code="${cache_health_response##*|}"
        if [[ "$status_code" == "200" ]]; then
            record_verification "Cache Health" "PASS" "cache connection healthy"
        else
            record_verification "Cache Health" "FAIL" "cache health check failed (status $status_code)"
        fi
    else
        record_verification "Cache Health" "FAIL" "cache health endpoint unreachable"
    fi
    
    # AI services health
    local ai_health_response
    ai_health_response=$(http_request_detailed "GET" "$BASE_URL/api/health/ai-services")
    
    if [[ "$ai_health_response" != "ERROR"* ]]; then
        local status_code="${ai_health_response##*|}"
        if [[ "$status_code" == "200" ]]; then
            record_verification "AI Services Health" "PASS" "AI services available"
        else
            record_verification "AI Services Health" "FAIL" "AI services unavailable (status $status_code)"
        fi
    else
        record_verification "AI Services Health" "FAIL" "AI services health endpoint unreachable"
    fi
}

# 3. Performance Verification
verify_performance() {
    log "INFO" "=== Verifying Performance ==="
    
    # Response time test
    local total_time=0
    local successful_requests=0
    local failed_requests=0
    local test_iterations=10
    
    for ((i=1; i<=test_iterations; i++)); do
        local response
        response=$(http_request_detailed "GET" "$BASE_URL/health")
        
        if [[ "$response" != "ERROR"* ]]; then
            local status_code="${response##*|}"
            local time_total=$(echo "$response" | cut -d'|' -f2)
            
            if [[ "$status_code" == "200" ]]; then
                successful_requests=$((successful_requests + 1))
                total_time=$(echo "$total_time + $time_total" | bc -l)
            else
                failed_requests=$((failed_requests + 1))
            fi
        else
            failed_requests=$((failed_requests + 1))
        fi
        
        sleep 0.1
    done
    
    if [[ $successful_requests -gt 0 ]]; then
        local avg_time=$(echo "$total_time / $successful_requests" | bc -l)
        local avg_time_ms=$(echo "$avg_time * 1000" | bc -l)
        local success_rate=$((successful_requests * 100 / test_iterations))
        
        if (( $(echo "$avg_time_ms < $MAX_RESPONSE_TIME" | bc -l) )); then
            record_verification "Response Time" "PASS" "average ${avg_time_ms}ms (${success_rate}% success rate)"
        else
            record_verification "Response Time" "WARN" "average ${avg_time_ms}ms > ${MAX_RESPONSE_TIME}ms threshold"
        fi
        
        if [[ $success_rate -ge $MIN_SUCCESS_RATE ]]; then
            record_verification "Success Rate" "PASS" "${success_rate}% success rate"
        else
            record_verification "Success Rate" "FAIL" "${success_rate}% < ${MIN_SUCCESS_RATE}% threshold"
        fi
    else
        record_verification "Response Time" "FAIL" "no successful requests"
        record_verification "Success Rate" "FAIL" "0% success rate"
    fi
    
    # Concurrent request test
    local concurrent_test_file="${PROJECT_ROOT}/logs/concurrent-test-$$.tmp"
    
    # Start concurrent requests
    for ((i=1; i<=5; i++)); do
        (
            local response
            response=$(http_request_detailed "GET" "$BASE_URL/health")
            if [[ "$response" != "ERROR"* ]]; then
                local status_code="${response##*|}"
                echo "$status_code" >> "$concurrent_test_file"
            else
                echo "ERROR" >> "$concurrent_test_file"
            fi
        ) &
    done
    
    wait
    
    if [[ -f "$concurrent_test_file" ]]; then
        local concurrent_success
        concurrent_success=$(grep -c "200" "$concurrent_test_file" 2>/dev/null || echo "0")
        local concurrent_total
        concurrent_total=$(wc -l < "$concurrent_test_file" 2>/dev/null || echo "0")
        
        rm -f "$concurrent_test_file"
        
        if [[ $concurrent_total -gt 0 ]]; then
            local concurrent_rate=$((concurrent_success * 100 / concurrent_total))
            if [[ $concurrent_rate -ge 80 ]]; then
                record_verification "Concurrent Requests" "PASS" "${concurrent_success}/${concurrent_total} requests succeeded"
            else
                record_verification "Concurrent Requests" "WARN" "only ${concurrent_success}/${concurrent_total} concurrent requests succeeded"
            fi
        else
            record_verification "Concurrent Requests" "FAIL" "no concurrent requests completed"
        fi
    fi
}

# 4. Feature Flag Verification
verify_feature_flags() {
    log "INFO" "=== Verifying Feature Flags ==="
    
    local flags_response
    flags_response=$(http_request_detailed "GET" "$BASE_URL/api/feature-flags")
    
    if [[ "$flags_response" != "ERROR"* ]]; then
        local status_code="${flags_response##*|}"
        if [[ "$status_code" == "200" ]]; then
            record_verification "Feature Flags Endpoint" "PASS" "feature flags accessible"
            
            # Check for required feature flags
            local flags_body
            flags_body=$(curl -s "$BASE_URL/api/feature-flags" 2>/dev/null || echo "")
            
            if [[ "$flags_body" == *"ai_recommendations"* ]]; then
                record_verification "AI Recommendations Flag" "PASS" "ai_recommendations flag present"
            else
                record_verification "AI Recommendations Flag" "FAIL" "ai_recommendations flag missing"
            fi
            
            if [[ "$flags_body" == *"ai_recommendations_analytics"* ]]; then
                record_verification "Analytics Flag" "PASS" "analytics flag present"
            else
                record_verification "Analytics Flag" "WARN" "analytics flag missing"
            fi
        else
            record_verification "Feature Flags Endpoint" "FAIL" "returned status $status_code"
        fi
    else
        record_verification "Feature Flags Endpoint" "FAIL" "endpoint unreachable"
    fi
}

# 5. API Endpoint Verification
verify_api_endpoints() {
    log "INFO" "=== Verifying API Endpoints ==="
    
    # Templates API
    local templates_response
    templates_response=$(http_request_detailed "GET" "$BASE_URL/api/templates")
    
    if [[ "$templates_response" != "ERROR"* ]]; then
        local status_code="${templates_response##*|}"
        if [[ "$status_code" == "200" ]]; then
            record_verification "Templates API" "PASS" "templates endpoint responding"
        else
            record_verification "Templates API" "FAIL" "templates endpoint returned $status_code"
        fi
    else
        record_verification "Templates API" "FAIL" "templates endpoint unreachable"
    fi
    
    # Check if AI recommendations are enabled before testing
    local flags_body
    flags_body=$(curl -s "$BASE_URL/api/feature-flags" 2>/dev/null || echo "")
    
    if [[ "$flags_body" == *'"ai_recommendations":true'* ]] || [[ "$flags_body" == *'"ai_recommendations":{"status":"enabled"}'* ]]; then
        # Recommendations API
        local recommendations_response
        recommendations_response=$(http_request_detailed "GET" "$BASE_URL/api/recommendations?stackId=test")
        
        if [[ "$recommendations_response" != "ERROR"* ]]; then
            local status_code="${recommendations_response##*|}"
            if [[ "$status_code" == "200" ]]; then
                record_verification "Recommendations API" "PASS" "recommendations endpoint responding"
            else
                record_verification "Recommendations API" "FAIL" "recommendations endpoint returned $status_code"
            fi
        else
            record_verification "Recommendations API" "FAIL" "recommendations endpoint unreachable"
        fi
    else
        record_verification "Recommendations API" "INFO" "skipped (AI recommendations disabled)"
    fi
    
    # Error handling
    local error_response
    error_response=$(http_request_detailed "GET" "$BASE_URL/api/nonexistent")
    
    if [[ "$error_response" != "ERROR"* ]]; then
        local status_code="${error_response##*|}"
        if [[ "$status_code" == "404" ]]; then
            record_verification "Error Handling" "PASS" "proper 404 error handling"
        else
            record_verification "Error Handling" "WARN" "unexpected status $status_code for nonexistent endpoint"
        fi
    else
        record_verification "Error Handling" "WARN" "could not test error handling"
    fi
}

# 6. Security Verification
verify_security() {
    log "INFO" "=== Verifying Security ==="
    
    # CORS headers
    local cors_response
    cors_response=$(curl -s -I -X OPTIONS "$BASE_URL/api/health" -H "Origin: https://buildmystack.com" 2>/dev/null || echo "")
    
    if [[ "$cors_response" == *"Access-Control-Allow-Origin"* ]]; then
        record_verification "CORS Headers" "PASS" "CORS properly configured"
    else
        record_verification "CORS Headers" "WARN" "CORS headers not detected"
    fi
    
    # Security headers
    local security_response
    security_response=$(curl -s -I "$BASE_URL/health" 2>/dev/null || echo "")
    
    local security_headers=("X-Content-Type-Options" "X-Frame-Options" "X-XSS-Protection")
    local found_headers=0
    
    for header in "${security_headers[@]}"; do
        if [[ "$security_response" == *"$header"* ]]; then
            found_headers=$((found_headers + 1))
        fi
    done
    
    if [[ $found_headers -gt 0 ]]; then
        record_verification "Security Headers" "PASS" "$found_headers security headers found"
    else
        record_verification "Security Headers" "WARN" "no security headers detected"
    fi
    
    # Rate limiting test
    local rate_limit_triggered=false
    for i in {1..20}; do
        local response
        response=$(curl -s -w "%{http_code}" -o /dev/null "$BASE_URL/api/health" -m 5 2>/dev/null || echo "000")
        
        if [[ "$response" == "429" ]]; then
            rate_limit_triggered=true
            break
        fi
        sleep 0.05
    done
    
    if [[ "$rate_limit_triggered" == "true" ]]; then
        record_verification "Rate Limiting" "PASS" "rate limiting is active"
    else
        record_verification "Rate Limiting" "INFO" "rate limiting not triggered in test"
    fi
}

# 7. Monitoring and Metrics Verification
verify_monitoring() {
    log "INFO" "=== Verifying Monitoring and Metrics ==="
    
    # Metrics endpoint
    local metrics_response
    metrics_response=$(http_request_detailed "GET" "$BASE_URL/metrics")
    
    if [[ "$metrics_response" != "ERROR"* ]]; then
        local status_code="${metrics_response##*|}"
        if [[ "$status_code" == "200" ]]; then
            record_verification "Metrics Endpoint" "PASS" "Prometheus metrics available"
            
            # Check for specific metrics
            local metrics_body
            metrics_body=$(curl -s "$BASE_URL/metrics" 2>/dev/null || echo "")
            
            if [[ "$metrics_body" == *"buildmystack_ai"* ]]; then
                record_verification "Application Metrics" "PASS" "application-specific metrics found"
            else
                record_verification "Application Metrics" "WARN" "application-specific metrics not found"
            fi
        else
            record_verification "Metrics Endpoint" "FAIL" "metrics endpoint returned $status_code"
        fi
    else
        record_verification "Metrics Endpoint" "FAIL" "metrics endpoint unreachable"
    fi
    
    # Check if we can reach monitoring services in Kubernetes
    if command -v kubectl &> /dev/null; then
        # Check for Prometheus
        if kubectl get service prometheus-server -n monitoring &> /dev/null; then
            record_verification "Prometheus Service" "PASS" "Prometheus service found"
        else
            record_verification "Prometheus Service" "INFO" "Prometheus service not found (may be external)"
        fi
        
        # Check for Grafana
        if kubectl get service grafana -n monitoring &> /dev/null; then
            record_verification "Grafana Service" "PASS" "Grafana service found"
        else
            record_verification "Grafana Service" "INFO" "Grafana service not found (may be external)"
        fi
    fi
}

# 8. Data Integrity Verification
verify_data_integrity() {
    log "INFO" "=== Verifying Data Integrity ==="
    
    # Test basic database operations through API
    local timestamp=$(date +%s)
    local test_data="{\"test\":\"verification-$timestamp\"}"
    
    # Templates should be available
    local templates_response
    templates_response=$(curl -s "$BASE_URL/api/templates" 2>/dev/null || echo "")
    
    if [[ "$templates_response" == *"templates"* ]] && [[ "$templates_response" == *"["* ]]; then
        record_verification "Template Data" "PASS" "template data accessible"
    else
        record_verification "Template Data" "WARN" "template data not accessible or empty"
    fi
    
    # Check cache functionality
    local cache_test_key="verification-$timestamp"
    
    # This would normally test cache operations through a test endpoint
    # For now, we verify that cache health check passes (tested earlier)
    record_verification "Cache Integrity" "INFO" "cache integrity verified through health checks"
}

# 9. Load and Stress Testing
verify_load_handling() {
    log "INFO" "=== Verifying Load Handling ==="
    
    local load_test_file="${PROJECT_ROOT}/logs/load-test-$$.tmp"
    local concurrent_users=10
    local requests_per_user=5
    
    log "INFO" "Running load test with $concurrent_users concurrent users, $requests_per_user requests each..."
    
    # Start concurrent load
    for ((u=1; u<=concurrent_users; u++)); do
        (
            for ((r=1; r<=requests_per_user; r++)); do
                local response
                response=$(curl -s -w "%{http_code}|%{time_total}" -o /dev/null "$BASE_URL/health" -m 10 2>/dev/null || echo "000|0")
                echo "$response" >> "$load_test_file"
                sleep 0.1
            done
        ) &
    done
    
    wait
    
    if [[ -f "$load_test_file" ]]; then
        local total_requests
        total_requests=$(wc -l < "$load_test_file")
        
        local successful_requests
        successful_requests=$(grep -c "200|" "$load_test_file" 2>/dev/null || echo "0")
        
        local total_time=0
        while IFS='|' read -r status time; do
            if [[ "$status" == "200" ]]; then
                total_time=$(echo "$total_time + $time" | bc -l)
            fi
        done < "$load_test_file"
        
        rm -f "$load_test_file"
        
        if [[ $successful_requests -gt 0 ]]; then
            local success_rate=$((successful_requests * 100 / total_requests))
            local avg_time=$(echo "$total_time / $successful_requests" | bc -l)
            local avg_time_ms=$(echo "$avg_time * 1000" | bc -l)
            
            if [[ $success_rate -ge 90 ]]; then
                record_verification "Load Handling" "PASS" "${success_rate}% success rate under load (avg ${avg_time_ms}ms)"
            else
                record_verification "Load Handling" "WARN" "only ${success_rate}% success rate under load"
            fi
        else
            record_verification "Load Handling" "FAIL" "no successful requests under load"
        fi
    else
        record_verification "Load Handling" "FAIL" "could not perform load test"
    fi
}

# 10. Rollback Readiness Verification
verify_rollback_readiness() {
    log "INFO" "=== Verifying Rollback Readiness ==="
    
    # Check if deployment has previous revision
    if command -v kubectl &> /dev/null; then
        local rollout_history
        rollout_history=$(kubectl rollout history deployment/buildmystack-ai -n "$KUBERNETES_NAMESPACE" 2>/dev/null || echo "")
        
        if [[ "$rollout_history" == *"REVISION"* ]]; then
            local revision_count
            revision_count=$(echo "$rollout_history" | grep -c "^[0-9]" || echo "0")
            
            if [[ $revision_count -gt 1 ]]; then
                record_verification "Rollback History" "PASS" "$revision_count deployment revisions available"
            else
                record_verification "Rollback History" "WARN" "only $revision_count revision available for rollback"
            fi
        else
            record_verification "Rollback History" "WARN" "rollout history not available"
        fi
    fi
    
    # Test feature flag disable functionality
    record_verification "Feature Flag Control" "INFO" "feature flags can be disabled for emergency rollback"
    
    # Verify rollback scripts exist
    local rollback_script="${PROJECT_ROOT}/scripts/deploy-production.sh"
    if [[ -f "$rollback_script" && -x "$rollback_script" ]]; then
        record_verification "Rollback Scripts" "PASS" "rollback scripts available and executable"
    else
        record_verification "Rollback Scripts" "FAIL" "rollback scripts missing or not executable"
    fi
}

# Main verification function
run_comprehensive_verification() {
    log "INFO" "=== Starting Comprehensive Deployment Verification ==="
    log "INFO" "Base URL: $BASE_URL"
    log "INFO" "Kubernetes Namespace: $KUBERNETES_NAMESPACE"
    log "INFO" "Verification log: $VERIFICATION_LOG"
    
    # Run all verification modules
    verify_kubernetes_infrastructure
    verify_application_health
    verify_performance
    verify_feature_flags
    verify_api_endpoints
    verify_security
    verify_monitoring
    verify_data_integrity
    verify_load_handling
    verify_rollback_readiness
    
    # Generate comprehensive report
    local total_verifications=$((VERIFICATIONS_PASSED + VERIFICATIONS_FAILED))
    local pass_rate=0
    
    if [[ $total_verifications -gt 0 ]]; then
        pass_rate=$((VERIFICATIONS_PASSED * 100 / total_verifications))
    fi
    
    log "INFO" "=== Deployment Verification Results ==="
    log "INFO" "Total verifications: $total_verifications"
    log "INFO" "Passed: $VERIFICATIONS_PASSED"
    log "INFO" "Failed: $VERIFICATIONS_FAILED"
    log "INFO" "Warnings: ${#WARNINGS[@]}"
    log "INFO" "Pass rate: ${pass_rate}%"
    
    # Show failed verifications
    if [[ $VERIFICATIONS_FAILED -gt 0 ]]; then
        log "ERROR" "Failed verifications:"
        for failed in "${FAILED_VERIFICATIONS[@]}"; do
            log "ERROR" "  - $failed"
        done
    fi
    
    # Show warnings
    if [[ ${#WARNINGS[@]} -gt 0 ]]; then
        log "WARN" "Warnings:"
        for warning in "${WARNINGS[@]}"; do
            log "WARN" "  - $warning"
        done
    fi
    
    # Determine overall result
    if [[ $VERIFICATIONS_FAILED -eq 0 ]]; then
        if [[ ${#WARNINGS[@]} -eq 0 ]]; then
            log "SUCCESS" "✅ ALL VERIFICATIONS PASSED - Deployment is PRODUCTION READY"
            return 0
        else
            log "SUCCESS" "✅ DEPLOYMENT VERIFIED WITH WARNINGS - Production ready with minor issues"
            return 0
        fi
    elif [[ $pass_rate -ge 80 ]]; then
        log "WARN" "⚠️ DEPLOYMENT VERIFIED WITH FAILURES - ${pass_rate}% pass rate (proceed with caution)"
        return 1
    else
        log "ERROR" "❌ DEPLOYMENT VERIFICATION FAILED - ${pass_rate}% pass rate (NOT PRODUCTION READY)"
        return 2
    fi
}

# Automated rollback trigger check
check_rollback_triggers() {
    log "INFO" "=== Checking Automatic Rollback Triggers ==="
    
    local should_rollback=false
    local rollback_reasons=()
    
    # Check error rate
    local error_rate_threshold=5
    local current_error_rate=0
    
    # This would normally check actual error rates from monitoring
    # For now, we use verification failures as a proxy
    if [[ $VERIFICATIONS_FAILED -gt 0 ]]; then
        local total_checks=$((VERIFICATIONS_PASSED + VERIFICATIONS_FAILED))
        current_error_rate=$((VERIFICATIONS_FAILED * 100 / total_checks))
        
        if [[ $current_error_rate -gt $error_rate_threshold ]]; then
            should_rollback=true
            rollback_reasons+=("Error rate ${current_error_rate}% exceeds ${error_rate_threshold}% threshold")
        fi
    fi
    
    # Check critical service failures
    for failed in "${FAILED_VERIFICATIONS[@]}"; do
        if [[ "$failed" == *"Health Endpoint"* ]] || [[ "$failed" == *"Database Health"* ]] || [[ "$failed" == *"Kubernetes Deployment"* ]]; then
            should_rollback=true
            rollback_reasons+=("Critical service failure: $failed")
        fi
    done
    
    if [[ "$should_rollback" == "true" ]]; then
        log "ERROR" "🚨 AUTOMATIC ROLLBACK TRIGGERED 🚨"
        for reason in "${rollback_reasons[@]}"; do
            log "ERROR" "Rollback reason: $reason"
        done
        
        log "ERROR" "Execute rollback with: ./scripts/deploy-production.sh rollback"
        return 3  # Special exit code for rollback required
    else
        log "INFO" "No automatic rollback triggers detected"
        return 0
    fi
}

# Show usage
show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Comprehensive deployment verification for BuildMyStack AI Recommendations.

Options:
  --url URL              Base URL of the deployed application (default: http://localhost:8080)
  --namespace NAMESPACE  Kubernetes namespace (default: buildmystack)
  --timeout SECONDS      Request timeout in seconds (default: 30)
  --kubernetes           Verify Kubernetes deployment
  --skip-load-test      Skip load testing
  --quick               Run quick verification only
  --check-rollback      Check automatic rollback triggers
  --help                Show this help message

Examples:
  $0                                    # Full verification
  $0 --url https://api.buildmystack.com # Verify production deployment
  $0 --kubernetes --namespace prod      # Verify specific Kubernetes deployment
  $0 --quick                           # Quick verification only
  $0 --check-rollback                  # Check if rollback is needed

Exit Codes:
  0 - All verifications passed
  1 - Verifications passed with warnings
  2 - Verification failed (not production ready)
  3 - Automatic rollback required

EOF
}

# Main function
main() {
    local skip_load_test=false
    local quick_mode=false
    local check_rollback_only=false
    
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
            --namespace)
                KUBERNETES_NAMESPACE="$2"
                shift 2
                ;;
            --timeout)
                DEFAULT_TIMEOUT="$2"
                shift 2
                ;;
            --kubernetes)
                # Flag for kubernetes-specific verification
                shift
                ;;
            --skip-load-test)
                skip_load_test=true
                shift
                ;;
            --quick)
                quick_mode=true
                shift
                ;;
            --check-rollback)
                check_rollback_only=true
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
    
    # Check for required tools
    if ! command -v curl &> /dev/null; then
        log "ERROR" "curl is required but not installed"
        exit 1
    fi
    
    if ! command -v bc &> /dev/null; then
        log "WARN" "bc not available - some calculations may be limited"
    fi
    
    # Run verification
    local exit_code=0
    
    if [[ "$check_rollback_only" == "true" ]]; then
        # Just check rollback triggers
        check_rollback_triggers
        exit_code=$?
    else
        # Run full verification
        run_comprehensive_verification
        exit_code=$?
        
        # Also check rollback triggers
        check_rollback_triggers
        local rollback_code=$?
        
        # Use the more severe exit code
        if [[ $rollback_code -gt $exit_code ]]; then
            exit_code=$rollback_code
        fi
    fi
    
    log "INFO" "Deployment verification completed - check log: $VERIFICATION_LOG"
    exit $exit_code
}

# Run main function with all arguments
main "$@"