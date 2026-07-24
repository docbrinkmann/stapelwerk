#!/bin/bash

# Automated Test Runner for Deployment Validation
# Orchestrates all deployment verification tests and provides comprehensive reporting

set -e

# Script Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
TEST_LOG="${PROJECT_ROOT}/logs/deployment-tests-$(date +%Y%m%d-%H%M%S).log"
REPORT_FILE="${PROJECT_ROOT}/logs/test-report-$(date +%Y%m%d-%H%M%S).html"

# Test Configuration
DEFAULT_BASE_URL="http://localhost:8080"
DEFAULT_NAMESPACE="stapelwerk"
DEFAULT_TIMEOUT=30

# Test Results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
WARNINGS=0
TEST_RESULTS=()

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Logging function
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    echo -e "${timestamp} [${level}] ${message}" | tee -a "${TEST_LOG}"
    
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
        "HEADER")
            echo -e "${CYAN}${timestamp} [${level}] ${message}${NC}"
            ;;
    esac
}

# Test result recording
record_test_result() {
    local test_name=$1
    local status=$2
    local duration=$3
    local details=$4
    local exit_code=${5:-0}
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    case $status in
        "PASS")
            PASSED_TESTS=$((PASSED_TESTS + 1))
            log "SUCCESS" "✓ $test_name completed successfully ($duration)"
            ;;
        "FAIL")
            FAILED_TESTS=$((FAILED_TESTS + 1))
            log "ERROR" "✗ $test_name failed ($duration) - $details"
            ;;
        "WARN")
            WARNINGS=$((WARNINGS + 1))
            log "WARN" "⚠ $test_name completed with warnings ($duration) - $details"
            ;;
    esac
    
    TEST_RESULTS+=("$test_name|$status|$duration|$details|$exit_code")
}

# Run a single test with timeout and error handling
run_test() {
    local test_name=$1
    local test_command=$2
    local timeout=${3:-300}  # 5 minutes default
    
    log "INFO" "Starting test: $test_name"
    
    local start_time=$(date +%s)
    local test_output_file="${PROJECT_ROOT}/logs/${test_name// /_}-output-$$.tmp"
    local test_exit_code=0
    
    # Run the test with timeout
    if timeout "$timeout" bash -c "$test_command" > "$test_output_file" 2>&1; then
        test_exit_code=0
    else
        test_exit_code=$?
        if [[ $test_exit_code -eq 124 ]]; then
            test_exit_code=2  # Timeout
        fi
    fi
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    local duration_str="${duration}s"
    
    # Read test output
    local test_output=""
    if [[ -f "$test_output_file" ]]; then
        test_output=$(tail -n 10 "$test_output_file" | tr '\n' ' ')
        rm -f "$test_output_file"
    fi
    
    # Determine test result
    case $test_exit_code in
        0)
            record_test_result "$test_name" "PASS" "$duration_str" "completed successfully" "$test_exit_code"
            ;;
        1)
            record_test_result "$test_name" "WARN" "$duration_str" "completed with warnings" "$test_exit_code"
            ;;
        2)
            record_test_result "$test_name" "FAIL" "$duration_str" "timeout after ${timeout}s" "$test_exit_code"
            ;;
        124)
            record_test_result "$test_name" "FAIL" "$duration_str" "timeout" "$test_exit_code"
            ;;
        *)
            record_test_result "$test_name" "FAIL" "$duration_str" "exit code $test_exit_code" "$test_exit_code"
            ;;
    esac
    
    return $test_exit_code
}

# Pre-deployment validation tests
run_pre_deployment_tests() {
    log "HEADER" "=== Running Pre-Deployment Tests ==="
    
    # Environment validation
    run_test "Environment Validation" \
        "$SCRIPT_DIR/validate-production-env.sh --quiet" \
        60
    
    # Configuration validation
    run_test "Configuration Validation" \
        "$SCRIPT_DIR/validate-production-env.sh --skip-connectivity --skip-docker --skip-k8s" \
        60
    
    # Security validation
    run_test "Security Validation" \
        "$SCRIPT_DIR/validate-production-env.sh --skip-connectivity --skip-tls --skip-docker --skip-k8s" \
        60
}

# Smoke tests
run_smoke_tests() {
    log "HEADER" "=== Running Smoke Tests ==="
    
    # Basic smoke tests
    run_test "Basic Smoke Tests" \
        "$SCRIPT_DIR/run-smoke-tests.sh --url $BASE_URL --timeout $DEFAULT_TIMEOUT" \
        300
    
    # Kubernetes-specific smoke tests (if applicable)
    if command -v kubectl &> /dev/null && kubectl get deployment stapelwerk-ai -n "$DEFAULT_NAMESPACE" &> /dev/null 2>&1; then
        run_test "Kubernetes Smoke Tests" \
            "$SCRIPT_DIR/run-smoke-tests.sh --kubernetes --timeout $DEFAULT_TIMEOUT" \
            300
    fi
}

# Comprehensive verification tests
run_verification_tests() {
    log "HEADER" "=== Running Comprehensive Verification Tests ==="
    
    # Full deployment verification
    run_test "Deployment Verification" \
        "$SCRIPT_DIR/verify-deployment.sh --url $BASE_URL --namespace $DEFAULT_NAMESPACE --timeout $DEFAULT_TIMEOUT" \
        600
    
    # Performance verification
    run_test "Performance Verification" \
        "$SCRIPT_DIR/verify-deployment.sh --url $BASE_URL --quick" \
        300
    
    # Security verification
    run_test "Security Verification" \
        "$SCRIPT_DIR/verify-deployment.sh --url $BASE_URL --skip-load-test" \
        300
}

# Post-deployment monitoring tests
run_monitoring_tests() {
    log "HEADER" "=== Running Monitoring and Observability Tests ==="
    
    # Check metrics endpoint
    run_test "Metrics Endpoint Test" \
        "curl -f $BASE_URL/metrics -m 30 > /dev/null" \
        60
    
    # Check health endpoints
    run_test "Health Endpoints Test" \
        "curl -f $BASE_URL/health -m 30 && curl -f $BASE_URL/api/health -m 30" \
        60
    
    # Feature flags test
    run_test "Feature Flags Test" \
        "curl -f $BASE_URL/api/feature-flags -m 30 | grep -q 'ai_recommendations'" \
        60
}

# API functionality tests
run_api_tests() {
    log "HEADER" "=== Running API Functionality Tests ==="
    
    # Templates API
    run_test "Templates API Test" \
        "curl -f $BASE_URL/api/templates -m 30 | grep -q 'templates'" \
        60
    
    # Health API endpoints
    run_test "Health API Tests" \
        "curl -f $BASE_URL/api/health/database -m 30 && curl -f $BASE_URL/api/health/cache -m 30" \
        60
    
    # Error handling
    run_test "Error Handling Test" \
        "curl -s -w '%{http_code}' $BASE_URL/api/nonexistent | grep -q '404'" \
        60
}

# Load and performance tests
run_performance_tests() {
    log "HEADER" "=== Running Performance and Load Tests ==="
    
    # Response time test
    run_test "Response Time Test" \
        "for i in {1..10}; do curl -w '%{time_total}\\n' -o /dev/null -s $BASE_URL/health; done | awk '{sum+=\$1} END {print \"Average:\", sum/NR \"s\"; if (sum/NR > 2) exit 1}'" \
        120
    
    # Concurrent request test
    run_test "Concurrent Requests Test" \
        "for i in {1..5}; do (curl -f $BASE_URL/health -m 10 > /dev/null) & done; wait" \
        60
    
    # Stress test (light)
    run_test "Light Stress Test" \
        "seq 1 20 | xargs -P 5 -I {} curl -f $BASE_URL/health -m 5 > /dev/null" \
        120
}

# Integration tests
run_integration_tests() {
    log "HEADER" "=== Running Integration Tests ==="
    
    # Database integration
    run_test "Database Integration Test" \
        "curl -f $BASE_URL/api/health/database -m 30 | grep -q 'connected'" \
        60
    
    # Cache integration
    run_test "Cache Integration Test" \
        "curl -f $BASE_URL/api/health/cache -m 30 | grep -q 'connected'" \
        60
    
    # AI services integration (if enabled)
    local flags_response
    flags_response=$(curl -s "$BASE_URL/api/feature-flags" 2>/dev/null || echo "")
    
    if [[ "$flags_response" == *'"ai_recommendations":true'* ]]; then
        run_test "AI Services Integration Test" \
            "curl -f $BASE_URL/api/health/ai-services -m 30 | grep -q 'available'" \
            60
        
        run_test "Recommendations API Test" \
            "curl -f '$BASE_URL/api/recommendations?stackId=test' -m 30 | grep -q 'recommendations'" \
            60
    else
        log "INFO" "Skipping AI services tests (AI recommendations disabled)"
    fi
}

# Rollback readiness tests
run_rollback_tests() {
    log "HEADER" "=== Running Rollback Readiness Tests ==="
    
    # Check rollback triggers
    run_test "Rollback Trigger Check" \
        "$SCRIPT_DIR/verify-deployment.sh --check-rollback --url $BASE_URL" \
        120
    
    # Verify rollback scripts
    run_test "Rollback Scripts Verification" \
        "test -x $SCRIPT_DIR/deploy-production.sh && $SCRIPT_DIR/deploy-production.sh --help > /dev/null" \
        30
    
    # Feature flag disable test
    run_test "Feature Flag Control Test" \
        "curl -f $BASE_URL/api/feature-flags -m 30 > /dev/null" \
        30
}

# Generate HTML report
generate_html_report() {
    log "INFO" "Generating HTML test report..."
    
    local pass_rate=0
    if [[ $TOTAL_TESTS -gt 0 ]]; then
        pass_rate=$((PASSED_TESTS * 100 / TOTAL_TESTS))
    fi
    
    local status_color="red"
    local status_text="FAILED"
    
    if [[ $FAILED_TESTS -eq 0 ]]; then
        if [[ $WARNINGS -eq 0 ]]; then
            status_color="green"
            status_text="PASSED"
        else
            status_color="orange"
            status_text="PASSED WITH WARNINGS"
        fi
    fi
    
    cat > "$REPORT_FILE" << EOF
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Stapelwerk AI Deployment Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .status { padding: 15px; border-radius: 5px; margin: 20px 0; text-align: center; font-weight: bold; font-size: 18px; }
        .status.passed { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; }
        .status.warning { background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; }
        .status.failed { background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .stat-card { background: #f8f9fa; padding: 15px; border-radius: 5px; text-align: center; }
        .stat-value { font-size: 24px; font-weight: bold; }
        .test-results { margin-top: 30px; }
        .test-category { margin: 20px 0; }
        .test-category h3 { background: #e9ecef; padding: 10px; margin: 0; border-radius: 5px 5px 0 0; }
        .test-item { display: grid; grid-template-columns: 60px 1fr 100px 100px; gap: 10px; padding: 10px; border-bottom: 1px solid #dee2e6; align-items: center; }
        .test-status { text-align: center; font-weight: bold; padding: 5px; border-radius: 3px; }
        .test-status.pass { background: #d4edda; color: #155724; }
        .test-status.fail { background: #f8d7da; color: #721c24; }
        .test-status.warn { background: #fff3cd; color: #856404; }
        .test-name { font-weight: 500; }
        .test-duration { text-align: right; color: #6c757d; }
        .test-exit-code { text-align: center; color: #6c757d; font-family: monospace; }
        .footer { margin-top: 30px; text-align: center; color: #6c757d; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Stapelwerk AI Deployment Test Report</h1>
            <p>Generated on $(date '+%Y-%m-%d %H:%M:%S')</p>
            <p><strong>Base URL:</strong> $BASE_URL</p>
            <p><strong>Namespace:</strong> $DEFAULT_NAMESPACE</p>
        </div>

        <div class="status $status_color">
            Overall Status: $status_text ($pass_rate% Pass Rate)
        </div>

        <div class="summary">
            <div class="stat-card">
                <div class="stat-value" style="color: #28a745;">$PASSED_TESTS</div>
                <div>Passed</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" style="color: #dc3545;">$FAILED_TESTS</div>
                <div>Failed</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" style="color: #ffc107;">$WARNINGS</div>
                <div>Warnings</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">$TOTAL_TESTS</div>
                <div>Total Tests</div>
            </div>
        </div>

        <div class="test-results">
            <h2>📋 Test Results</h2>
EOF
    
    # Group tests by category
    local current_category=""
    local category_open=false
    
    for result in "${TEST_RESULTS[@]}"; do
        IFS='|' read -r test_name status duration details exit_code <<< "$result"
        
        # Determine category from test name
        local category="Other"
        case "$test_name" in
            *"Environment"*|*"Configuration"*|*"Security Validation"*) category="Pre-Deployment" ;;
            *"Smoke"*) category="Smoke Tests" ;;
            *"Verification"*) category="Verification" ;;
            *"Monitoring"*|*"Metrics"*|*"Health"*) category="Monitoring" ;;
            *"API"*|*"Templates"*|*"Error"*) category="API Tests" ;;
            *"Performance"*|*"Response"*|*"Concurrent"*|*"Stress"*) category="Performance" ;;
            *"Integration"*|*"Database"*|*"Cache"*|*"AI Services"*) category="Integration" ;;
            *"Rollback"*) category="Rollback Readiness" ;;
        esac
        
        # Start new category if needed
        if [[ "$category" != "$current_category" ]]; then
            if [[ "$category_open" == "true" ]]; then
                echo "            </div>" >> "$REPORT_FILE"
            fi
            echo "            <div class=\"test-category\">" >> "$REPORT_FILE"
            echo "                <h3>$category</h3>" >> "$REPORT_FILE"
            current_category="$category"
            category_open=true
        fi
        
        # Convert status to lowercase for CSS class
        local status_class=$(echo "$status" | tr '[:upper:]' '[:lower:]')
        
        cat >> "$REPORT_FILE" << EOF
                <div class="test-item">
                    <div class="test-status $status_class">$status</div>
                    <div class="test-name">$test_name</div>
                    <div class="test-duration">$duration</div>
                    <div class="test-exit-code">$exit_code</div>
                </div>
EOF
    done
    
    if [[ "$category_open" == "true" ]]; then
        echo "            </div>" >> "$REPORT_FILE"
    fi
    
    cat >> "$REPORT_FILE" << EOF
        </div>

        <div class="footer">
            <p>Generated by Stapelwerk AI Deployment Test Suite</p>
            <p>Test logs: $TEST_LOG</p>
        </div>
    </div>
</body>
</html>
EOF
    
    log "SUCCESS" "HTML report generated: $REPORT_FILE"
}

# Generate summary report
generate_summary() {
    log "HEADER" "=== Test Execution Summary ==="
    
    local pass_rate=0
    if [[ $TOTAL_TESTS -gt 0 ]]; then
        pass_rate=$((PASSED_TESTS * 100 / TOTAL_TESTS))
    fi
    
    log "INFO" "Total tests executed: $TOTAL_TESTS"
    log "INFO" "Tests passed: $PASSED_TESTS"
    log "INFO" "Tests failed: $FAILED_TESTS"
    log "INFO" "Warnings: $WARNINGS"
    log "INFO" "Pass rate: ${pass_rate}%"
    
    if [[ $FAILED_TESTS -eq 0 ]]; then
        if [[ $WARNINGS -eq 0 ]]; then
            log "SUCCESS" "🎉 ALL DEPLOYMENT TESTS PASSED - System is production ready!"
            return 0
        else
            log "SUCCESS" "✅ DEPLOYMENT TESTS PASSED WITH WARNINGS - System is ready with minor issues"
            return 0
        fi
    elif [[ $pass_rate -ge 80 ]]; then
        log "WARN" "⚠️ DEPLOYMENT TESTS COMPLETED WITH FAILURES - ${pass_rate}% pass rate (proceed with caution)"
        return 1
    else
        log "ERROR" "❌ DEPLOYMENT TESTS FAILED - ${pass_rate}% pass rate (NOT PRODUCTION READY)"
        return 2
    fi
}

# Show usage
show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Automated test runner for Stapelwerk AI Recommendations deployment validation.

Options:
  --url URL              Base URL of the deployed application (default: http://localhost:8080)
  --namespace NAMESPACE  Kubernetes namespace (default: stapelwerk)
  --timeout SECONDS      Default timeout for tests (default: 30)
  --skip-pre-deployment Skip pre-deployment validation tests
  --skip-smoke          Skip smoke tests
  --skip-verification   Skip comprehensive verification tests
  --skip-monitoring     Skip monitoring tests
  --skip-api            Skip API functionality tests
  --skip-performance    Skip performance tests
  --skip-integration    Skip integration tests
  --skip-rollback       Skip rollback readiness tests
  --quick               Run only essential tests
  --report-only         Generate report from previous test results
  --help                Show this help message

Examples:
  $0                                    # Run all tests
  $0 --url https://api.stapelwerk.com # Test production deployment
  $0 --quick                           # Run essential tests only
  $0 --skip-performance                # Skip performance tests
  $0 --report-only                     # Generate report only

Exit Codes:
  0 - All tests passed
  1 - Tests passed with warnings
  2 - Tests failed (not production ready)

EOF
}

# Main function
main() {
    local skip_pre_deployment=false
    local skip_smoke=false
    local skip_verification=false
    local skip_monitoring=false
    local skip_api=false
    local skip_performance=false
    local skip_integration=false
    local skip_rollback=false
    local quick_mode=false
    local report_only=false
    
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
            --skip-pre-deployment)
                skip_pre_deployment=true
                shift
                ;;
            --skip-smoke)
                skip_smoke=true
                shift
                ;;
            --skip-verification)
                skip_verification=true
                shift
                ;;
            --skip-monitoring)
                skip_monitoring=true
                shift
                ;;
            --skip-api)
                skip_api=true
                shift
                ;;
            --skip-performance)
                skip_performance=true
                shift
                ;;
            --skip-integration)
                skip_integration=true
                shift
                ;;
            --skip-rollback)
                skip_rollback=true
                shift
                ;;
            --quick)
                quick_mode=true
                skip_performance=true
                skip_integration=true
                shift
                ;;
            --report-only)
                report_only=true
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
    
    log "HEADER" "🚀 Starting Stapelwerk AI Deployment Test Suite"
    log "INFO" "Base URL: $BASE_URL"
    log "INFO" "Namespace: $DEFAULT_NAMESPACE"
    log "INFO" "Timeout: ${DEFAULT_TIMEOUT}s"
    log "INFO" "Test log: $TEST_LOG"
    
    if [[ "$report_only" == "true" ]]; then
        log "INFO" "Report-only mode - generating HTML report..."
        generate_html_report
        exit 0
    fi
    
    # Run test suites
    local start_time=$(date +%s)
    
    if [[ "$skip_pre_deployment" != "true" ]]; then
        run_pre_deployment_tests
    fi
    
    if [[ "$skip_smoke" != "true" ]]; then
        run_smoke_tests
    fi
    
    if [[ "$skip_verification" != "true" ]]; then
        run_verification_tests
    fi
    
    if [[ "$skip_monitoring" != "true" ]]; then
        run_monitoring_tests
    fi
    
    if [[ "$skip_api" != "true" ]]; then
        run_api_tests
    fi
    
    if [[ "$skip_performance" != "true" ]]; then
        run_performance_tests
    fi
    
    if [[ "$skip_integration" != "true" ]]; then
        run_integration_tests
    fi
    
    if [[ "$skip_rollback" != "true" ]]; then
        run_rollback_tests
    fi
    
    local end_time=$(date +%s)
    local total_duration=$((end_time - start_time))
    
    log "INFO" "Total test execution time: ${total_duration}s"
    
    # Generate reports
    generate_html_report
    
    # Generate summary and exit
    generate_summary
    local exit_code=$?
    
    log "INFO" "Test execution completed"
    log "INFO" "Test log: $TEST_LOG"
    log "INFO" "HTML report: $REPORT_FILE"
    
    exit $exit_code
}

# Run main function with all arguments
main "$@"