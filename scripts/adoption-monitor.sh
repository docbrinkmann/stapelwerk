#!/bin/bash

# User Adoption Monitoring System
# Tracks user adoption metrics, feature usage, and engagement with AI recommendations
# Usage: ./adoption-monitor.sh [options]

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
METRICS_DIR="$PROJECT_DIR/metrics/adoption"
REPORTS_DIR="$PROJECT_DIR/reports/adoption"
LOG_DIR="$PROJECT_DIR/logs/adoption"

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
MONITOR_ID="adoption-$(date +%Y%m%d-%H%M%S)"
DATABASE_URL="${DATABASE_URL:-}"
ENVIRONMENT="${ENVIRONMENT:-production}"
SAMPLE_PERIOD="${SAMPLE_PERIOD:-3600}" # 1 hour in seconds
REPORT_INTERVAL="${REPORT_INTERVAL:-86400}" # 24 hours in seconds

# Adoption metrics thresholds
MIN_DAILY_ACTIVE_USERS="${MIN_DAILY_ACTIVE_USERS:-10}"
MIN_RECOMMENDATION_ENGAGEMENT="${MIN_RECOMMENDATION_ENGAGEMENT:-0.15}" # 15%
MIN_TEMPLATE_ADOPTION="${MIN_TEMPLATE_ADOPTION:-0.05}" # 5%
MAX_CHURN_RATE="${MAX_CHURN_RATE:-0.2}" # 20%

# Initialize monitoring
init_adoption_monitoring() {
    echo -e "${BOLD}${BLUE}=== Stapelwerk Adoption Monitoring ===${NC}"
    echo -e "${CYAN}Monitor ID: $MONITOR_ID${NC}"
    echo -e "${CYAN}Environment: $ENVIRONMENT${NC}"
    echo -e "${CYAN}Started: $(date)${NC}"
    echo

    # Create necessary directories
    mkdir -p "$METRICS_DIR" "$REPORTS_DIR" "$LOG_DIR"
    
    # Initialize monitoring state
    cat > "$METRICS_DIR/current-state.json" << EOF
{
  "monitorId": "$MONITOR_ID",
  "environment": "$ENVIRONMENT",
  "startTime": "$(date -Iseconds)",
  "lastUpdate": "$(date -Iseconds)",
  "metrics": {
    "users": {
      "total": 0,
      "active_daily": 0,
      "active_weekly": 0,
      "active_monthly": 0,
      "new_signups": 0,
      "churned": 0
    },
    "recommendations": {
      "total_views": 0,
      "total_clicks": 0,
      "total_adoptions": 0,
      "engagement_rate": 0,
      "adoption_rate": 0
    },
    "templates": {
      "total_views": 0,
      "total_applications": 0,
      "unique_templates_used": 0,
      "adoption_rate": 0
    },
    "stacks": {
      "total_created": 0,
      "with_ai_recommendations": 0,
      "with_templates": 0,
      "average_services_per_stack": 0
    },
    "feature_flags": {
      "ai_recommendations": 0,
      "template_system": 0
    }
  },
  "alerts": [],
  "trends": {}
}
EOF
}

# Database query helpers
execute_query() {
    local query="$1"
    local default_value="${2:-0}"
    
    if [[ -z "$DATABASE_URL" ]]; then
        echo "$default_value"
        return
    fi
    
    # Use psql to execute query if PostgreSQL
    if command -v psql &>/dev/null && [[ "$DATABASE_URL" == postgres* ]]; then
        psql "$DATABASE_URL" -t -c "$query" 2>/dev/null | xargs || echo "$default_value"
    else
        echo "$default_value"
    fi
}

# Collect user metrics
collect_user_metrics() {
    echo "Collecting user metrics..."
    
    local total_users
    total_users=$(execute_query "SELECT COUNT(*) FROM users;")
    
    local daily_active_users
    daily_active_users=$(execute_query "
        SELECT COUNT(DISTINCT user_id) 
        FROM user_sessions 
        WHERE created_at >= NOW() - INTERVAL '24 hours';
    ")
    
    local weekly_active_users
    weekly_active_users=$(execute_query "
        SELECT COUNT(DISTINCT user_id) 
        FROM user_sessions 
        WHERE created_at >= NOW() - INTERVAL '7 days';
    ")
    
    local monthly_active_users
    monthly_active_users=$(execute_query "
        SELECT COUNT(DISTINCT user_id) 
        FROM user_sessions 
        WHERE created_at >= NOW() - INTERVAL '30 days';
    ")
    
    local new_signups
    new_signups=$(execute_query "
        SELECT COUNT(*) 
        FROM users 
        WHERE created_at >= NOW() - INTERVAL '24 hours';
    ")
    
    # Calculate churn (users who were active 30 days ago but not in last 7 days)
    local churned_users
    churned_users=$(execute_query "
        SELECT COUNT(DISTINCT u1.user_id)
        FROM user_sessions u1
        LEFT JOIN user_sessions u2 ON u1.user_id = u2.user_id 
            AND u2.created_at >= NOW() - INTERVAL '7 days'
        WHERE u1.created_at >= NOW() - INTERVAL '37 days' 
            AND u1.created_at < NOW() - INTERVAL '30 days'
            AND u2.user_id IS NULL;
    ")
    
    # Update metrics
    jq --argjson total "$total_users" \
       --argjson daily "$daily_active_users" \
       --argjson weekly "$weekly_active_users" \
       --argjson monthly "$monthly_active_users" \
       --argjson signups "$new_signups" \
       --argjson churned "$churned_users" \
       '.metrics.users = {
           total: $total,
           active_daily: $daily,
           active_weekly: $weekly,
           active_monthly: $monthly,
           new_signups: $signups,
           churned: $churned
       }' "$METRICS_DIR/current-state.json" > "$METRICS_DIR/temp.json" && \
       mv "$METRICS_DIR/temp.json" "$METRICS_DIR/current-state.json"
    
    echo "User metrics collected: $daily_active_users DAU, $weekly_active_users WAU, $monthly_active_users MAU"
}

# Collect recommendation metrics
collect_recommendation_metrics() {
    echo "Collecting recommendation metrics..."
    
    local total_views
    total_views=$(execute_query "
        SELECT COUNT(*) 
        FROM analytics_events 
        WHERE event_type = 'recommendation_view' 
            AND created_at >= NOW() - INTERVAL '24 hours';
    ")
    
    local total_clicks
    total_clicks=$(execute_query "
        SELECT COUNT(*) 
        FROM analytics_events 
        WHERE event_type = 'recommendation_click' 
            AND created_at >= NOW() - INTERVAL '24 hours';
    ")
    
    local total_adoptions
    total_adoptions=$(execute_query "
        SELECT COUNT(*) 
        FROM analytics_events 
        WHERE event_type = 'recommendation_adoption' 
            AND created_at >= NOW() - INTERVAL '24 hours';
    ")
    
    # Calculate rates
    local engagement_rate=0
    local adoption_rate=0
    
    if [[ $total_views -gt 0 ]]; then
        engagement_rate=$(echo "scale=4; $total_clicks / $total_views" | bc -l 2>/dev/null || echo "0")
        adoption_rate=$(echo "scale=4; $total_adoptions / $total_views" | bc -l 2>/dev/null || echo "0")
    fi
    
    # Update metrics
    jq --argjson views "$total_views" \
       --argjson clicks "$total_clicks" \
       --argjson adoptions "$total_adoptions" \
       --argjson engagement "$engagement_rate" \
       --argjson adoption "$adoption_rate" \
       '.metrics.recommendations = {
           total_views: $views,
           total_clicks: $clicks,
           total_adoptions: $adoptions,
           engagement_rate: $engagement,
           adoption_rate: $adoption
       }' "$METRICS_DIR/current-state.json" > "$METRICS_DIR/temp.json" && \
       mv "$METRICS_DIR/temp.json" "$METRICS_DIR/current-state.json"
    
    echo "Recommendation metrics: $total_views views, $total_clicks clicks, $total_adoptions adoptions"
}

# Collect template metrics
collect_template_metrics() {
    echo "Collecting template metrics..."
    
    local total_views
    total_views=$(execute_query "
        SELECT COUNT(*) 
        FROM analytics_events 
        WHERE event_type = 'template_view' 
            AND created_at >= NOW() - INTERVAL '24 hours';
    ")
    
    local total_applications
    total_applications=$(execute_query "
        SELECT COUNT(*) 
        FROM analytics_events 
        WHERE event_type = 'template_application' 
            AND created_at >= NOW() - INTERVAL '24 hours';
    ")
    
    local unique_templates_used
    unique_templates_used=$(execute_query "
        SELECT COUNT(DISTINCT event_data->>'templateId') 
        FROM analytics_events 
        WHERE event_type = 'template_application' 
            AND created_at >= NOW() - INTERVAL '24 hours';
    ")
    
    # Calculate adoption rate
    local template_adoption_rate=0
    if [[ $total_views -gt 0 ]]; then
        template_adoption_rate=$(echo "scale=4; $total_applications / $total_views" | bc -l 2>/dev/null || echo "0")
    fi
    
    # Update metrics
    jq --argjson views "$total_views" \
       --argjson applications "$total_applications" \
       --argjson unique "$unique_templates_used" \
       --argjson adoption "$template_adoption_rate" \
       '.metrics.templates = {
           total_views: $views,
           total_applications: $applications,
           unique_templates_used: $unique,
           adoption_rate: $adoption
       }' "$METRICS_DIR/current-state.json" > "$METRICS_DIR/temp.json" && \
       mv "$METRICS_DIR/temp.json" "$METRICS_DIR/current-state.json"
    
    echo "Template metrics: $total_views views, $total_applications applications, $unique_templates_used unique templates"
}

# Collect stack metrics
collect_stack_metrics() {
    echo "Collecting stack metrics..."
    
    local total_stacks
    total_stacks=$(execute_query "
        SELECT COUNT(*) 
        FROM stacks 
        WHERE created_at >= NOW() - INTERVAL '24 hours';
    ")
    
    local stacks_with_ai
    stacks_with_ai=$(execute_query "
        SELECT COUNT(*) 
        FROM stacks s
        JOIN analytics_events ae ON s.user_id = ae.user_id
        WHERE s.created_at >= NOW() - INTERVAL '24 hours'
            AND ae.event_type = 'recommendation_adoption'
            AND ae.created_at BETWEEN s.created_at - INTERVAL '1 hour' AND s.created_at + INTERVAL '1 hour';
    ")
    
    local stacks_with_templates
    stacks_with_templates=$(execute_query "
        SELECT COUNT(*) 
        FROM stacks s
        JOIN analytics_events ae ON s.user_id = ae.user_id
        WHERE s.created_at >= NOW() - INTERVAL '24 hours'
            AND ae.event_type = 'template_application'
            AND ae.created_at BETWEEN s.created_at - INTERVAL '1 hour' AND s.created_at + INTERVAL '1 hour';
    ")
    
    local avg_services_per_stack
    avg_services_per_stack=$(execute_query "
        SELECT COALESCE(AVG(service_count), 0)
        FROM (
            SELECT COUNT(ss.id) as service_count
            FROM stacks s
            LEFT JOIN stack_services ss ON s.id = ss.stack_id
            WHERE s.created_at >= NOW() - INTERVAL '24 hours'
            GROUP BY s.id
        ) as stack_stats;
    " "0")
    
    # Update metrics
    jq --argjson total "$total_stacks" \
       --argjson with_ai "$stacks_with_ai" \
       --argjson with_templates "$stacks_with_templates" \
       --argjson avg_services "$avg_services_per_stack" \
       '.metrics.stacks = {
           total_created: $total,
           with_ai_recommendations: $with_ai,
           with_templates: $with_templates,
           average_services_per_stack: $avg_services
       }' "$METRICS_DIR/current-state.json" > "$METRICS_DIR/temp.json" && \
       mv "$METRICS_DIR/temp.json" "$METRICS_DIR/current-state.json"
    
    echo "Stack metrics: $total_stacks created, $stacks_with_ai with AI, $stacks_with_templates with templates"
}

# Check feature flag adoption
collect_feature_flag_metrics() {
    echo "Collecting feature flag metrics..."
    
    # Get feature flag rollout percentages
    local ai_recommendations_rollout=0
    local template_system_rollout=0
    
    # Try to get from feature flag system (Redis or database)
    if command -v redis-cli &>/dev/null && [[ -n "${REDIS_URL:-}" ]]; then
        ai_recommendations_rollout=$(redis-cli -u "$REDIS_URL" GET "feature:ai_recommendations:percentage" 2>/dev/null || echo "0")
        template_system_rollout=$(redis-cli -u "$REDIS_URL" GET "feature:template_system:percentage" 2>/dev/null || echo "0")
    fi
    
    # Update metrics
    jq --argjson ai_rollout "$ai_recommendations_rollout" \
       --argjson template_rollout "$template_system_rollout" \
       '.metrics.feature_flags = {
           ai_recommendations: $ai_rollout,
           template_system: $template_rollout
       }' "$METRICS_DIR/current-state.json" > "$METRICS_DIR/temp.json" && \
       mv "$METRICS_DIR/temp.json" "$METRICS_DIR/current-state.json"
    
    echo "Feature flag rollout: AI $ai_recommendations_rollout%, Templates $template_system_rollout%"
}

# Check adoption alerts
check_adoption_alerts() {
    echo "Checking adoption alerts..."
    
    local current_metrics
    current_metrics=$(cat "$METRICS_DIR/current-state.json")
    
    local alerts=()
    
    # Check daily active users
    local dau
    dau=$(echo "$current_metrics" | jq -r '.metrics.users.active_daily')
    if [[ $dau -lt $MIN_DAILY_ACTIVE_USERS ]]; then
        alerts+=("Low daily active users: $dau (threshold: $MIN_DAILY_ACTIVE_USERS)")
    fi
    
    # Check recommendation engagement
    local rec_engagement
    rec_engagement=$(echo "$current_metrics" | jq -r '.metrics.recommendations.engagement_rate')
    if [[ $(echo "$rec_engagement < $MIN_RECOMMENDATION_ENGAGEMENT" | bc -l 2>/dev/null || echo "0") -eq 1 ]]; then
        alerts+=("Low recommendation engagement: $(printf "%.2f%%" $(echo "$rec_engagement * 100" | bc -l)) (threshold: $(printf "%.0f%%" $(echo "$MIN_RECOMMENDATION_ENGAGEMENT * 100" | bc -l)))")
    fi
    
    # Check template adoption
    local template_adoption
    template_adoption=$(echo "$current_metrics" | jq -r '.metrics.templates.adoption_rate')
    if [[ $(echo "$template_adoption < $MIN_TEMPLATE_ADOPTION" | bc -l 2>/dev/null || echo "0") -eq 1 ]]; then
        alerts+=("Low template adoption: $(printf "%.2f%%" $(echo "$template_adoption * 100" | bc -l)) (threshold: $(printf "%.0f%%" $(echo "$MIN_TEMPLATE_ADOPTION * 100" | bc -l)))")
    fi
    
    # Check churn rate
    local total_users
    local churned_users
    total_users=$(echo "$current_metrics" | jq -r '.metrics.users.total')
    churned_users=$(echo "$current_metrics" | jq -r '.metrics.users.churned')
    
    if [[ $total_users -gt 0 ]]; then
        local churn_rate
        churn_rate=$(echo "scale=4; $churned_users / $total_users" | bc -l 2>/dev/null || echo "0")
        if [[ $(echo "$churn_rate > $MAX_CHURN_RATE" | bc -l 2>/dev/null || echo "0") -eq 1 ]]; then
            alerts+=("High churn rate: $(printf "%.2f%%" $(echo "$churn_rate * 100" | bc -l)) (threshold: $(printf "%.0f%%" $(echo "$MAX_CHURN_RATE * 100" | bc -l)))")
        fi
    fi
    
    # Update alerts in metrics
    local alerts_json
    alerts_json=$(printf '%s\n' "${alerts[@]}" | jq -R . | jq -s .)
    
    jq --argjson alerts "$alerts_json" \
       --arg timestamp "$(date -Iseconds)" \
       '.alerts = $alerts | .lastUpdate = $timestamp' \
       "$METRICS_DIR/current-state.json" > "$METRICS_DIR/temp.json" && \
       mv "$METRICS_DIR/temp.json" "$METRICS_DIR/current-state.json"
    
    # Send alerts if any
    if [[ ${#alerts[@]} -gt 0 ]]; then
        echo -e "${YELLOW}Adoption alerts detected:${NC}"
        for alert in "${alerts[@]}"; do
            echo -e "  ${RED}⚠️  $alert${NC}"
        done
        send_adoption_alerts "${alerts[@]}"
    else
        echo -e "${GREEN}No adoption alerts${NC}"
    fi
}

# Send adoption alerts
send_adoption_alerts() {
    local alerts=("$@")
    local webhook_url="${SLACK_WEBHOOK_URL:-}"
    
    if [[ -n "$webhook_url" ]]; then
        local alert_text
        alert_text=$(IFS=$'\n'; echo "${alerts[*]}")
        
        local payload
        payload=$(jq -n \
            --arg text "Stapelwerk Adoption Alerts" \
            --arg alert_text "$alert_text" \
            --arg environment "$ENVIRONMENT" \
            --arg timestamp "$(date)" \
            '{
                attachments: [{
                    color: "warning",
                    title: "⚠️ Stapelwerk Adoption Alerts",
                    text: $alert_text,
                    fields: [
                        {title: "Environment", value: $environment, short: true},
                        {title: "Time", value: $timestamp, short: true}
                    ],
                    ts: (now | floor)
                }]
            }')
        
        curl -X POST -H 'Content-type: application/json' \
             --data "$payload" \
             "$webhook_url" &>/dev/null || echo "Warning: Failed to send Slack alert"
    fi
}

# Generate adoption report
generate_adoption_report() {
    echo "Generating adoption report..."
    
    local report_file="$REPORTS_DIR/adoption-report-$(date +%Y%m%d-%H%M%S).json"
    local current_metrics
    current_metrics=$(cat "$METRICS_DIR/current-state.json")
    
    # Calculate trends (compare with previous day if available)
    local trends="{}"
    local prev_report
    prev_report=$(find "$REPORTS_DIR" -name "adoption-report-*.json" -type f | sort -r | head -2 | tail -1)
    
    if [[ -f "$prev_report" ]]; then
        local prev_metrics
        prev_metrics=$(jq '.metrics' "$prev_report")
        
        local current_dau
        local prev_dau
        current_dau=$(echo "$current_metrics" | jq -r '.metrics.users.active_daily')
        prev_dau=$(echo "$prev_metrics" | jq -r '.users.active_daily // 0')
        
        if [[ $prev_dau -gt 0 ]]; then
            local dau_change
            dau_change=$(echo "scale=4; ($current_dau - $prev_dau) / $prev_dau * 100" | bc -l 2>/dev/null || echo "0")
            trends=$(echo "$trends" | jq --argjson change "$dau_change" '. + {dau_change: $change}')
        fi
        
        # Add more trend calculations as needed
        local current_rec_views
        local prev_rec_views
        current_rec_views=$(echo "$current_metrics" | jq -r '.metrics.recommendations.total_views')
        prev_rec_views=$(echo "$prev_metrics" | jq -r '.recommendations.total_views // 0')
        
        if [[ $prev_rec_views -gt 0 ]]; then
            local rec_views_change
            rec_views_change=$(echo "scale=4; ($current_rec_views - $prev_rec_views) / $prev_rec_views * 100" | bc -l 2>/dev/null || echo "0")
            trends=$(echo "$trends" | jq --argjson change "$rec_views_change" '. + {recommendation_views_change: $change}')
        fi
    fi
    
    # Create comprehensive report
    echo "$current_metrics" | jq --argjson trends "$trends" \
        --arg report_id "$(date +%Y%m%d-%H%M%S)" \
        --arg generated_at "$(date -Iseconds)" \
        '. + {
            reportId: $report_id,
            generatedAt: $generated_at,
            trends: $trends,
            summary: {
                adoption_health: (
                    if (.metrics.users.active_daily >= 10 and 
                        .metrics.recommendations.engagement_rate >= 0.15 and 
                        .metrics.templates.adoption_rate >= 0.05) 
                    then "healthy" 
                    else "attention_needed" 
                    end
                ),
                key_insights: [
                    "Daily Active Users: \(.metrics.users.active_daily)",
                    "Recommendation Engagement: \((.metrics.recommendations.engagement_rate * 100) | floor)%",
                    "Template Adoption: \((.metrics.templates.adoption_rate * 100) | floor)%",
                    "Alerts: \(.alerts | length)"
                ]
            }
        }' > "$report_file"
    
    echo "Report generated: $report_file"
    
    # Send report summary
    send_adoption_report_summary "$report_file"
}

# Send adoption report summary
send_adoption_report_summary() {
    local report_file="$1"
    local webhook_url="${SLACK_WEBHOOK_URL:-}"
    
    if [[ -n "$webhook_url" && -f "$report_file" ]]; then
        local summary
        summary=$(jq -r '.summary' "$report_file")
        
        local health
        local insights
        health=$(echo "$summary" | jq -r '.adoption_health')
        insights=$(echo "$summary" | jq -r '.key_insights | join("\n")')
        
        local color="good"
        [[ "$health" == "attention_needed" ]] && color="warning"
        
        local payload
        payload=$(jq -n \
            --arg health "$health" \
            --arg insights "$insights" \
            --arg environment "$ENVIRONMENT" \
            --arg color "$color" \
            '{
                attachments: [{
                    color: $color,
                    title: "📊 Stapelwerk Adoption Report",
                    text: ("Adoption Health: " + $health),
                    fields: [
                        {title: "Key Metrics", value: $insights, short: false},
                        {title: "Environment", value: $environment, short: true}
                    ],
                    ts: (now | floor)
                }]
            }')
        
        curl -X POST -H 'Content-type: application/json' \
             --data "$payload" \
             "$webhook_url" &>/dev/null || true
    fi
}

# Show current adoption status
show_adoption_status() {
    echo -e "${BOLD}Stapelwerk Adoption Status${NC}"
    echo
    
    if [[ ! -f "$METRICS_DIR/current-state.json" ]]; then
        echo "No metrics data available. Run collection first."
        return 1
    fi
    
    local metrics
    metrics=$(cat "$METRICS_DIR/current-state.json")
    
    # User metrics
    echo -e "${BOLD}👥 User Metrics${NC}"
    printf "  Total Users:        %s\n" "$(echo "$metrics" | jq -r '.metrics.users.total')"
    printf "  Daily Active:       %s\n" "$(echo "$metrics" | jq -r '.metrics.users.active_daily')"
    printf "  Weekly Active:      %s\n" "$(echo "$metrics" | jq -r '.metrics.users.active_weekly')"
    printf "  Monthly Active:     %s\n" "$(echo "$metrics" | jq -r '.metrics.users.active_monthly')"
    printf "  New Signups (24h):  %s\n" "$(echo "$metrics" | jq -r '.metrics.users.new_signups')"
    printf "  Churned Users:      %s\n" "$(echo "$metrics" | jq -r '.metrics.users.churned')"
    echo
    
    # Recommendation metrics
    echo -e "${BOLD}🎯 AI Recommendation Metrics${NC}"
    printf "  Views (24h):        %s\n" "$(echo "$metrics" | jq -r '.metrics.recommendations.total_views')"
    printf "  Clicks (24h):       %s\n" "$(echo "$metrics" | jq -r '.metrics.recommendations.total_clicks')"
    printf "  Adoptions (24h):    %s\n" "$(echo "$metrics" | jq -r '.metrics.recommendations.total_adoptions')"
    printf "  Engagement Rate:    %.1f%%\n" "$(echo "$metrics" | jq -r '.metrics.recommendations.engagement_rate * 100')"
    printf "  Adoption Rate:      %.1f%%\n" "$(echo "$metrics" | jq -r '.metrics.recommendations.adoption_rate * 100')"
    echo
    
    # Template metrics
    echo -e "${BOLD}📋 Template Metrics${NC}"
    printf "  Views (24h):        %s\n" "$(echo "$metrics" | jq -r '.metrics.templates.total_views')"
    printf "  Applications (24h): %s\n" "$(echo "$metrics" | jq -r '.metrics.templates.total_applications')"
    printf "  Unique Templates:   %s\n" "$(echo "$metrics" | jq -r '.metrics.templates.unique_templates_used')"
    printf "  Adoption Rate:      %.1f%%\n" "$(echo "$metrics" | jq -r '.metrics.templates.adoption_rate * 100')"
    echo
    
    # Stack metrics
    echo -e "${BOLD}🏗️  Stack Metrics${NC}"
    printf "  Created (24h):      %s\n" "$(echo "$metrics" | jq -r '.metrics.stacks.total_created')"
    printf "  With AI Help:       %s\n" "$(echo "$metrics" | jq -r '.metrics.stacks.with_ai_recommendations')"
    printf "  With Templates:     %s\n" "$(echo "$metrics" | jq -r '.metrics.stacks.with_templates')"
    printf "  Avg Services:       %.1f\n" "$(echo "$metrics" | jq -r '.metrics.stacks.average_services_per_stack')"
    echo
    
    # Feature flags
    echo -e "${BOLD}🚩 Feature Flag Rollout${NC}"
    printf "  AI Recommendations: %s%%\n" "$(echo "$metrics" | jq -r '.metrics.feature_flags.ai_recommendations')"
    printf "  Template System:    %s%%\n" "$(echo "$metrics" | jq -r '.metrics.feature_flags.template_system')"
    echo
    
    # Alerts
    local alert_count
    alert_count=$(echo "$metrics" | jq -r '.alerts | length')
    if [[ $alert_count -gt 0 ]]; then
        echo -e "${BOLD}⚠️  Active Alerts${NC}"
        echo "$metrics" | jq -r '.alerts[]' | sed 's/^/  /'
        echo
    fi
}

# Help function
show_help() {
    cat << EOF
Stapelwerk Adoption Monitoring System

Usage: $0 <command> [options]

Commands:
  collect               Collect all adoption metrics
  status                Show current adoption status
  report                Generate adoption report
  monitor               Start continuous monitoring
  alerts                Check and send alerts only

Options:
  --environment ENV     Environment (default: production)
  --sample-period SEC   Sample period in seconds (default: 3600)
  --report-interval SEC Report interval in seconds (default: 86400)
  --help               Show this help message

Environment Variables:
  DATABASE_URL         Database connection string
  REDIS_URL           Redis connection for feature flags
  SLACK_WEBHOOK_URL    Slack webhook for notifications
  MIN_DAILY_ACTIVE_USERS       Minimum DAU threshold
  MIN_RECOMMENDATION_ENGAGEMENT Minimum engagement rate
  MIN_TEMPLATE_ADOPTION        Minimum template adoption rate
  MAX_CHURN_RATE              Maximum acceptable churn rate

Examples:
  # Collect metrics once
  $0 collect

  # Show current status
  $0 status

  # Start continuous monitoring
  $0 monitor

  # Generate report
  $0 report
EOF
}

# Parse command line arguments
COMMAND="${1:-status}"
shift || true

while [[ $# -gt 0 ]]; do
    case $1 in
        --environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --sample-period)
            SAMPLE_PERIOD="$2"
            shift 2
            ;;
        --report-interval)
            REPORT_INTERVAL="$2"
            shift 2
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

# Main execution
main() {
    init_adoption_monitoring
    
    case "$COMMAND" in
        "collect")
            collect_user_metrics
            collect_recommendation_metrics
            collect_template_metrics
            collect_stack_metrics
            collect_feature_flag_metrics
            check_adoption_alerts
            echo -e "${GREEN}Metrics collection completed${NC}"
            ;;
        "status")
            show_adoption_status
            ;;
        "report")
            collect_user_metrics
            collect_recommendation_metrics
            collect_template_metrics
            collect_stack_metrics
            collect_feature_flag_metrics
            generate_adoption_report
            ;;
        "alerts")
            check_adoption_alerts
            ;;
        "monitor")
            echo "Starting continuous monitoring (sample period: ${SAMPLE_PERIOD}s, report interval: ${REPORT_INTERVAL}s)"
            local last_report_time=$(date +%s)
            
            while true; do
                # Collect metrics
                collect_user_metrics
                collect_recommendation_metrics
                collect_template_metrics
                collect_stack_metrics
                collect_feature_flag_metrics
                check_adoption_alerts
                
                # Generate report if interval elapsed
                local current_time=$(date +%s)
                if [[ $((current_time - last_report_time)) -ge $REPORT_INTERVAL ]]; then
                    generate_adoption_report
                    last_report_time=$current_time
                fi
                
                sleep "$SAMPLE_PERIOD"
            done
            ;;
        *)
            echo "Unknown command: $COMMAND"
            show_help
            exit 1
            ;;
    esac
}

# Execute main function
main "$@"
exit $?