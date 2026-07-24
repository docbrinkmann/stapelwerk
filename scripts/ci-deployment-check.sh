#!/bin/bash

# CI/CD Deployment Check Integration Script
# Integrates with CI/CD pipelines to validate deployment status

set -e

# Script Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
CI_LOG="${PROJECT_ROOT}/logs/ci-deployment-$(date +%Y%m%d-%H%M%S).log"
CI_RESULTS="${PROJECT_ROOT}/logs/ci-results-$(date +%Y%m%d-%H%M%S).json"

# CI/CD Configuration
DEFAULT_BASE_URL="${DEPLOYMENT_URL:-http://localhost:8080}"
DEFAULT_NAMESPACE="${K8S_NAMESPACE:-stapelwerk}"
DEFAULT_TIMEOUT=30
PIPELINE_ID="${CI_PIPELINE_ID:-local-$(date +%s)}"
BUILD_ID="${CI_BUILD_ID:-local-build}"
ENVIRONMENT="${DEPLOY_ENV:-staging}"

# Exit codes for CI/CD
EXIT_SUCCESS=0
EXIT_WARNING=1
EXIT_FAILURE=2
EXIT_CRITICAL=3

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# CI Logging with structured output
ci_log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
    
    # JSON structured logging for CI/CD systems
    local json_log="{\"timestamp\":\"$timestamp\",\"level\":\"$level\",\"message\":\"$message\",\"pipeline_id\":\"$PIPELINE_ID\",\"build_id\":\"$BUILD_ID\",\"environment\":\"$ENVIRONMENT\"}"
    echo "$json_log" >> "${CI_LOG}"
    
    # Human-readable output
    case $level in
        "ERROR")
            echo -e "${RED}[ERROR] ${message}${NC}" >&2
            ;;
        "WARN")
            echo -e "${YELLOW}[WARN] ${message}${NC}"
            ;;
        "SUCCESS")
            echo -e "${GREEN}[SUCCESS] ${message}${NC}"
            ;;
        "INFO")
            echo -e "${BLUE}[INFO] ${message}${NC}"
            ;;
        "DEBUG")
            echo -e "${PURPLE}[DEBUG] ${message}${NC}"
            ;;
    esac
}

# Wait for deployment readiness with timeout
wait_for_deployment() {
    local url=$1
    local timeout=${2:-300}  # 5 minutes default
    local check_interval=10
    
    ci_log "INFO" "Waiting for deployment at $url to be ready (timeout: ${timeout}s)"
    
    local start_time=$(date +%s)
    local end_time=$((start_time + timeout))
    
    while [[ $(date +%s) -lt $end_time ]]; do
        if curl -s -f "$url/health" > /dev/null 2>&1; then
            ci_log "SUCCESS" "Deployment is ready and responding"
            return 0
        fi
        
        ci_log "INFO" "Deployment not ready yet, waiting ${check_interval}s..."
        sleep $check_interval
    done
    
    ci_log "ERROR" "Deployment readiness timeout after ${timeout}s"
    return 1
}

# Run quick health check
run_quick_health_check() {
    ci_log "INFO" "Running quick health check"
    
    local health_endpoints=(
        "$BASE_URL/health"
        "$BASE_URL/api/health"
        "$BASE_URL/api/health/database"
        "$BASE_URL/api/health/cache"
    )
    
    local failed_endpoints=0
    local total_endpoints=${#health_endpoints[@]}
    
    for endpoint in "${health_endpoints[@]}"; do
        if curl -s -f "$endpoint" -m 10 > /dev/null 2>&1; then
            ci_log "SUCCESS" "Health check passed: $endpoint"
        else
            ci_log "ERROR" "Health check failed: $endpoint"
            failed_endpoints=$((failed_endpoints + 1))
        fi
    done
    
    local success_rate=$(( (total_endpoints - failed_endpoints) * 100 / total_endpoints ))
    
    if [[ $failed_endpoints -eq 0 ]]; then
        ci_log "SUCCESS" "All health checks passed (100%)"
        return 0
    elif [[ $success_rate -ge 75 ]]; then
        ci_log "WARN" "Health checks passed with issues (${success_rate}%)"
        return 1
    else
        ci_log "ERROR" "Health checks failed (${success_rate}%)"
        return 2
    fi
}

# Run smoke tests
run_smoke_tests() {
    ci_log "INFO" "Running smoke tests"
    
    local smoke_test_cmd="$SCRIPT_DIR/run-smoke-tests.sh --url $BASE_URL --timeout $DEFAULT_TIMEOUT --quick"
    
    if $smoke_test_cmd > /tmp/smoke_test_output.log 2>&1; then
        ci_log "SUCCESS" "Smoke tests passed"
        return 0
    else
        local exit_code=$?
        ci_log "ERROR" "Smoke tests failed with exit code $exit_code"
        
        # Include some test output in logs
        if [[ -f "/tmp/smoke_test_output.log" ]]; then
            local error_summary=$(tail -n 5 /tmp/smoke_test_output.log | tr '\n' ' ')
            ci_log "ERROR" "Smoke test errors: $error_summary"
        fi
        
        return $exit_code
    fi
}

# Run basic performance check
run_basic_performance_check() {
    ci_log "INFO" "Running basic performance check"
    
    # Response time check
    local response_times=()
    local failed_requests=0
    
    for i in {1..10}; do
        local response_time
        response_time=$(curl -w '%{time_total}' -o /dev/null -s "$BASE_URL/health" -m 10 2>/dev/null || echo "timeout")
        
        if [[ "$response_time" == "timeout" ]]; then
            failed_requests=$((failed_requests + 1))
            ci_log "WARN" "Request $i timed out"
        else
            response_times+=("$response_time")
            ci_log "DEBUG" "Request $i: ${response_time}s"
        fi
    done
    
    if [[ ${#response_times[@]} -eq 0 ]]; then
        ci_log "ERROR" "All performance test requests failed"
        return 2
    fi
    
    # Calculate average response time
    local total_time=0
    for time in "${response_times[@]}"; do
        total_time=$(echo "$total_time + $time" | bc -l)
    done
    
    local avg_time=$(echo "scale=3; $total_time / ${#response_times[@]}" | bc -l)
    local success_rate=$(( (10 - failed_requests) * 100 / 10 ))
    
    ci_log "INFO" "Average response time: ${avg_time}s"
    ci_log "INFO" "Success rate: ${success_rate}%"
    
    # Determine result
    local threshold=2.0
    if (( $(echo "$avg_time > $threshold" | bc -l) )); then
        ci_log "WARN" "Performance warning: Average response time ${avg_time}s > ${threshold}s"
        return 1
    elif [[ $success_rate -lt 80 ]]; then
        ci_log "WARN" "Performance warning: Success rate ${success_rate}% < 80%"
        return 1
    else
        ci_log "SUCCESS" "Performance check passed"
        return 0
    fi
}

# Check for deployment regressions
check_deployment_regressions() {
    ci_log "INFO" "Checking for deployment regressions"
    
    # Check API endpoints functionality
    local api_endpoints=(
        "$BASE_URL/api/templates"
        "$BASE_URL/api/feature-flags"
        "$BASE_URL/metrics"
    )
    
    local failed_apis=0
    
    for endpoint in "${api_endpoints[@]}"; do
        if curl -s -f "$endpoint" -m 10 | head -c 100 > /dev/null 2>&1; then
            ci_log "SUCCESS" "API regression check passed: $endpoint"
        else
            ci_log "ERROR" "API regression check failed: $endpoint"
            failed_apis=$((failed_apis + 1))
        fi
    done
    
    if [[ $failed_apis -eq 0 ]]; then
        ci_log "SUCCESS" "No regressions detected"
        return 0
    elif [[ $failed_apis -le 1 ]]; then
        ci_log "WARN" "Minor regressions detected ($failed_apis failed)"
        return 1
    else
        ci_log "ERROR" "Major regressions detected ($failed_apis failed)"
        return 2
    fi
}

# Generate CI/CD results report
generate_ci_results() {
    local overall_status=$1
    local health_status=$2
    local smoke_status=$3
    local performance_status=$4
    local regression_status=$5
    
    local overall_result="FAILED"
    case $overall_status in
        0) overall_result="PASSED" ;;
        1) overall_result="PASSED_WITH_WARNINGS" ;;
        *) overall_result="FAILED" ;;
    esac
    
    cat > "$CI_RESULTS" << EOF
{
  "ci_deployment_check": {
    "generated_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "pipeline_id": "$PIPELINE_ID",
    "build_id": "$BUILD_ID",
    "environment": "$ENVIRONMENT",
    "base_url": "$BASE_URL",
    "namespace": "$DEFAULT_NAMESPACE",
    "overall_result": "$overall_result",
    "overall_status_code": $overall_status,
    "test_results": {
      "health_check": {
        "status_code": $health_status,
        "result": "$([ $health_status -eq 0 ] && echo "PASSED" || [ $health_status -eq 1 ] && echo "WARNING" || echo "FAILED")"
      },
      "smoke_tests": {
        "status_code": $smoke_status,
        "result": "$([ $smoke_status -eq 0 ] && echo "PASSED" || [ $smoke_status -eq 1 ] && echo "WARNING" || echo "FAILED")"
      },
      "performance_check": {
        "status_code": $performance_status,
        "result": "$([ $performance_status -eq 0 ] && echo "PASSED" || [ $performance_status -eq 1 ] && echo "WARNING" || echo "FAILED")"
      },
      "regression_check": {
        "status_code": $regression_status,
        "result": "$([ $regression_status -eq 0 ] && echo "PASSED" || [ $regression_status -eq 1 ] && echo "WARNING" || echo "FAILED")"
      }
    },
    "recommendations": [
EOF
    
    # Add recommendations based on results
    local recommendations=()
    
    if [[ $overall_status -eq 0 ]]; then
        recommendations+=("\"Deployment validation successful - ready for production traffic\"")
    elif [[ $overall_status -eq 1 ]]; then
        recommendations+=("\"Deployment validation passed with warnings - monitor closely\"")
        if [[ $health_status -ne 0 ]]; then
            recommendations+=("\"Investigate health check issues before full deployment\"")
        fi
        if [[ $performance_status -ne 0 ]]; then
            recommendations+=("\"Performance issues detected - consider optimization\"")
        fi
        if [[ $regression_status -ne 0 ]]; then
            recommendations+=("\"API regressions detected - review changes\"")
        fi
    else
        recommendations+=("\"Deployment validation failed - do not proceed to production\"")
        if [[ $health_status -gt 1 ]]; then
            recommendations+=("\"Critical health check failures - immediate attention required\"")
        fi
        if [[ $smoke_status -gt 1 ]]; then
            recommendations+=("\"Smoke test failures - core functionality compromised\"")
        fi
    fi
    
    # Join recommendations with commas
    local first_rec=true
    for rec in "${recommendations[@]}"; do
        if [[ "$first_rec" != "true" ]]; then
            echo "," >> "$CI_RESULTS"
        fi
        echo "      $rec" >> "$CI_RESULTS"
        first_rec=false
    done
    
    cat >> "$CI_RESULTS" << EOF
    ],
    "logs": {
      "ci_log": "$CI_LOG",
      "results_file": "$CI_RESULTS"
    }
  }
}
EOF
    
    ci_log "INFO" "CI/CD results report generated: $CI_RESULTS"
}

# Show usage
show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

CI/CD integration script for Stapelwerk AI deployment validation.

Environment Variables:
  DEPLOYMENT_URL        Base URL of the deployed application
  K8S_NAMESPACE         Kubernetes namespace
  CI_PIPELINE_ID        CI/CD pipeline identifier
  CI_BUILD_ID           Build identifier
  DEPLOY_ENV           Environment name (staging, production, etc.)

Options:
  --url URL              Override base URL
  --namespace NAMESPACE  Override Kubernetes namespace  
  --timeout SECONDS      Timeout for individual checks (default: 30)
  --wait-timeout SECONDS Timeout for deployment readiness (default: 300)
  --skip-wait           Skip waiting for deployment readiness
  --skip-performance    Skip performance checks
  --skip-regression     Skip regression checks
  --quick               Run essential checks only
  --help                Show this help message

Exit Codes:
  0 - All checks passed (deployment ready)
  1 - Checks passed with warnings (proceed with caution)
  2 - Checks failed (deployment issues detected)
  3 - Critical failures (do not proceed)

Examples:
  $0                                      # Run all checks
  $0 --url https://staging.stapelwerk.com # Check staging deployment
  $0 --quick                             # Run essential checks only
  $0 --skip-performance                  # Skip performance tests

EOF
}

# Main CI/CD check function
main() {
    local skip_wait=false
    local skip_performance=false
    local skip_regression=false
    local quick_mode=false
    local wait_timeout=300
    
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
                DEFAULT_NAMESPACE="$2"
                shift 2
                ;;
            --timeout)
                DEFAULT_TIMEOUT="$2"
                shift 2
                ;;
            --wait-timeout)
                wait_timeout="$2"
                shift 2
                ;;
            --skip-wait)
                skip_wait=true
                shift
                ;;
            --skip-performance)
                skip_performance=true
                shift
                ;;
            --skip-regression)
                skip_regression=true
                shift
                ;;
            --quick)
                quick_mode=true
                skip_performance=true
                shift
                ;;
            --help)
                show_usage
                exit 0
                ;;
            *)
                ci_log "ERROR" "Unknown option: $1"
                show_usage
                exit $EXIT_CRITICAL
                ;;
        esac
    done
    
    ci_log "INFO" "Starting CI/CD deployment validation"
    ci_log "INFO" "Pipeline ID: $PIPELINE_ID"
    ci_log "INFO" "Build ID: $BUILD_ID"
    ci_log "INFO" "Environment: $ENVIRONMENT"
    ci_log "INFO" "Base URL: $BASE_URL"
    ci_log "INFO" "Namespace: $DEFAULT_NAMESPACE"
    
    # Track test results
    local health_status=0
    local smoke_status=0
    local performance_status=0
    local regression_status=0
    local overall_status=0
    
    # Wait for deployment readiness (unless skipped)
    if [[ "$skip_wait" != "true" ]]; then
        if ! wait_for_deployment "$BASE_URL" "$wait_timeout"; then
            ci_log "ERROR" "Deployment readiness check failed"
            generate_ci_results $EXIT_CRITICAL 2 0 0 0
            exit $EXIT_CRITICAL
        fi
    fi
    
    # Run health checks
    ci_log "INFO" "=== Running Health Checks ==="
    run_quick_health_check
    health_status=$?
    
    if [[ $health_status -gt 1 ]]; then
        ci_log "ERROR" "Critical health check failures - aborting further tests"
        generate_ci_results $EXIT_FAILURE $health_status 0 0 0
        exit $EXIT_FAILURE
    fi
    
    # Run smoke tests
    ci_log "INFO" "=== Running Smoke Tests ==="
    run_smoke_tests
    smoke_status=$?
    
    if [[ $smoke_status -gt 1 ]]; then
        ci_log "ERROR" "Critical smoke test failures"
        overall_status=$EXIT_FAILURE
    elif [[ $smoke_status -eq 1 ]]; then
        overall_status=$EXIT_WARNING
    fi
    
    # Run performance checks (unless skipped)
    if [[ "$skip_performance" != "true" ]]; then
        ci_log "INFO" "=== Running Performance Checks ==="
        run_basic_performance_check
        performance_status=$?
        
        if [[ $performance_status -eq 1 ]] && [[ $overall_status -eq 0 ]]; then
            overall_status=$EXIT_WARNING
        fi
    fi
    
    # Run regression checks (unless skipped)
    if [[ "$skip_regression" != "true" ]]; then
        ci_log "INFO" "=== Running Regression Checks ==="
        check_deployment_regressions
        regression_status=$?
        
        if [[ $regression_status -gt 1 ]]; then
            overall_status=$EXIT_FAILURE
        elif [[ $regression_status -eq 1 ]] && [[ $overall_status -eq 0 ]]; then
            overall_status=$EXIT_WARNING
        fi
    fi
    
    # Apply health check results to overall status
    if [[ $health_status -eq 1 ]] && [[ $overall_status -eq 0 ]]; then
        overall_status=$EXIT_WARNING
    fi
    
    # Generate CI/CD results report
    generate_ci_results $overall_status $health_status $smoke_status $performance_status $regression_status
    
    # Final summary
    ci_log "INFO" "=== CI/CD Deployment Check Summary ==="
    ci_log "INFO" "Health checks: $([ $health_status -eq 0 ] && echo "PASSED" || [ $health_status -eq 1 ] && echo "WARNING" || echo "FAILED")"
    ci_log "INFO" "Smoke tests: $([ $smoke_status -eq 0 ] && echo "PASSED" || [ $smoke_status -eq 1 ] && echo "WARNING" || echo "FAILED")"
    
    if [[ "$skip_performance" != "true" ]]; then
        ci_log "INFO" "Performance: $([ $performance_status -eq 0 ] && echo "PASSED" || [ $performance_status -eq 1 ] && echo "WARNING" || echo "FAILED")"
    fi
    
    if [[ "$skip_regression" != "true" ]]; then
        ci_log "INFO" "Regressions: $([ $regression_status -eq 0 ] && echo "PASSED" || [ $regression_status -eq 1 ] && echo "WARNING" || echo "FAILED")"
    fi
    
    case $overall_status in
        0)
            ci_log "SUCCESS" "🎉 All deployment validation checks passed - Ready for production"
            ;;
        1)
            ci_log "WARN" "⚠️ Deployment validation passed with warnings - Monitor closely"
            ;;
        2)
            ci_log "ERROR" "❌ Deployment validation failed - Do not proceed to production"
            ;;
        3)
            ci_log "ERROR" "🚨 Critical deployment validation failures - Immediate attention required"
            ;;
    esac
    
    ci_log "INFO" "CI/CD log: $CI_LOG"
    ci_log "INFO" "CI/CD results: $CI_RESULTS"
    
    exit $overall_status
}

# Run main function with all arguments
main "$@"