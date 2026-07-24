#!/bin/bash

# Deployment Monitoring and Health Check System
# Provides real-time monitoring during deployment with automatic rollback triggers
# Usage: ./deployment-monitor.sh [options]

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$PROJECT_DIR/logs/monitoring"
REPORTS_DIR="$PROJECT_DIR/reports/monitoring"

# Colors and formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Monitoring configuration
MONITOR_ID="monitor-$(date +%Y%m%d-%H%M%S)"
DEPLOYMENT_ENV="${DEPLOYMENT_ENV:-production}"
NAMESPACE="${NAMESPACE:-stapelwerk-prod}"
APP_URL="${APP_URL:-http://localhost:3000}"
HEALTH_CHECK_INTERVAL="${HEALTH_CHECK_INTERVAL:-30}" # seconds
ERROR_THRESHOLD="${ERROR_THRESHOLD:-5}" # consecutive errors
RESPONSE_TIME_THRESHOLD="${RESPONSE_TIME_THRESHOLD:-2000}" # milliseconds
CPU_THRESHOLD="${CPU_THRESHOLD:-80}" # percentage
MEMORY_THRESHOLD="${MEMORY_THRESHOLD:-80}" # percentage
DISK_THRESHOLD="${DISK_THRESHOLD:-85}" # percentage

# Monitoring state
MONITORING_ACTIVE=true
CONSECUTIVE_ERRORS=0
ALERT_COUNT=0
ROLLBACK_TRIGGERED=false
START_TIME=$(date +%s)

# Health metrics
declare -A HEALTH_METRICS=(
    [api_status]="unknown"
    [database_status]="unknown"
    [redis_status]="unknown"
    [response_time]=0
    [error_rate]=0
    [cpu_usage]=0
    [memory_usage]=0
    [disk_usage]=0
    [pod_count]=0
    [ready_pods]=0
)

# Initialize monitoring
init_monitoring() {
    echo -e "${BOLD}${BLUE}=== Stapelwerk Deployment Monitoring ===${NC}"
    echo -e "${CYAN}Monitor ID: $MONITOR_ID${NC}"
    echo -e "${CYAN}Environment: $DEPLOYMENT_ENV${NC}"
    echo -e "${CYAN}Namespace: $NAMESPACE${NC}"
    echo -e "${CYAN}Started: $(date)${NC}"
    echo

    # Create necessary directories
    mkdir -p "$LOG_DIR" "$REPORTS_DIR"
    
    # Initialize monitoring log
    local log_file="$LOG_DIR/${MONITOR_ID}.log"
    exec 1> >(tee -a "$log_file")
    exec 2> >(tee -a "$log_file" >&2)
    
    # Initialize monitoring report
    cat > "$REPORTS_DIR/${MONITOR_ID}.json" << EOF
{
  "monitorId": "$MONITOR_ID",
  "environment": "$DEPLOYMENT_ENV",
  "startTime": "$(date -Iseconds)",
  "status": "monitoring",
  "metrics": [],
  "alerts": [],
  "healthChecks": [],
  "rollbackTriggered": false
}
EOF
}

# Logging functions
log_info() {
    echo -e "${CYAN}[INFO]${NC} $(date '+%H:%M:%S') $1"
    update_monitoring_report "info" "$1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%H:%M:%S') $1"
    update_monitoring_report "success" "$1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $(date '+%H:%M:%S') $1"
    update_monitoring_report "warning" "$1"
    send_alert "warning" "$1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%H:%M:%S') $1"
    update_monitoring_report "error" "$1"
    send_alert "error" "$1"
    CONSECUTIVE_ERRORS=$((CONSECUTIVE_ERRORS + 1))
}

log_critical() {
    echo -e "${BOLD}${RED}[CRITICAL]${NC} $(date '+%H:%M:%S') $1"
    update_monitoring_report "critical" "$1"
    send_alert "critical" "$1"
}

# Update monitoring report
update_monitoring_report() {
    local level="$1"
    local message="$2"
    local timestamp=$(date -Iseconds)
    
    # Create temporary report update
    local temp_file="$REPORTS_DIR/${MONITOR_ID}.tmp"
    jq --arg level "$level" \
       --arg message "$message" \
       --arg timestamp "$timestamp" \
       --argjson metrics "$(echo "${HEALTH_METRICS[@]}" | jq -R 'split(" ") | map(split("=")) | map({key: .[0], value: .[1]}) | from_entries')" \
       --argjson rollbackTriggered "$ROLLBACK_TRIGGERED" \
       '.healthChecks += [{level: $level, message: $message, timestamp: $timestamp}] |
        .metrics = $metrics |
        .rollbackTriggered = $rollbackTriggered |
        .lastUpdated = $timestamp' \
       "$REPORTS_DIR/${MONITOR_ID}.json" > "$temp_file" 2>/dev/null || echo '{}' > "$temp_file"
    
    mv "$temp_file" "$REPORTS_DIR/${MONITOR_ID}.json" 2>/dev/null || true
}

# Send alerts
send_alert() {
    local severity="$1"
    local message="$2"
    local webhook_url="${SLACK_WEBHOOK_URL:-}"
    
    ALERT_COUNT=$((ALERT_COUNT + 1))
    
    # Send Slack notification
    if [[ -n "$webhook_url" ]]; then
        local color="warning"
        local emoji=":warning:"
        
        case "$severity" in
            "error"|"critical")
                color="danger"
                emoji=":rotating_light:"
                ;;
            "success")
                color="good"
                emoji=":white_check_mark:"
                ;;
        esac
        
        curl -X POST -H 'Content-type: application/json' \
            --data "{
                \"attachments\": [{
                    \"color\": \"$color\",
                    \"title\": \"$emoji Stapelwerk Deployment Alert\",
                    \"text\": \"$message\",
                    \"fields\": [
                        {\"title\": \"Environment\", \"value\": \"$DEPLOYMENT_ENV\", \"short\": true},
                        {\"title\": \"Severity\", \"value\": \"$severity\", \"short\": true},
                        {\"title\": \"Monitor ID\", \"value\": \"$MONITOR_ID\", \"short\": true},
                        {\"title\": \"Time\", \"value\": \"$(date)\", \"short\": true}
                    ],
                    \"ts\": $(date +%s)
                }]
            }" \
            "$webhook_url" &>/dev/null || true
    fi
    
    # Check if rollback should be triggered
    if [[ "$severity" == "critical" || $CONSECUTIVE_ERRORS -ge $ERROR_THRESHOLD ]]; then
        trigger_rollback "Health check failures exceeded threshold"
    fi
}

# Health check functions
check_api_health() {
    local start_time=$(date +%s%N)
    local response
    
    if response=$(curl -s -f -m 10 "$APP_URL/api/health" 2>/dev/null); then
        local end_time=$(date +%s%N)
        local response_time=$(( (end_time - start_time) / 1000000 ))
        
        HEALTH_METRICS[api_status]="healthy"
        HEALTH_METRICS[response_time]=$response_time
        
        if [[ $response_time -gt $RESPONSE_TIME_THRESHOLD ]]; then
            log_warning "High API response time: ${response_time}ms (threshold: ${RESPONSE_TIME_THRESHOLD}ms)"
        fi
        
        # Parse health response
        if command -v jq &>/dev/null && echo "$response" | jq -e . &>/dev/null; then
            local status=$(echo "$response" | jq -r '.status // "unknown"')
            if [[ "$status" != "ok" ]]; then
                log_error "API health check returned non-OK status: $status"
                return 1
            fi
        fi
        
        return 0
    else
        HEALTH_METRICS[api_status]="unhealthy"
        log_error "API health check failed - no response from $APP_URL/api/health"
        return 1
    fi
}

check_database_health() {
    if kubectl exec -n "$NAMESPACE" deployment/stapelwerk -- npm run db:health &>/dev/null; then
        HEALTH_METRICS[database_status]="healthy"
        return 0
    else
        HEALTH_METRICS[database_status]="unhealthy"
        log_error "Database health check failed"
        return 1
    fi
}

check_redis_health() {
    if kubectl exec -n "$NAMESPACE" deployment/redis -- redis-cli ping | grep -q "PONG"; then
        HEALTH_METRICS[redis_status]="healthy"
        return 0
    else
        HEALTH_METRICS[redis_status]="unhealthy"
        log_error "Redis health check failed"
        return 1
    fi
}

check_pod_health() {
    local ready_pods=$(kubectl get pods -n "$NAMESPACE" -l app=stapelwerk -o jsonpath='{.items[?(@.status.phase=="Running")].metadata.name}' | wc -w)
    local total_pods=$(kubectl get pods -n "$NAMESPACE" -l app=stapelwerk --no-headers | wc -l)
    
    HEALTH_METRICS[pod_count]=$total_pods
    HEALTH_METRICS[ready_pods]=$ready_pods
    
    if [[ $ready_pods -lt 1 ]]; then
        log_critical "No application pods are ready ($ready_pods/$total_pods)"
        return 1
    elif [[ $ready_pods -lt $total_pods ]]; then
        log_warning "Some application pods are not ready ($ready_pods/$total_pods)"
        return 1
    fi
    
    return 0
}

check_resource_usage() {
    # Check CPU usage
    local cpu_usage
    if cpu_usage=$(kubectl top pods -n "$NAMESPACE" -l app=stapelwerk --no-headers | awk '{sum+=$2} END {print int(sum)}' 2>/dev/null); then
        HEALTH_METRICS[cpu_usage]=$cpu_usage
        if [[ $cpu_usage -gt $CPU_THRESHOLD ]]; then
            log_warning "High CPU usage: ${cpu_usage}% (threshold: ${CPU_THRESHOLD}%)"
        fi
    fi
    
    # Check memory usage
    local memory_usage
    if memory_usage=$(kubectl top pods -n "$NAMESPACE" -l app=stapelwerk --no-headers | awk '{gsub(/Mi/,"",$3); sum+=$3} END {print int(sum/10)}' 2>/dev/null); then
        HEALTH_METRICS[memory_usage]=$memory_usage
        if [[ $memory_usage -gt $MEMORY_THRESHOLD ]]; then
            log_warning "High memory usage: ${memory_usage}% (threshold: ${MEMORY_THRESHOLD}%)"
        fi
    fi
    
    # Check disk usage (simplified)
    local disk_usage
    if disk_usage=$(df / | tail -1 | awk '{print int($5)}' 2>/dev/null); then
        HEALTH_METRICS[disk_usage]=$disk_usage
        if [[ $disk_usage -gt $DISK_THRESHOLD ]]; then
            log_warning "High disk usage: ${disk_usage}% (threshold: ${DISK_THRESHOLD}%)"
        fi
    fi
}

check_error_rate() {
    # Simple error rate check by examining recent logs
    local error_count=0
    
    if kubectl logs -n "$NAMESPACE" deployment/stapelwerk --tail=100 --since=5m 2>/dev/null | grep -i error | wc -l > /tmp/error_count; then
        error_count=$(cat /tmp/error_count)
        rm -f /tmp/error_count
    fi
    
    local error_rate=$((error_count * 100 / 100)) # Simplified percentage
    HEALTH_METRICS[error_rate]=$error_rate
    
    if [[ $error_rate -gt 10 ]]; then
        log_warning "High error rate detected: ${error_rate}% (${error_count} errors in last 5 minutes)"
    fi
}

# Comprehensive health check
perform_health_check() {
    log_info "Performing comprehensive health check..."
    
    local check_results=()
    
    # API health check
    if check_api_health; then
        check_results+=("api:pass")
    else
        check_results+=("api:fail")
    fi
    
    # Database health check
    if check_database_health; then
        check_results+=("database:pass")
    else
        check_results+=("database:fail")
    fi
    
    # Redis health check
    if check_redis_health; then
        check_results+=("redis:pass")
    else
        check_results+=("redis:fail")
    fi
    
    # Pod health check
    if check_pod_health; then
        check_results+=("pods:pass")
    else
        check_results+=("pods:fail")
    fi
    
    # Resource usage check
    check_resource_usage
    check_results+=("resources:checked")
    
    # Error rate check
    check_error_rate
    check_results+=("errors:checked")
    
    # Summary
    local failed_checks=0
    for result in "${check_results[@]}"; do
        if [[ "$result" == *":fail" ]]; then
            failed_checks=$((failed_checks + 1))
        fi
    done
    
    if [[ $failed_checks -eq 0 ]]; then
        log_success "All health checks passed"
        CONSECUTIVE_ERRORS=0
        return 0
    else
        log_error "Health check failed: $failed_checks checks failed"
        return 1
    fi
}

# Rollback trigger
trigger_rollback() {
    local reason="$1"
    
    if [[ "$ROLLBACK_TRIGGERED" == "true" ]]; then
        return 0 # Already triggered
    fi
    
    log_critical "TRIGGERING AUTOMATIC ROLLBACK: $reason"
    ROLLBACK_TRIGGERED=true
    
    # Send critical alert
    send_alert "critical" "Automatic rollback triggered: $reason"
    
    # Execute rollback if script exists
    if [[ -f "$SCRIPT_DIR/execute-production-deployment.sh" ]]; then
        log_info "Executing automatic rollback..."
        # This would typically call the rollback function from the deployment script
        # For now, we'll simulate it
        echo "ROLLBACK_TRIGGERED=true" > /tmp/deployment-rollback-trigger
    fi
    
    # Stop monitoring
    MONITORING_ACTIVE=false
    
    return 0
}

# Monitoring dashboard (real-time display)
show_dashboard() {
    clear
    echo -e "${BOLD}${BLUE}=== Stapelwerk Deployment Monitoring Dashboard ===${NC}"
    echo
    echo -e "${CYAN}Monitor ID:${NC} $MONITOR_ID"
    echo -e "${CYAN}Environment:${NC} $DEPLOYMENT_ENV"
    echo -e "${CYAN}Uptime:${NC} $(($(date +%s) - START_TIME))s"
    echo -e "${CYAN}Status:${NC} $([ "$MONITORING_ACTIVE" == "true" ] && echo -e "${GREEN}ACTIVE${NC}" || echo -e "${RED}INACTIVE${NC}")"
    echo
    
    echo -e "${BOLD}Health Status:${NC}"
    echo -e "  API:      $([ "${HEALTH_METRICS[api_status]}" == "healthy" ] && echo -e "${GREEN}HEALTHY${NC}" || echo -e "${RED}UNHEALTHY${NC}")"
    echo -e "  Database: $([ "${HEALTH_METRICS[database_status]}" == "healthy" ] && echo -e "${GREEN}HEALTHY${NC}" || echo -e "${RED}UNHEALTHY${NC}")"
    echo -e "  Redis:    $([ "${HEALTH_METRICS[redis_status]}" == "healthy" ] && echo -e "${GREEN}HEALTHY${NC}" || echo -e "${RED}UNHEALTHY${NC}")"
    echo
    
    echo -e "${BOLD}Metrics:${NC}"
    echo -e "  Response Time: ${HEALTH_METRICS[response_time]}ms"
    echo -e "  Error Rate:    ${HEALTH_METRICS[error_rate]}%"
    echo -e "  CPU Usage:     ${HEALTH_METRICS[cpu_usage]}%"
    echo -e "  Memory Usage:  ${HEALTH_METRICS[memory_usage]}%"
    echo -e "  Disk Usage:    ${HEALTH_METRICS[disk_usage]}%"
    echo
    
    echo -e "${BOLD}Pods:${NC}"
    echo -e "  Ready: ${HEALTH_METRICS[ready_pods]}/${HEALTH_METRICS[pod_count]}"
    echo
    
    echo -e "${BOLD}Alerts:${NC}"
    echo -e "  Total Alerts:        $ALERT_COUNT"
    echo -e "  Consecutive Errors:  $CONSECUTIVE_ERRORS"
    echo -e "  Rollback Triggered:  $([ "$ROLLBACK_TRIGGERED" == "true" ] && echo -e "${RED}YES${NC}" || echo -e "${GREEN}NO${NC}")"
    echo
    
    echo -e "${CYAN}Press Ctrl+C to stop monitoring${NC}"
}

# Cleanup function
cleanup_monitoring() {
    local exit_code=$?
    local end_time=$(date +%s)
    local duration=$((end_time - START_TIME))
    
    MONITORING_ACTIVE=false
    
    log_info "Monitoring stopped after ${duration}s"
    
    # Final report update
    update_monitoring_report "monitoring_end" "Monitoring ended after ${duration}s"
    
    echo
    echo -e "${BOLD}=== Monitoring Summary ===${NC}"
    echo -e "Monitor ID: ${CYAN}$MONITOR_ID${NC}"
    echo -e "Duration: ${CYAN}${duration}s${NC}"
    echo -e "Total Alerts: ${CYAN}$ALERT_COUNT${NC}"
    echo -e "Rollback Triggered: ${CYAN}$([ "$ROLLBACK_TRIGGERED" == "true" ] && echo "YES" || echo "NO")${NC}"
    echo
    echo -e "Reports available in: ${CYAN}$REPORTS_DIR${NC}"
    echo -e "Logs available in: ${CYAN}$LOG_DIR${NC}"
    
    return $exit_code
}

# Signal handlers
trap 'cleanup_monitoring' EXIT
trap 'log_info "Monitoring interrupted by user"; cleanup_monitoring' INT TERM

# Help function
show_help() {
    cat << EOF
Stapelwerk Deployment Monitoring System

Usage: $0 [options]

Options:
  --environment ENV         Deployment environment (default: production)
  --namespace NS           Kubernetes namespace (default: stapelwerk-prod)
  --app-url URL            Application URL for health checks (default: http://localhost:3000)
  --check-interval SEC     Health check interval in seconds (default: 30)
  --error-threshold N      Consecutive errors before rollback (default: 5)
  --response-threshold MS  Response time threshold in ms (default: 2000)
  --dashboard             Show real-time dashboard
  --help                  Show this help message

Environment Variables:
  SLACK_WEBHOOK_URL       Slack webhook for alerts
  DEPLOYMENT_EMAIL        Email for alerts

Examples:
  # Standard monitoring
  $0

  # Monitor with dashboard
  $0 --dashboard

  # Custom thresholds
  $0 --error-threshold 3 --response-threshold 1000
EOF
}

# Parse command line arguments
SHOW_DASHBOARD=false
while [[ $# -gt 0 ]]; do
    case $1 in
        --environment)
            DEPLOYMENT_ENV="$2"
            shift 2
            ;;
        --namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        --app-url)
            APP_URL="$2"
            shift 2
            ;;
        --check-interval)
            HEALTH_CHECK_INTERVAL="$2"
            shift 2
            ;;
        --error-threshold)
            ERROR_THRESHOLD="$2"
            shift 2
            ;;
        --response-threshold)
            RESPONSE_TIME_THRESHOLD="$2"
            shift 2
            ;;
        --dashboard)
            SHOW_DASHBOARD=true
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

# Main monitoring loop
main() {
    init_monitoring
    
    log_info "Starting deployment monitoring..."
    log_info "Check interval: ${HEALTH_CHECK_INTERVAL}s, Error threshold: $ERROR_THRESHOLD"
    
    while [[ "$MONITORING_ACTIVE" == "true" ]]; do
        if [[ "$SHOW_DASHBOARD" == "true" ]]; then
            show_dashboard
        fi
        
        perform_health_check
        
        sleep "$HEALTH_CHECK_INTERVAL"
    done
    
    return 0
}

# Execute main function
main "$@"
exit $?