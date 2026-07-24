#!/bin/bash

# Deployment Validation Orchestrator
# Coordinates all deployment validation phases with detailed reporting

set -e

# Script Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
VALIDATION_LOG="${PROJECT_ROOT}/logs/validation-$(date +%Y%m%d-%H%M%S).log"
VALIDATION_REPORT="${PROJECT_ROOT}/logs/validation-report-$(date +%Y%m%d-%H%M%S).json"

# Default Configuration
DEFAULT_BASE_URL="http://localhost:8080"
DEFAULT_NAMESPACE="stapelwerk"
DEFAULT_TIMEOUT=30

# Validation Results
TOTAL_PHASES=0
PASSED_PHASES=0
FAILED_PHASES=0
WARNING_PHASES=0
VALIDATION_RESULTS=()

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
    
    echo -e "${timestamp} [${level}] ${message}" | tee -a "${VALIDATION_LOG}"
    
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

# Record phase result
record_phase_result() {
    local phase_name=$1
    local status=$2
    local duration=$3
    local details=$4
    local exit_code=${5:-0}
    
    TOTAL_PHASES=$((TOTAL_PHASES + 1))
    
    case $status in
        "PASS")
            PASSED_PHASES=$((PASSED_PHASES + 1))
            log "SUCCESS" "✓ $phase_name completed successfully ($duration)"
            ;;
        "FAIL")
            FAILED_PHASES=$((FAILED_PHASES + 1))
            log "ERROR" "✗ $phase_name failed ($duration) - $details"
            ;;
        "WARN")
            WARNING_PHASES=$((WARNING_PHASES + 1))
            log "WARN" "⚠ $phase_name completed with warnings ($duration) - $details"
            ;;
    esac
    
    VALIDATION_RESULTS+=("$phase_name|$status|$duration|$details|$exit_code")
}

# Run validation phase with timeout
run_validation_phase() {
    local phase_name=$1
    local phase_command=$2
    local timeout=${3:-600}  # 10 minutes default
    
    log "HEADER" "Starting validation phase: $phase_name"
    
    local start_time=$(date +%s)
    local phase_output_file="${PROJECT_ROOT}/logs/${phase_name// /_}-phase-$$.tmp"
    local phase_exit_code=0
    
    # Run the phase with timeout
    if timeout "$timeout" bash -c "$phase_command" > "$phase_output_file" 2>&1; then
        phase_exit_code=0
    else
        phase_exit_code=$?
        if [[ $phase_exit_code -eq 124 ]]; then
            phase_exit_code=2  # Timeout
        fi
    fi
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    local duration_str="${duration}s"
    
    # Read phase output
    local phase_output=""
    if [[ -f "$phase_output_file" ]]; then
        phase_output=$(tail -n 5 "$phase_output_file" | tr '\n' ' ')
        rm -f "$phase_output_file"
    fi
    
    # Determine phase result
    case $phase_exit_code in
        0)
            record_phase_result "$phase_name" "PASS" "$duration_str" "completed successfully" "$phase_exit_code"
            ;;
        1)
            record_phase_result "$phase_name" "WARN" "$duration_str" "completed with warnings" "$phase_exit_code"
            ;;
        2)
            record_phase_result "$phase_name" "FAIL" "$duration_str" "timeout after ${timeout}s" "$phase_exit_code"
            ;;
        124)
            record_phase_result "$phase_name" "FAIL" "$duration_str" "timeout" "$phase_exit_code"
            ;;
        *)
            record_phase_result "$phase_name" "FAIL" "$duration_str" "exit code $phase_exit_code" "$phase_exit_code"
            ;;
    esac
    
    return $phase_exit_code
}

# Phase 1: Pre-deployment validation
run_pre_deployment_phase() {
    log "HEADER" "=== Phase 1: Pre-Deployment Validation ==="
    
    run_validation_phase "Pre-Deployment Environment Check" \
        "$SCRIPT_DIR/validate-production-env.sh --check-all" \
        300
}

# Phase 2: Deployment readiness
run_deployment_readiness_phase() {
    log "HEADER" "=== Phase 2: Deployment Readiness ==="
    
    run_validation_phase "Deployment Scripts Validation" \
        "test -x $SCRIPT_DIR/deploy-production.sh && $SCRIPT_DIR/deploy-production.sh --validate" \
        120
    
    run_validation_phase "Configuration Validation" \
        "$SCRIPT_DIR/validate-production-env.sh --skip-connectivity --config-only" \
        60
    
    run_validation_phase "Security Prerequisites" \
        "$SCRIPT_DIR/validate-production-env.sh --security-only" \
        120
}

# Phase 3: Basic health validation
run_basic_health_phase() {
    log "HEADER" "=== Phase 3: Basic Health Validation ==="
    
    run_validation_phase "Service Availability Check" \
        "curl -f $BASE_URL/health -m 30" \
        60
    
    run_validation_phase "API Endpoints Health" \
        "curl -f $BASE_URL/api/health -m 30 && curl -f $BASE_URL/api/health/database -m 30" \
        120
    
    run_validation_phase "Basic Smoke Tests" \
        "$SCRIPT_DIR/run-smoke-tests.sh --url $BASE_URL --quick" \
        300
}

# Phase 4: Comprehensive verification
run_comprehensive_verification_phase() {
    log "HEADER" "=== Phase 4: Comprehensive Verification ==="
    
    run_validation_phase "Full Deployment Verification" \
        "$SCRIPT_DIR/verify-deployment.sh --url $BASE_URL --namespace $DEFAULT_NAMESPACE" \
        900
    
    run_validation_phase "Performance Baseline" \
        "$SCRIPT_DIR/verify-deployment.sh --url $BASE_URL --performance-only" \
        300
    
    run_validation_phase "Security Verification" \
        "$SCRIPT_DIR/verify-deployment.sh --url $BASE_URL --security-only" \
        300
}

# Phase 5: Integration testing
run_integration_testing_phase() {
    log "HEADER" "=== Phase 5: Integration Testing ==="
    
    run_validation_phase "Database Integration" \
        "curl -f $BASE_URL/api/health/database -m 30 | grep -q 'connected'" \
        60
    
    run_validation_phase "Cache Integration" \
        "curl -f $BASE_URL/api/health/cache -m 30 | grep -q 'connected'" \
        60
    
    run_validation_phase "External Services Integration" \
        "$SCRIPT_DIR/run-deployment-tests.sh --url $BASE_URL --skip-performance --skip-rollback" \
        600
}

# Phase 6: Load and performance testing
run_performance_testing_phase() {
    log "HEADER" "=== Phase 6: Load and Performance Testing ==="
    
    run_validation_phase "Response Time Validation" \
        "for i in {1..20}; do curl -w '%{time_total}\\n' -o /dev/null -s $BASE_URL/health; done | awk '{sum+=\$1} END {if (sum/NR > 2) exit 1}'" \
        180
    
    run_validation_phase "Concurrent Load Test" \
        "seq 1 50 | xargs -P 10 -I {} curl -f $BASE_URL/health -m 5 > /dev/null" \
        300
    
    run_validation_phase "Sustained Load Test" \
        "for i in {1..100}; do curl -f $BASE_URL/health -m 3 > /dev/null || exit 1; sleep 0.1; done" \
        180
}

# Phase 7: Monitoring and observability
run_monitoring_phase() {
    log "HEADER" "=== Phase 7: Monitoring and Observability ==="
    
    run_validation_phase "Metrics Endpoint Validation" \
        "curl -f $BASE_URL/metrics -m 30 | grep -q 'stapelwerk'" \
        60
    
    run_validation_phase "Health Endpoints Coverage" \
        "curl -f $BASE_URL/health && curl -f $BASE_URL/api/health && curl -f $BASE_URL/api/health/database && curl -f $BASE_URL/api/health/cache" \
        120
    
    run_validation_phase "Feature Flags Validation" \
        "curl -f $BASE_URL/api/feature-flags -m 30 | grep -q 'flags'" \
        60
    
    # Check for Kubernetes monitoring (if applicable)
    if command -v kubectl &> /dev/null && kubectl get namespace "$DEFAULT_NAMESPACE" &> /dev/null 2>&1; then
        run_validation_phase "Kubernetes Resources Monitoring" \
            "kubectl get pods,services,deployments -n $DEFAULT_NAMESPACE" \
            120
    fi
}

# Phase 8: Rollback readiness
run_rollback_readiness_phase() {
    log "HEADER" "=== Phase 8: Rollback Readiness ==="
    
    run_validation_phase "Rollback Scripts Availability" \
        "test -x $SCRIPT_DIR/deploy-production.sh" \
        30
    
    run_validation_phase "Rollback Triggers Configuration" \
        "$SCRIPT_DIR/verify-deployment.sh --check-rollback --url $BASE_URL" \
        120
    
    run_validation_phase "Feature Flag Controls" \
        "curl -f $BASE_URL/api/feature-flags -m 30" \
        60
    
    # Check rollout history (if Kubernetes)
    if command -v kubectl &> /dev/null && kubectl get deployment stapelwerk-ai -n "$DEFAULT_NAMESPACE" &> /dev/null 2>&1; then
        run_validation_phase "Kubernetes Rollout History" \
            "kubectl rollout history deployment/stapelwerk-ai -n $DEFAULT_NAMESPACE" \
            60
    fi
}

# Generate JSON validation report
generate_json_report() {
    log "INFO" "Generating JSON validation report..."
    
    local pass_rate=0
    if [[ $TOTAL_PHASES -gt 0 ]]; then
        pass_rate=$((PASSED_PHASES * 100 / TOTAL_PHASES))
    fi
    
    local overall_status="FAILED"
    if [[ $FAILED_PHASES -eq 0 ]]; then
        if [[ $WARNING_PHASES -eq 0 ]]; then
            overall_status="PASSED"
        else
            overall_status="PASSED_WITH_WARNINGS"
        fi
    fi
    
    cat > "$VALIDATION_REPORT" << EOF
{
  "validation_report": {
    "generated_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "base_url": "$BASE_URL",
    "namespace": "$DEFAULT_NAMESPACE",
    "overall_status": "$overall_status",
    "summary": {
      "total_phases": $TOTAL_PHASES,
      "passed_phases": $PASSED_PHASES,
      "failed_phases": $FAILED_PHASES,
      "warning_phases": $WARNING_PHASES,
      "pass_rate_percent": $pass_rate
    },
    "phases": [
EOF
    
    local first_result=true
    for result in "${VALIDATION_RESULTS[@]}"; do
        IFS='|' read -r phase_name status duration details exit_code <<< "$result"
        
        if [[ "$first_result" != "true" ]]; then
            echo "," >> "$VALIDATION_REPORT"
        fi
        first_result=false
        
        cat >> "$VALIDATION_REPORT" << EOF
      {
        "phase_name": "$phase_name",
        "status": "$status",
        "duration": "$duration",
        "details": "$details",
        "exit_code": $exit_code
      }
EOF
    done
    
    cat >> "$VALIDATION_REPORT" << EOF
    ],
    "recommendations": [
EOF
    
    # Add recommendations based on results
    local rec_added=false
    
    if [[ $FAILED_PHASES -gt 0 ]]; then
        if [[ "$rec_added" == "true" ]]; then
            echo "," >> "$VALIDATION_REPORT"
        fi
        echo "      \"Critical failures detected - deployment not recommended\"" >> "$VALIDATION_REPORT"
        rec_added=true
    fi
    
    if [[ $WARNING_PHASES -gt 0 ]]; then
        if [[ "$rec_added" == "true" ]]; then
            echo "," >> "$VALIDATION_REPORT"
        fi
        echo "      \"Warnings detected - review issues before production deployment\"" >> "$VALIDATION_REPORT"
        rec_added=true
    fi
    
    if [[ $pass_rate -lt 90 ]] && [[ $FAILED_PHASES -gt 0 ]]; then
        if [[ "$rec_added" == "true" ]]; then
            echo "," >> "$VALIDATION_REPORT"
        fi
        echo "      \"Pass rate below 90% - consider additional testing\"" >> "$VALIDATION_REPORT"
        rec_added=true
    fi
    
    if [[ $FAILED_PHASES -eq 0 ]] && [[ $WARNING_PHASES -eq 0 ]]; then
        echo "      \"All validations passed - deployment is production ready\"" >> "$VALIDATION_REPORT"
        rec_added=true
    fi
    
    cat >> "$VALIDATION_REPORT" << EOF
    ],
    "logs": {
      "validation_log": "$VALIDATION_LOG",
      "report_location": "$VALIDATION_REPORT"
    }
  }
}
EOF
    
    log "SUCCESS" "JSON validation report generated: $VALIDATION_REPORT"
}

# Generate validation summary
generate_validation_summary() {
    log "HEADER" "=== Deployment Validation Summary ==="
    
    local pass_rate=0
    if [[ $TOTAL_PHASES -gt 0 ]]; then
        pass_rate=$((PASSED_PHASES * 100 / TOTAL_PHASES))
    fi
    
    log "INFO" "Total validation phases: $TOTAL_PHASES"
    log "INFO" "Phases passed: $PASSED_PHASES"
    log "INFO" "Phases failed: $FAILED_PHASES"
    log "INFO" "Phases with warnings: $WARNING_PHASES"
    log "INFO" "Overall pass rate: ${pass_rate}%"
    
    echo ""
    log "HEADER" "=== Deployment Recommendation ==="
    
    if [[ $FAILED_PHASES -eq 0 ]]; then
        if [[ $WARNING_PHASES -eq 0 ]]; then
            log "SUCCESS" "🎉 ALL VALIDATION PHASES PASSED"
            log "SUCCESS" "✅ DEPLOYMENT IS PRODUCTION READY"
            return 0
        else
            log "SUCCESS" "✅ VALIDATION PASSED WITH WARNINGS"
            log "WARN" "⚠️ Review warning issues before deployment"
            return 0
        fi
    elif [[ $pass_rate -ge 80 ]]; then
        log "WARN" "⚠️ VALIDATION COMPLETED WITH FAILURES"
        log "WARN" "Pass rate: ${pass_rate}% - PROCEED WITH EXTREME CAUTION"
        return 1
    else
        log "ERROR" "❌ VALIDATION FAILED"
        log "ERROR" "Pass rate: ${pass_rate}% - DEPLOYMENT NOT RECOMMENDED"
        return 2
    fi
}

# Show usage
show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Comprehensive deployment validation orchestrator for Stapelwerk AI Recommendations.

Options:
  --url URL              Base URL of the deployed application (default: http://localhost:8080)
  --namespace NAMESPACE  Kubernetes namespace (default: stapelwerk)
  --timeout SECONDS      Default timeout for validation phases (default: 30)
  --skip-pre-deployment Skip pre-deployment validation phase
  --skip-readiness      Skip deployment readiness phase
  --skip-health         Skip basic health validation phase
  --skip-verification   Skip comprehensive verification phase
  --skip-integration    Skip integration testing phase
  --skip-performance    Skip performance testing phase
  --skip-monitoring     Skip monitoring validation phase
  --skip-rollback       Skip rollback readiness phase
  --quick               Run essential phases only
  --critical-only       Run only critical validation phases
  --report-only         Generate report from previous validation results
  --help                Show this help message

Examples:
  $0                                    # Run complete validation
  $0 --url https://api.stapelwerk.com # Validate production deployment
  $0 --quick                           # Run essential validations only
  $0 --critical-only                   # Run critical phases only
  $0 --skip-performance                # Skip performance testing

Exit Codes:
  0 - All validations passed
  1 - Validations passed with warnings
  2 - Validations failed (deployment not recommended)

EOF
}

# Main function
main() {
    local skip_pre_deployment=false
    local skip_readiness=false
    local skip_health=false
    local skip_verification=false
    local skip_integration=false
    local skip_performance=false
    local skip_monitoring=false
    local skip_rollback=false
    local quick_mode=false
    local critical_only=false
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
            --skip-readiness)
                skip_readiness=true
                shift
                ;;
            --skip-health)
                skip_health=true
                shift
                ;;
            --skip-verification)
                skip_verification=true
                shift
                ;;
            --skip-integration)
                skip_integration=true
                shift
                ;;
            --skip-performance)
                skip_performance=true
                shift
                ;;
            --skip-monitoring)
                skip_monitoring=true
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
            --critical-only)
                critical_only=true
                skip_integration=true
                skip_performance=true
                skip_monitoring=true
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
    
    log "HEADER" "🚀 Starting Stapelwerk AI Deployment Validation"
    log "INFO" "Base URL: $BASE_URL"
    log "INFO" "Namespace: $DEFAULT_NAMESPACE"
    log "INFO" "Validation log: $VALIDATION_LOG"
    
    if [[ "$report_only" == "true" ]]; then
        log "INFO" "Report-only mode - generating JSON report..."
        generate_json_report
        exit 0
    fi
    
    # Run validation phases
    local start_time=$(date +%s)
    
    if [[ "$skip_pre_deployment" != "true" ]]; then
        run_pre_deployment_phase
    fi
    
    if [[ "$skip_readiness" != "true" ]]; then
        run_deployment_readiness_phase
    fi
    
    if [[ "$skip_health" != "true" ]]; then
        run_basic_health_phase
    fi
    
    if [[ "$skip_verification" != "true" ]]; then
        run_comprehensive_verification_phase
    fi
    
    if [[ "$skip_integration" != "true" ]]; then
        run_integration_testing_phase
    fi
    
    if [[ "$skip_performance" != "true" ]]; then
        run_performance_testing_phase
    fi
    
    if [[ "$skip_monitoring" != "true" ]]; then
        run_monitoring_phase
    fi
    
    if [[ "$skip_rollback" != "true" ]]; then
        run_rollback_readiness_phase
    fi
    
    local end_time=$(date +%s)
    local total_duration=$((end_time - start_time))
    
    log "INFO" "Total validation time: ${total_duration}s"
    
    # Generate reports
    generate_json_report
    
    # Generate summary and exit
    generate_validation_summary
    local exit_code=$?
    
    log "INFO" "Validation completed"
    log "INFO" "Validation log: $VALIDATION_LOG"
    log "INFO" "JSON report: $VALIDATION_REPORT"
    
    exit $exit_code
}

# Run main function with all arguments
main "$@"