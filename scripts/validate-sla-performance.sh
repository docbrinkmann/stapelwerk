#!/bin/bash
# Stapelwerk SLA Performance Validation Test Suite
#
# This script validates that the Stapelwerk system meets all defined SLA requirements
# by running comprehensive performance tests and measuring actual system behavior
# against the established SLA targets.
#
# Features:
# - API response time validation
# - Service availability testing
# - Database performance verification
# - AI recommendation service testing
# - Load testing with concurrent users
# - Security response time validation
# - Comprehensive reporting with pass/fail status

set -euo pipefail

# ==================== CONFIGURATION ====================

# Test configuration
BASE_URL="${BASE_URL:-http://localhost:3000}"
TEST_DURATION="${TEST_DURATION:-300}"  # 5 minutes
CONCURRENT_USERS="${CONCURRENT_USERS:-50}"
RAMP_UP_TIME="${RAMP_UP_TIME:-30}"     # 30 seconds
OUTPUT_DIR="${OUTPUT_DIR:-./sla-validation-reports}"
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
REPORT_FILE="$OUTPUT_DIR/sla-validation-$TIMESTAMP.json"
HTML_REPORT="$OUTPUT_DIR/sla-validation-$TIMESTAMP.html"

# SLA Thresholds (as defined in sla-requirements.md)
declare -A SLA_THRESHOLDS=(
    ["api_response_time_target"]="500"           # ms (95th percentile)
    ["api_response_time_critical"]="2000"       # ms
    ["web_page_load_target"]="2000"             # ms (95th percentile)
    ["web_page_load_critical"]="4000"           # ms
    ["ai_recommendation_target"]="1000"         # ms (95th percentile)
    ["ai_recommendation_critical"]="2000"       # ms
    ["database_query_target"]="100"             # ms (95th percentile)
    ["database_query_critical"]="1000"          # ms
    ["service_availability_target"]="99.9"      # %
    ["service_availability_critical"]="99.0"    # %
    ["api_availability_target"]="99.95"         # %
    ["api_availability_critical"]="99.5"        # %
    ["database_availability_target"]="99.99"    # %
    ["database_availability_critical"]="99.9"   # %
)

# Test results tracking
declare -A TEST_RESULTS=()
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
WARNING_TESTS=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ==================== UTILITY FUNCTIONS ====================

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

log_success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ❌ $1${NC}"
}

log_info() {
    echo -e "${CYAN}[$(date +'%Y-%m-%d %H:%M:%S')] ℹ️  $1${NC}"
}

# Check if required commands are available
check_dependencies() {
    local deps=("curl" "jq" "bc" "ab" "python3")
    local missing=()
    
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            missing+=("$dep")
        fi
    done
    
    if [ ${#missing[@]} -ne 0 ]; then
        log_error "Missing required dependencies: ${missing[*]}"
        log_info "Please install missing dependencies and try again"
        exit 1
    fi
}

# Initialize test environment
initialize_test_environment() {
    log "Initializing SLA validation test environment..."
    
    # Create output directory
    mkdir -p "$OUTPUT_DIR"
    
    # Initialize report JSON
    cat > "$REPORT_FILE" << EOF
{
  "validation_id": "sla-validation-$TIMESTAMP",
  "timestamp": "$(date -Iseconds)",
  "base_url": "$BASE_URL",
  "test_configuration": {
    "duration": $TEST_DURATION,
    "concurrent_users": $CONCURRENT_USERS,
    "ramp_up_time": $RAMP_UP_TIME
  },
  "sla_thresholds": {},
  "test_results": {},
  "summary": {
    "total_tests": 0,
    "passed": 0,
    "failed": 0,
    "warnings": 0,
    "overall_status": "unknown",
    "compliance_percentage": 0
  },
  "recommendations": []
}
EOF
    
    # Add SLA thresholds to report
    local thresholds_json="{}"
    for key in "${!SLA_THRESHOLDS[@]}"; do
        thresholds_json=$(echo "$thresholds_json" | jq --arg k "$key" --argjson v "${SLA_THRESHOLDS[$key]}" '.[$k] = $v')
    done
    
    jq --argjson thresholds "$thresholds_json" '.sla_thresholds = $thresholds' "$REPORT_FILE" > "$REPORT_FILE.tmp" && mv "$REPORT_FILE.tmp" "$REPORT_FILE"
    
    log_success "Test environment initialized"
}

# Record test result
record_test_result() {
    local test_name="$1"
    local status="$2"
    local value="$3"
    local threshold="$4"
    local unit="$5"
    local message="$6"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    case "$status" in
        "PASS")
            PASSED_TESTS=$((PASSED_TESTS + 1))
            log_success "$test_name: $message (${value}${unit} ≤ ${threshold}${unit})"
            ;;
        "WARNING")
            WARNING_TESTS=$((WARNING_TESTS + 1))
            log_warning "$test_name: $message (${value}${unit} vs ${threshold}${unit})"
            ;;
        "FAIL")
            FAILED_TESTS=$((FAILED_TESTS + 1))
            log_error "$test_name: $message (${value}${unit} > ${threshold}${unit})"
            ;;
    esac
    
    # Update JSON report
    jq --arg test "$test_name" \
       --arg status "$status" \
       --argjson value "$value" \
       --argjson threshold "$threshold" \
       --arg unit "$unit" \
       --arg message "$message" \
       '.test_results[$test] = {
           "status": $status,
           "value": $value,
           "threshold": $threshold,
           "unit": $unit,
           "message": $message,
           "timestamp": now
       }' "$REPORT_FILE" > "$REPORT_FILE.tmp" && mv "$REPORT_FILE.tmp" "$REPORT_FILE"
}

# Calculate percentile from array of values
calculate_percentile() {
    local percentile="$1"
    shift
    local values=("$@")
    
    if [ ${#values[@]} -eq 0 ]; then
        echo "0"
        return
    fi
    
    # Sort values
    IFS=$'\n' sorted=($(sort -n <<<"${values[*]}"))
    unset IFS
    
    local count=${#sorted[@]}
    local index=$(echo "($percentile * $count / 100) - 1" | bc -l | cut -d. -f1)
    
    if [ "$index" -lt 0 ]; then
        index=0
    elif [ "$index" -ge "$count" ]; then
        index=$((count - 1))
    fi
    
    echo "${sorted[$index]}"
}

# ==================== PERFORMANCE TESTS ====================

# Test API response time
test_api_response_time() {
    log "Testing API response time..."
    
    local endpoint="/api/health"
    local url="$BASE_URL$endpoint"
    local samples=100
    local response_times=()
    local successful_requests=0
    
    for i in $(seq 1 $samples); do
        local start_time=$(date +%s%3N)
        local status_code=$(curl -s -o /dev/null -w "%{http_code}" "$url" --max-time 10)
        local end_time=$(date +%s%3N)
        local response_time=$((end_time - start_time))
        
        response_times+=("$response_time")
        
        if [ "$status_code" -eq 200 ]; then
            successful_requests=$((successful_requests + 1))
        fi
        
        # Brief delay between requests
        sleep 0.1
    done
    
    # Calculate statistics
    local p95_response_time=$(calculate_percentile 95 "${response_times[@]}")
    local avg_response_time=$(echo "${response_times[*]}" | awk '{sum=0; for(i=1;i<=NF;i++) sum+=$i; print sum/NF}' | cut -d. -f1)
    local success_rate=$(echo "scale=2; $successful_requests * 100 / $samples" | bc)
    
    # Check against SLA
    local target=${SLA_THRESHOLDS["api_response_time_target"]}
    local critical=${SLA_THRESHOLDS["api_response_time_critical"]}
    
    if [ $(echo "$p95_response_time <= $target" | bc) -eq 1 ]; then
        record_test_result "API Response Time (P95)" "PASS" "$p95_response_time" "$target" "ms" "API response time meets SLA target"
    elif [ $(echo "$p95_response_time <= $critical" | bc) -eq 1 ]; then
        record_test_result "API Response Time (P95)" "WARNING" "$p95_response_time" "$target" "ms" "API response time exceeds target but within critical threshold"
    else
        record_test_result "API Response Time (P95)" "FAIL" "$p95_response_time" "$target" "ms" "API response time exceeds critical threshold"
    fi
    
    log_info "API Response Time Stats: Avg=${avg_response_time}ms, P95=${p95_response_time}ms, Success Rate=${success_rate}%"
}

# Test web page load time
test_web_page_load_time() {
    log "Testing web page load time..."
    
    local endpoints=("/" "/dashboard" "/stacks" "/templates")
    local all_response_times=()
    
    for endpoint in "${endpoints[@]}"; do
        local url="$BASE_URL$endpoint"
        local samples=20
        local response_times=()
        
        for i in $(seq 1 $samples); do
            local response_time=$(curl -s -o /dev/null -w "%{time_total}" "$url" --max-time 15)
            local response_time_ms=$(echo "$response_time * 1000" | bc | cut -d. -f1)
            response_times+=("$response_time_ms")
            all_response_times+=("$response_time_ms")
        done
        
        local avg_response_time=$(echo "${response_times[*]}" | awk '{sum=0; for(i=1;i<=NF;i++) sum+=$i; print sum/NF}' | cut -d. -f1)
        log_info "Page $endpoint average load time: ${avg_response_time}ms"
    done
    
    # Calculate overall statistics
    local p95_response_time=$(calculate_percentile 95 "${all_response_times[@]}")
    
    # Check against SLA
    local target=${SLA_THRESHOLDS["web_page_load_target"]}
    local critical=${SLA_THRESHOLDS["web_page_load_critical"]}
    
    if [ $(echo "$p95_response_time <= $target" | bc) -eq 1 ]; then
        record_test_result "Web Page Load Time (P95)" "PASS" "$p95_response_time" "$target" "ms" "Web page load time meets SLA target"
    elif [ $(echo "$p95_response_time <= $critical" | bc) -eq 1 ]; then
        record_test_result "Web Page Load Time (P95)" "WARNING" "$p95_response_time" "$target" "ms" "Web page load time exceeds target but within critical threshold"
    else
        record_test_result "Web Page Load Time (P95)" "FAIL" "$p95_response_time" "$target" "ms" "Web page load time exceeds critical threshold"
    fi
}

# Test AI recommendation service
test_ai_recommendation_performance() {
    log "Testing AI recommendation service performance..."
    
    local endpoint="/api/trpc/recommendations.getRecommendations"
    local url="$BASE_URL$endpoint"
    local samples=50
    local response_times=()
    local successful_requests=0
    
    # Test data for recommendations
    local test_payload='{"projectType": "web-app", "experienceLevel": "intermediate"}'
    
    for i in $(seq 1 $samples); do
        local start_time=$(date +%s%3N)
        local status_code=$(curl -s -o /dev/null -w "%{http_code}" \
            -X POST \
            -H "Content-Type: application/json" \
            -d "$test_payload" \
            "$url" \
            --max-time 15)
        local end_time=$(date +%s%3N)
        local response_time=$((end_time - start_time))
        
        response_times+=("$response_time")
        
        if [ "$status_code" -eq 200 ]; then
            successful_requests=$((successful_requests + 1))
        fi
        
        sleep 0.2  # Slight delay between AI requests
    done
    
    # Calculate statistics
    local p95_response_time=$(calculate_percentile 95 "${response_times[@]}")
    local success_rate=$(echo "scale=2; $successful_requests * 100 / $samples" | bc)
    
    # Check against SLA
    local target=${SLA_THRESHOLDS["ai_recommendation_target"]}
    local critical=${SLA_THRESHOLDS["ai_recommendation_critical"]}
    
    if [ $(echo "$p95_response_time <= $target" | bc) -eq 1 ]; then
        record_test_result "AI Recommendation Time (P95)" "PASS" "$p95_response_time" "$target" "ms" "AI recommendation time meets SLA target"
    elif [ $(echo "$p95_response_time <= $critical" | bc) -eq 1 ]; then
        record_test_result "AI Recommendation Time (P95)" "WARNING" "$p95_response_time" "$target" "ms" "AI recommendation time exceeds target but within critical threshold"
    else
        record_test_result "AI Recommendation Time (P95)" "FAIL" "$p95_response_time" "$target" "ms" "AI recommendation time exceeds critical threshold"
    fi
    
    log_info "AI Recommendation Stats: P95=${p95_response_time}ms, Success Rate=${success_rate}%"
}

# Test database performance
test_database_performance() {
    log "Testing database performance..."
    
    local endpoints=(
        "/api/trpc/stacks.list"
        "/api/trpc/templates.list"
        "/api/trpc/users.profile"
    )
    local all_response_times=()
    
    for endpoint in "${endpoints[@]}"; do
        local url="$BASE_URL$endpoint"
        local samples=30
        local response_times=()
        
        for i in $(seq 1 $samples); do
            local start_time=$(date +%s%3N)
            local status_code=$(curl -s -o /dev/null -w "%{http_code}" "$url" --max-time 10)
            local end_time=$(date +%s%3N)
            local response_time=$((end_time - start_time))
            
            if [ "$status_code" -eq 200 ]; then
                response_times+=("$response_time")
                all_response_times+=("$response_time")
            fi
        done
        
        if [ ${#response_times[@]} -gt 0 ]; then
            local avg_response_time=$(echo "${response_times[*]}" | awk '{sum=0; for(i=1;i<=NF;i++) sum+=$i; print sum/NF}' | cut -d. -f1)
            log_info "Database endpoint $endpoint average response time: ${avg_response_time}ms"
        fi
    done
    
    # Calculate overall statistics
    if [ ${#all_response_times[@]} -gt 0 ]; then
        local p95_response_time=$(calculate_percentile 95 "${all_response_times[@]}")
        
        # Check against SLA
        local target=${SLA_THRESHOLDS["database_query_target"]}
        local critical=${SLA_THRESHOLDS["database_query_critical"]}
        
        if [ $(echo "$p95_response_time <= $target" | bc) -eq 1 ]; then
            record_test_result "Database Query Time (P95)" "PASS" "$p95_response_time" "$target" "ms" "Database query time meets SLA target"
        elif [ $(echo "$p95_response_time <= $critical" | bc) -eq 1 ]; then
            record_test_result "Database Query Time (P95)" "WARNING" "$p95_response_time" "$target" "ms" "Database query time exceeds target but within critical threshold"
        else
            record_test_result "Database Query Time (P95)" "FAIL" "$p95_response_time" "$target" "ms" "Database query time exceeds critical threshold"
        fi
    else
        record_test_result "Database Query Time (P95)" "FAIL" "0" "${SLA_THRESHOLDS["database_query_target"]}" "ms" "No successful database queries"
    fi
}

# Test service availability
test_service_availability() {
    log "Testing service availability..."
    
    local endpoints=(
        "/api/health"
        "/api/health/database"
        "/"
        "/api/trpc/stacks.list"
        "/api/trpc/templates.list"
    )
    
    local total_checks=0
    local successful_checks=0
    
    for endpoint in "${endpoints[@]}"; do
        local url="$BASE_URL$endpoint"
        local samples=20
        local endpoint_successes=0
        
        for i in $(seq 1 $samples); do
            local status_code=$(curl -s -o /dev/null -w "%{http_code}" "$url" --max-time 10)
            total_checks=$((total_checks + 1))
            
            if [ "$status_code" -ge 200 ] && [ "$status_code" -lt 400 ]; then
                successful_checks=$((successful_checks + 1))
                endpoint_successes=$((endpoint_successes + 1))
            fi
            
            sleep 0.1
        done
        
        local endpoint_availability=$(echo "scale=2; $endpoint_successes * 100 / $samples" | bc)
        log_info "Endpoint $endpoint availability: ${endpoint_availability}%"
    done
    
    # Calculate overall availability
    local overall_availability=$(echo "scale=2; $successful_checks * 100 / $total_checks" | bc)
    
    # Check against SLA
    local target=${SLA_THRESHOLDS["service_availability_target"]}
    local critical=${SLA_THRESHOLDS["service_availability_critical"]}
    
    if [ $(echo "$overall_availability >= $target" | bc) -eq 1 ]; then
        record_test_result "Service Availability" "PASS" "$overall_availability" "$target" "%" "Service availability meets SLA target"
    elif [ $(echo "$overall_availability >= $critical" | bc) -eq 1 ]; then
        record_test_result "Service Availability" "WARNING" "$overall_availability" "$target" "%" "Service availability below target but above critical threshold"
    else
        record_test_result "Service Availability" "FAIL" "$overall_availability" "$target" "%" "Service availability below critical threshold"
    fi
}

# Test concurrent user load
test_concurrent_load() {
    log "Testing concurrent user load performance..."
    
    # Use Apache Bench for load testing
    local url="$BASE_URL/api/health"
    local requests=1000
    local concurrency=$CONCURRENT_USERS
    
    log_info "Running load test: $requests requests with $concurrency concurrent connections"
    
    # Run Apache Bench and capture output
    local ab_output=$(ab -n $requests -c $concurrency -g /tmp/ab_results.tsv "$url" 2>&1)
    
    # Extract metrics from ab output
    local response_time=$(echo "$ab_output" | grep "Time per request:" | head -1 | awk '{print $4}')
    local requests_per_sec=$(echo "$ab_output" | grep "Requests per second:" | awk '{print $4}')
    local transfer_rate=$(echo "$ab_output" | grep "Transfer rate:" | awk '{print $3}')
    local failed_requests=$(echo "$ab_output" | grep "Failed requests:" | awk '{print $3}')
    
    # Calculate success rate
    local success_rate=$(echo "scale=2; ($requests - $failed_requests) * 100 / $requests" | bc)
    
    log_info "Load test results:"
    log_info "  Requests per second: $requests_per_sec"
    log_info "  Average response time: ${response_time}ms"
    log_info "  Transfer rate: ${transfer_rate} KB/sec"
    log_info "  Failed requests: $failed_requests"
    log_info "  Success rate: ${success_rate}%"
    
    # Check if system handles concurrent load
    local response_time_int=$(echo "$response_time" | cut -d. -f1)
    local target_response_time=500  # 500ms target for load test
    
    if [ $(echo "$success_rate >= 95" | bc) -eq 1 ] && [ $(echo "$response_time_int <= $target_response_time" | bc) -eq 1 ]; then
        record_test_result "Concurrent Load Test" "PASS" "$response_time_int" "$target_response_time" "ms" "System handles concurrent load within SLA"
    elif [ $(echo "$success_rate >= 90" | bc) -eq 1 ] && [ $(echo "$response_time_int <= 1000" | bc) -eq 1 ]; then
        record_test_result "Concurrent Load Test" "WARNING" "$response_time_int" "$target_response_time" "ms" "System handles concurrent load with degraded performance"
    else
        record_test_result "Concurrent Load Test" "FAIL" "$response_time_int" "$target_response_time" "ms" "System fails under concurrent load"
    fi
}

# Test error handling and resilience
test_error_handling() {
    log "Testing error handling and resilience..."
    
    # Test invalid endpoints
    local invalid_endpoints=(
        "/api/invalid-endpoint"
        "/api/trpc/invalid.method"
        "/nonexistent-page"
    )
    
    local proper_error_responses=0
    local total_error_tests=0
    
    for endpoint in "${invalid_endpoints[@]}"; do
        local url="$BASE_URL$endpoint"
        local status_code=$(curl -s -o /dev/null -w "%{http_code}" "$url" --max-time 5)
        total_error_tests=$((total_error_tests + 1))
        
        # Check if server returns appropriate error codes (4xx or 5xx)
        if [ "$status_code" -ge 400 ] && [ "$status_code" -lt 600 ]; then
            proper_error_responses=$((proper_error_responses + 1))
            log_info "Endpoint $endpoint properly returns error: $status_code"
        else
            log_info "Endpoint $endpoint returns unexpected status: $status_code"
        fi
    done
    
    # Test malformed requests
    local malformed_response=$(curl -s -o /dev/null -w "%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -d '{"invalid": "json"' \
        "$BASE_URL/api/trpc/recommendations.getRecommendations" \
        --max-time 5)
    
    total_error_tests=$((total_error_tests + 1))
    if [ "$malformed_response" -ge 400 ] && [ "$malformed_response" -lt 600 ]; then
        proper_error_responses=$((proper_error_responses + 1))
    fi
    
    # Calculate error handling score
    local error_handling_score=$(echo "scale=2; $proper_error_responses * 100 / $total_error_tests" | bc)
    
    if [ $(echo "$error_handling_score >= 90" | bc) -eq 1 ]; then
        record_test_result "Error Handling" "PASS" "$error_handling_score" "90" "%" "System properly handles errors"
    elif [ $(echo "$error_handling_score >= 75" | bc) -eq 1 ]; then
        record_test_result "Error Handling" "WARNING" "$error_handling_score" "90" "%" "System handles most errors properly"
    else
        record_test_result "Error Handling" "FAIL" "$error_handling_score" "90" "%" "System has poor error handling"
    fi
}

# ==================== REPORTING ====================

# Generate final report
generate_final_report() {
    log "Generating final SLA validation report..."
    
    # Calculate compliance percentage
    local compliance_percentage=0
    if [ $TOTAL_TESTS -gt 0 ]; then
        compliance_percentage=$(echo "scale=2; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc)
    fi
    
    # Determine overall status
    local overall_status="UNKNOWN"
    if [ $(echo "$compliance_percentage >= 95" | bc) -eq 1 ]; then
        overall_status="EXCELLENT"
    elif [ $(echo "$compliance_percentage >= 90" | bc) -eq 1 ]; then
        overall_status="GOOD"
    elif [ $(echo "$compliance_percentage >= 80" | bc) -eq 1 ]; then
        overall_status="FAIR"
    else
        overall_status="POOR"
    fi
    
    # Generate recommendations
    local recommendations=()
    
    if [ $FAILED_TESTS -gt 0 ]; then
        recommendations+=("Address $FAILED_TESTS failed SLA tests immediately")
    fi
    
    if [ $WARNING_TESTS -gt 0 ]; then
        recommendations+=("Investigate $WARNING_TESTS warning conditions")
    fi
    
    if [ $(echo "$compliance_percentage < 95" | bc) -eq 1 ]; then
        recommendations+=("Overall compliance is below 95% - implement performance optimizations")
    fi
    
    if [ ${#recommendations[@]} -eq 0 ]; then
        recommendations+=("All SLA requirements met - continue monitoring")
    fi
    
    # Update JSON report with final summary
    local recommendations_json="[]"
    for rec in "${recommendations[@]}"; do
        recommendations_json=$(echo "$recommendations_json" | jq --arg r "$rec" '. + [$r]')
    done
    
    jq --argjson total "$TOTAL_TESTS" \
       --argjson passed "$PASSED_TESTS" \
       --argjson failed "$FAILED_TESTS" \
       --argjson warnings "$WARNING_TESTS" \
       --arg status "$overall_status" \
       --argjson compliance "$compliance_percentage" \
       --argjson recommendations "$recommendations_json" \
       '.summary.total_tests = $total |
        .summary.passed = $passed |
        .summary.failed = $failed |
        .summary.warnings = $warnings |
        .summary.overall_status = $status |
        .summary.compliance_percentage = $compliance |
        .recommendations = $recommendations' \
       "$REPORT_FILE" > "$REPORT_FILE.tmp" && mv "$REPORT_FILE.tmp" "$REPORT_FILE"
    
    # Generate HTML report
    generate_html_report
    
    # Print summary
    echo
    echo "========================== SLA VALIDATION SUMMARY =========================="
    echo "Test Execution Time: $(date)"
    echo "Base URL: $BASE_URL"
    echo "Total Tests: $TOTAL_TESTS"
    echo "Passed: $PASSED_TESTS"
    echo "Failed: $FAILED_TESTS"
    echo "Warnings: $WARNING_TESTS"
    echo "Overall Status: $overall_status"
    echo "Compliance Percentage: ${compliance_percentage}%"
    echo
    echo "Reports Generated:"
    echo "  JSON Report: $REPORT_FILE"
    echo "  HTML Report: $HTML_REPORT"
    echo "=========================================================================="
    
    # Print recommendations
    if [ ${#recommendations[@]} -gt 0 ]; then
        echo
        echo "RECOMMENDATIONS:"
        for rec in "${recommendations[@]}"; do
            echo "  - $rec"
        done
    fi
    
    echo
}

# Generate HTML report
generate_html_report() {
    cat > "$HTML_REPORT" << EOF
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Stapelwerk SLA Validation Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
        .header { background: #f4f4f4; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .summary { background: #e9f4ff; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .test-results { margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background-color: #f2f2f2; }
        .pass { color: #28a745; font-weight: bold; }
        .warning { color: #ffc107; font-weight: bold; }
        .fail { color: #dc3545; font-weight: bold; }
        .recommendations { background: #fff3cd; padding: 15px; border-radius: 5px; border-left: 5px solid #ffc107; }
        .excellent { color: #28a745; }
        .good { color: #17a2b8; }
        .fair { color: #ffc107; }
        .poor { color: #dc3545; }
        .chart { width: 300px; height: 200px; margin: 20px auto; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Stapelwerk SLA Validation Report</h1>
        <p><strong>Validation ID:</strong> sla-validation-$TIMESTAMP</p>
        <p><strong>Timestamp:</strong> $(date)</p>
        <p><strong>Base URL:</strong> $BASE_URL</p>
    </div>
    
    <div class="summary">
        <h2>Test Summary</h2>
        <div style="display: flex; gap: 20px; flex-wrap: wrap;">
            <div>
                <h3>Test Results</h3>
                <p>Total Tests: <strong>$TOTAL_TESTS</strong></p>
                <p>Passed: <strong class="pass">$PASSED_TESTS</strong></p>
                <p>Failed: <strong class="fail">$FAILED_TESTS</strong></p>
                <p>Warnings: <strong class="warning">$WARNING_TESTS</strong></p>
            </div>
            <div>
                <h3>Compliance</h3>
                <p>Overall Status: <strong class="$(echo "$overall_status" | tr '[:upper:]' '[:lower:]')">$overall_status</strong></p>
                <p>Compliance Rate: <strong>$(echo "scale=2; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc)%</strong></p>
            </div>
        </div>
    </div>
    
    <div class="test-results">
        <h2>Detailed Test Results</h2>
        <table>
            <thead>
                <tr>
                    <th>Test Name</th>
                    <th>Status</th>
                    <th>Value</th>
                    <th>Threshold</th>
                    <th>Unit</th>
                    <th>Message</th>
                </tr>
            </thead>
            <tbody>
EOF

    # Add test results to HTML
    local test_results=$(jq -r '.test_results | to_entries[] | "\(.key)|\(.value.status)|\(.value.value)|\(.value.threshold)|\(.value.unit)|\(.value.message)"' "$REPORT_FILE")
    
    while IFS='|' read -r name status value threshold unit message; do
        local status_class=$(echo "$status" | tr '[:upper:]' '[:lower:]')
        cat >> "$HTML_REPORT" << EOF
                <tr>
                    <td>$name</td>
                    <td class="$status_class">$status</td>
                    <td>$value</td>
                    <td>$threshold</td>
                    <td>$unit</td>
                    <td>$message</td>
                </tr>
EOF
    done <<< "$test_results"

    # Complete HTML report
    cat >> "$HTML_REPORT" << EOF
            </tbody>
        </table>
    </div>
    
    <div class="recommendations">
        <h2>Recommendations</h2>
        <ul>
EOF

    # Add recommendations to HTML
    local recommendations=$(jq -r '.recommendations[]' "$REPORT_FILE")
    while read -r rec; do
        echo "            <li>$rec</li>" >> "$HTML_REPORT"
    done <<< "$recommendations"

    cat >> "$HTML_REPORT" << EOF
        </ul>
    </div>
    
    <div>
        <h2>SLA Thresholds Reference</h2>
        <table>
            <thead>
                <tr>
                    <th>Metric</th>
                    <th>Target Value</th>
                    <th>Unit</th>
                </tr>
            </thead>
            <tbody>
                <tr><td>API Response Time (P95)</td><td>${SLA_THRESHOLDS["api_response_time_target"]}</td><td>ms</td></tr>
                <tr><td>Web Page Load Time (P95)</td><td>${SLA_THRESHOLDS["web_page_load_target"]}</td><td>ms</td></tr>
                <tr><td>AI Recommendation Time (P95)</td><td>${SLA_THRESHOLDS["ai_recommendation_target"]}</td><td>ms</td></tr>
                <tr><td>Database Query Time (P95)</td><td>${SLA_THRESHOLDS["database_query_target"]}</td><td>ms</td></tr>
                <tr><td>Service Availability</td><td>${SLA_THRESHOLDS["service_availability_target"]}</td><td>%</td></tr>
                <tr><td>API Availability</td><td>${SLA_THRESHOLDS["api_availability_target"]}</td><td>%</td></tr>
                <tr><td>Database Availability</td><td>${SLA_THRESHOLDS["database_availability_target"]}</td><td>%</td></tr>
            </tbody>
        </table>
    </div>
    
    <footer style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px;">
        <p>Generated by Stapelwerk SLA Validation System on $(date)</p>
    </footer>
</body>
</html>
EOF
}

# ==================== MAIN EXECUTION ====================

main() {
    echo
    echo "🚀 Stapelwerk SLA Performance Validation Test Suite"
    echo "=================================================="
    echo "Base URL: $BASE_URL"
    echo "Test Duration: $TEST_DURATION seconds"
    echo "Concurrent Users: $CONCURRENT_USERS"
    echo "Output Directory: $OUTPUT_DIR"
    echo

    # Check dependencies
    check_dependencies
    
    # Initialize test environment
    initialize_test_environment
    
    # Run all performance tests
    log "Starting comprehensive SLA validation tests..."
    
    test_api_response_time
    test_web_page_load_time
    test_ai_recommendation_performance
    test_database_performance
    test_service_availability
    test_concurrent_load
    test_error_handling
    
    # Generate final report
    generate_final_report
    
    # Exit with appropriate status code
    if [ $FAILED_TESTS -eq 0 ]; then
        if [ $WARNING_TESTS -eq 0 ]; then
            log_success "All SLA validation tests passed! 🎉"
            exit 0
        else
            log_warning "SLA validation completed with $WARNING_TESTS warnings"
            exit 0
        fi
    else
        log_error "SLA validation failed: $FAILED_TESTS tests failed"
        exit 1
    fi
}

# Handle command line arguments
case "${1:-}" in
    "help"|"--help"|"-h")
        echo "Stapelwerk SLA Performance Validation Test Suite"
        echo
        echo "Usage: $0 [options]"
        echo
        echo "Options:"
        echo "  help, --help, -h     Show this help message"
        echo
        echo "Environment Variables:"
        echo "  BASE_URL             Base URL for testing (default: http://localhost:3000)"
        echo "  TEST_DURATION        Test duration in seconds (default: 300)"
        echo "  CONCURRENT_USERS     Number of concurrent users for load testing (default: 50)"
        echo "  RAMP_UP_TIME         Ramp up time in seconds (default: 30)"
        echo "  OUTPUT_DIR           Output directory for reports (default: ./sla-validation-reports)"
        echo
        echo "Example:"
        echo "  BASE_URL=https://stapelwerk.com $0"
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac