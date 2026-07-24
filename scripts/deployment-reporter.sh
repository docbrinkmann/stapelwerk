#!/bin/bash

# Deployment Reporting and Notification System
# Creates comprehensive deployment reports with notifications and analytics
# Usage: ./deployment-reporter.sh [options]

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$PROJECT_DIR/logs"
REPORTS_DIR="$PROJECT_DIR/reports"
TEMPLATES_DIR="$PROJECT_DIR/templates/reports"

# Colors and formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Report configuration
REPORT_ID="report-$(date +%Y%m%d-%H%M%S)"
DEPLOYMENT_ENV="${DEPLOYMENT_ENV:-production}"
REPORT_TYPE="${REPORT_TYPE:-deployment}" # deployment, monitoring, performance
OUTPUT_FORMAT="${OUTPUT_FORMAT:-html,json,pdf}" # comma-separated formats

# Initialize reporting
init_reporting() {
    echo -e "${BOLD}${BLUE}=== Stapelwerk Deployment Reporter ===${NC}"
    echo -e "${CYAN}Report ID: $REPORT_ID${NC}"
    echo -e "${CYAN}Environment: $DEPLOYMENT_ENV${NC}"
    echo -e "${CYAN}Type: $REPORT_TYPE${NC}"
    echo -e "${CYAN}Started: $(date)${NC}"
    echo

    # Create necessary directories
    mkdir -p "$REPORTS_DIR/html" "$REPORTS_DIR/json" "$REPORTS_DIR/pdf" "$TEMPLATES_DIR"
    
    # Create report templates if they don't exist
    create_report_templates
}

# Create report templates
create_report_templates() {
    # HTML template
    if [[ ! -f "$TEMPLATES_DIR/deployment-report.html" ]]; then
        cat > "$TEMPLATES_DIR/deployment-report.html" << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Stapelwerk Deployment Report - {{DEPLOYMENT_ID}}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 2.5em;
        }
        .header .subtitle {
            opacity: 0.9;
            font-size: 1.1em;
            margin-top: 10px;
        }
        .content {
            padding: 30px;
        }
        .status-card {
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 6px;
            padding: 20px;
            margin-bottom: 20px;
        }
        .status-success { border-left: 4px solid #28a745; }
        .status-warning { border-left: 4px solid #ffc107; }
        .status-error { border-left: 4px solid #dc3545; }
        .status-info { border-left: 4px solid #17a2b8; }
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin: 20px 0;
        }
        .metric-card {
            background: white;
            border: 1px solid #dee2e6;
            border-radius: 6px;
            padding: 20px;
            text-align: center;
        }
        .metric-value {
            font-size: 2em;
            font-weight: bold;
            color: #495057;
        }
        .metric-label {
            color: #6c757d;
            font-size: 0.9em;
            margin-top: 5px;
        }
        .timeline {
            border-left: 2px solid #e9ecef;
            margin-left: 20px;
        }
        .timeline-item {
            position: relative;
            padding-left: 30px;
            padding-bottom: 20px;
        }
        .timeline-item:before {
            content: '';
            position: absolute;
            left: -7px;
            top: 0;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: #6c757d;
        }
        .timeline-item.success:before { background: #28a745; }
        .timeline-item.error:before { background: #dc3545; }
        .timeline-item.warning:before { background: #ffc107; }
        .table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        .table th, .table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #dee2e6;
        }
        .table th {
            background-color: #f8f9fa;
            font-weight: 600;
        }
        .footer {
            background: #f8f9fa;
            padding: 20px 30px;
            color: #6c757d;
            text-align: center;
            border-top: 1px solid #dee2e6;
        }
        @media (max-width: 768px) {
            .metrics-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Stapelwerk Deployment Report</h1>
            <div class="subtitle">{{DEPLOYMENT_ID}} • {{ENVIRONMENT}} • {{DATE}}</div>
        </div>
        
        <div class="content">
            <!-- Summary Section -->
            <div class="status-card status-{{STATUS_CLASS}}">
                <h2>Deployment Summary</h2>
                <p><strong>Status:</strong> {{STATUS}}</p>
                <p><strong>Duration:</strong> {{DURATION}}</p>
                <p><strong>Environment:</strong> {{ENVIRONMENT}}</p>
                <p><strong>Deployed Services:</strong> {{DEPLOYED_SERVICES}}</p>
            </div>
            
            <!-- Metrics Section -->
            <h2>Key Metrics</h2>
            <div class="metrics-grid">
                {{METRICS_CARDS}}
            </div>
            
            <!-- Timeline Section -->
            <h2>Deployment Timeline</h2>
            <div class="timeline">
                {{TIMELINE_EVENTS}}
            </div>
            
            <!-- Health Checks Section -->
            <h2>Health Check Results</h2>
            <table class="table">
                <thead>
                    <tr>
                        <th>Service</th>
                        <th>Status</th>
                        <th>Response Time</th>
                        <th>Last Check</th>
                    </tr>
                </thead>
                <tbody>
                    {{HEALTH_CHECK_ROWS}}
                </tbody>
            </table>
            
            <!-- Errors and Warnings -->
            {{ISSUES_SECTION}}
        </div>
        
        <div class="footer">
            Generated on {{GENERATED_DATE}} by Stapelwerk Deployment Reporter
        </div>
    </div>
</body>
</html>
EOF
    fi
    
    # Email template
    if [[ ! -f "$TEMPLATES_DIR/email-notification.html" ]]; then
        cat > "$TEMPLATES_DIR/email-notification.html" << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; }
        .header { background: #667eea; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .status-success { color: #28a745; }
        .status-error { color: #dc3545; }
        .status-warning { color: #ffc107; }
        .table { width: 100%; border-collapse: collapse; }
        .table th, .table td { padding: 8px; border: 1px solid #ddd; }
        .table th { background: #f8f9fa; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Stapelwerk Deployment {{STATUS}}</h1>
        <p>{{DEPLOYMENT_ID}} • {{ENVIRONMENT}}</p>
    </div>
    <div class="content">
        <h2>Summary</h2>
        <p><strong>Status:</strong> <span class="status-{{STATUS_CLASS}}">{{STATUS}}</span></p>
        <p><strong>Duration:</strong> {{DURATION}}</p>
        <p><strong>Environment:</strong> {{ENVIRONMENT}}</p>
        <p><strong>Time:</strong> {{DATE}}</p>
        
        {{DETAILS_SECTION}}
        
        <p>For detailed reports, visit: <a href="{{REPORT_URL}}">{{REPORT_URL}}</a></p>
    </div>
</body>
</html>
EOF
    fi
}

# Data collection functions
collect_deployment_data() {
    local deployment_id="$1"
    local deployment_file=""
    
    # Find the most recent deployment report
    if [[ -n "$deployment_id" ]]; then
        deployment_file="$REPORTS_DIR/deployment/${deployment_id}.json"
    else
        deployment_file=$(find "$REPORTS_DIR/deployment" -name "*.json" -type f -exec ls -t {} + 2>/dev/null | head -1)
    fi
    
    if [[ -f "$deployment_file" ]]; then
        cat "$deployment_file"
    else
        echo '{"error": "Deployment data not found"}'
    fi
}

collect_monitoring_data() {
    local monitor_id="$1"
    local monitoring_file=""
    
    # Find the most recent monitoring report
    if [[ -n "$monitor_id" ]]; then
        monitoring_file="$REPORTS_DIR/monitoring/${monitor_id}.json"
    else
        monitoring_file=$(find "$REPORTS_DIR/monitoring" -name "*.json" -type f -exec ls -t {} + 2>/dev/null | head -1)
    fi
    
    if [[ -f "$monitoring_file" ]]; then
        cat "$monitoring_file"
    else
        echo '{"healthChecks": [], "metrics": {}, "alerts": []}'
    fi
}

collect_system_metrics() {
    local metrics='{}'
    
    # Collect current system metrics
    if command -v kubectl &>/dev/null; then
        # Kubernetes metrics
        local pods_ready=$(kubectl get pods -n "$DEPLOYMENT_ENV" -l app=stapelwerk -o jsonpath='{.items[?(@.status.phase=="Running")].metadata.name}' | wc -w 2>/dev/null || echo "0")
        local pods_total=$(kubectl get pods -n "$DEPLOYMENT_ENV" -l app=stapelwerk --no-headers 2>/dev/null | wc -l || echo "0")
        
        metrics=$(echo "$metrics" | jq --argjson ready "$pods_ready" --argjson total "$pods_total" '. + {pods_ready: $ready, pods_total: $total}')
    fi
    
    # Add timestamp
    metrics=$(echo "$metrics" | jq --arg timestamp "$(date -Iseconds)" '. + {collected_at: $timestamp}')
    
    echo "$metrics"
}

# Report generation functions
generate_json_report() {
    local deployment_data="$1"
    local monitoring_data="$2"
    local system_metrics="$3"
    local output_file="$4"
    
    # Combine all data sources
    local combined_report=$(jq -n \
        --argjson deployment "$deployment_data" \
        --argjson monitoring "$monitoring_data" \
        --argjson metrics "$system_metrics" \
        --arg reportId "$REPORT_ID" \
        --arg generatedAt "$(date -Iseconds)" \
        '{
            reportId: $reportId,
            generatedAt: $generatedAt,
            deployment: $deployment,
            monitoring: $monitoring,
            systemMetrics: $metrics,
            summary: {
                status: $deployment.status,
                duration: (if $deployment.endTime and $deployment.startTime then 
                    (([$deployment.endTime, $deployment.startTime] | map(fromdateiso8601) | .[0] - .[1])) 
                    else null end),
                errors: ($deployment.errors // []),
                warnings: ($deployment.warnings // []),
                deployedServices: ($deployment.deployedServices // [])
            }
        }')
    
    echo "$combined_report" > "$output_file"
    echo "JSON report generated: $output_file"
}

generate_html_report() {
    local deployment_data="$1"
    local monitoring_data="$2"
    local system_metrics="$3"
    local output_file="$4"
    
    # Extract key data
    local status=$(echo "$deployment_data" | jq -r '.status // "unknown"')
    local deployment_id=$(echo "$deployment_data" | jq -r '.deploymentId // "N/A"')
    local environment=$(echo "$deployment_data" | jq -r '.environment // "unknown"')
    local start_time=$(echo "$deployment_data" | jq -r '.startTime // ""')
    local end_time=$(echo "$deployment_data" | jq -r '.endTime // ""')
    local errors=$(echo "$deployment_data" | jq -r '.errors // []')
    local warnings=$(echo "$deployment_data" | jq -r '.warnings // []')
    local deployed_services=$(echo "$deployment_data" | jq -r '.deployedServices // []' | jq -r 'join(", ")')
    
    # Calculate duration
    local duration="N/A"
    if [[ -n "$start_time" && -n "$end_time" ]]; then
        local start_epoch=$(date -j -f "%Y-%m-%dT%H:%M:%S" "${start_time%.*}" "+%s" 2>/dev/null || echo "0")
        local end_epoch=$(date -j -f "%Y-%m-%dT%H:%M:%S" "${end_time%.*}" "+%s" 2>/dev/null || echo "0")
        if [[ $start_epoch -gt 0 && $end_epoch -gt 0 ]]; then
            duration="$((end_epoch - start_epoch))s"
        fi
    fi
    
    # Determine status class
    local status_class="info"
    case "$status" in
        "completed"|"success") status_class="success" ;;
        "failed"|"error"|"rolled_back") status_class="error" ;;
        "warning") status_class="warning" ;;
    esac
    
    # Generate metrics cards
    local metrics_cards=""
    if [[ "$monitoring_data" != "{}" ]]; then
        local pods_ready=$(echo "$system_metrics" | jq -r '.pods_ready // 0')
        local pods_total=$(echo "$system_metrics" | jq -r '.pods_total // 0')
        local alert_count=$(echo "$monitoring_data" | jq -r '.alerts | length')
        
        metrics_cards='
        <div class="metric-card">
            <div class="metric-value">'$pods_ready'/'$pods_total'</div>
            <div class="metric-label">Ready Pods</div>
        </div>
        <div class="metric-card">
            <div class="metric-value">'$duration'</div>
            <div class="metric-label">Duration</div>
        </div>
        <div class="metric-card">
            <div class="metric-value">'$alert_count'</div>
            <div class="metric-label">Alerts</div>
        </div>'
    fi
    
    # Generate timeline
    local timeline_events=""
    if echo "$deployment_data" | jq -e '.phases' &>/dev/null; then
        timeline_events=$(echo "$deployment_data" | jq -r '
            .phases[]? | 
            "<div class=\"timeline-item " + 
            (if .level == "error" then "error" 
             elif .level == "warning" then "warning" 
             elif .level == "success" then "success" 
             else "" end) + 
            "\"><strong>" + (.timestamp // "") + "</strong><br>" + 
            (.message // "") + "</div>"
        ' | tr '\n' ' ')
    fi
    
    # Generate health check rows
    local health_check_rows=""
    if echo "$monitoring_data" | jq -e '.healthChecks' &>/dev/null; then
        health_check_rows=$(echo "$monitoring_data" | jq -r '
            .healthChecks[]? | 
            "<tr><td>" + (.service // "System") + "</td><td>" + 
            (.level // "unknown") + "</td><td>" + 
            (.response_time // "N/A") + "</td><td>" + 
            (.timestamp // "N/A") + "</td></tr>"
        ' | tr '\n' ' ')
    fi
    
    # Generate issues section
    local issues_section=""
    local error_count=$(echo "$deployment_data" | jq -r '.errors | length')
    local warning_count=$(echo "$deployment_data" | jq -r '.warnings | length')
    
    if [[ $error_count -gt 0 || $warning_count -gt 0 ]]; then
        issues_section='<h2>Issues and Warnings</h2>'
        
        if [[ $error_count -gt 0 ]]; then
            issues_section+='<div class="status-card status-error"><h3>Errors</h3><ul>'
            issues_section+=$(echo "$deployment_data" | jq -r '.errors[]? | "<li>" + . + "</li>"' | tr '\n' ' ')
            issues_section+='</ul></div>'
        fi
        
        if [[ $warning_count -gt 0 ]]; then
            issues_section+='<div class="status-card status-warning"><h3>Warnings</h3><ul>'
            issues_section+=$(echo "$deployment_data" | jq -r '.warnings[]? | "<li>" + . + "</li>"' | tr '\n' ' ')
            issues_section+='</ul></div>'
        fi
    fi
    
    # Replace template variables
    sed -e "s/{{DEPLOYMENT_ID}}/$deployment_id/g" \
        -e "s/{{ENVIRONMENT}}/$environment/g" \
        -e "s/{{DATE}}/$(date)/g" \
        -e "s/{{STATUS}}/$status/g" \
        -e "s/{{STATUS_CLASS}}/$status_class/g" \
        -e "s/{{DURATION}}/$duration/g" \
        -e "s/{{DEPLOYED_SERVICES}}/$deployed_services/g" \
        -e "s/{{METRICS_CARDS}}/$metrics_cards/g" \
        -e "s/{{TIMELINE_EVENTS}}/$timeline_events/g" \
        -e "s/{{HEALTH_CHECK_ROWS}}/$health_check_rows/g" \
        -e "s/{{ISSUES_SECTION}}/$issues_section/g" \
        -e "s/{{GENERATED_DATE}}/$(date)/g" \
        "$TEMPLATES_DIR/deployment-report.html" > "$output_file"
    
    echo "HTML report generated: $output_file"
}

generate_pdf_report() {
    local html_file="$1"
    local output_file="$2"
    
    # Try to generate PDF using various methods
    if command -v wkhtmltopdf &>/dev/null; then
        wkhtmltopdf --page-size A4 --margin-top 0.75in --margin-right 0.75in \
                   --margin-bottom 0.75in --margin-left 0.75in \
                   "$html_file" "$output_file"
        echo "PDF report generated: $output_file"
    elif command -v weasyprint &>/dev/null; then
        weasyprint "$html_file" "$output_file"
        echo "PDF report generated: $output_file"
    else
        echo "Warning: PDF generation not available (install wkhtmltopdf or weasyprint)"
        echo "HTML report available at: $html_file"
    fi
}

# Notification functions
send_slack_notification() {
    local webhook_url="$1"
    local deployment_data="$2"
    local report_url="$3"
    
    local status=$(echo "$deployment_data" | jq -r '.status // "unknown"')
    local deployment_id=$(echo "$deployment_data" | jq -r '.deploymentId // "N/A"')
    local environment=$(echo "$deployment_data" | jq -r '.environment // "unknown"')
    local error_count=$(echo "$deployment_data" | jq -r '.errors | length')
    local warning_count=$(echo "$deployment_data" | jq -r '.warnings | length')
    
    local color="good"
    local emoji=":white_check_mark:"
    
    case "$status" in
        "failed"|"error"|"rolled_back")
            color="danger"
            emoji=":x:"
            ;;
        "warning")
            color="warning"
            emoji=":warning:"
            ;;
    esac
    
    local payload=$(jq -n \
        --arg color "$color" \
        --arg emoji "$emoji" \
        --arg deployment_id "$deployment_id" \
        --arg status "$status" \
        --arg environment "$environment" \
        --argjson error_count "$error_count" \
        --argjson warning_count "$warning_count" \
        --arg report_url "$report_url" \
        --arg timestamp "$(date +%s)" \
        '{
            attachments: [{
                color: $color,
                title: ($emoji + " Stapelwerk Deployment Report"),
                text: ("Deployment " + $deployment_id + " " + $status),
                fields: [
                    {title: "Environment", value: $environment, short: true},
                    {title: "Status", value: $status, short: true},
                    {title: "Errors", value: ($error_count | tostring), short: true},
                    {title: "Warnings", value: ($warning_count | tostring), short: true}
                ],
                actions: [{
                    type: "button",
                    text: "View Report",
                    url: $report_url
                }],
                ts: ($timestamp | tonumber)
            }]
        }')
    
    curl -X POST -H 'Content-type: application/json' \
         --data "$payload" \
         "$webhook_url" &>/dev/null || echo "Warning: Failed to send Slack notification"
}

send_email_notification() {
    local email="$1"
    local deployment_data="$2"
    local report_url="$3"
    
    local status=$(echo "$deployment_data" | jq -r '.status // "unknown"')
    local deployment_id=$(echo "$deployment_data" | jq -r '.deploymentId // "N/A"')
    local environment=$(echo "$deployment_data" | jq -r '.environment // "unknown"')
    local duration=$(echo "$deployment_data" | jq -r '.duration // "N/A"')
    
    local status_class="info"
    case "$status" in
        "completed"|"success") status_class="success" ;;
        "failed"|"error"|"rolled_back") status_class="error" ;;
        "warning") status_class="warning" ;;
    esac
    
    local details_section=""
    local error_count=$(echo "$deployment_data" | jq -r '.errors | length')
    local warning_count=$(echo "$deployment_data" | jq -r '.warnings | length')
    
    if [[ $error_count -gt 0 || $warning_count -gt 0 ]]; then
        details_section="<h2>Issues Summary</h2>"
        details_section+="<p><strong>Errors:</strong> $error_count</p>"
        details_section+="<p><strong>Warnings:</strong> $warning_count</p>"
    fi
    
    # Create email content
    local email_content
    email_content=$(sed -e "s/{{STATUS}}/$status/g" \
                       -e "s/{{STATUS_CLASS}}/$status_class/g" \
                       -e "s/{{DEPLOYMENT_ID}}/$deployment_id/g" \
                       -e "s/{{ENVIRONMENT}}/$environment/g" \
                       -e "s/{{DURATION}}/$duration/g" \
                       -e "s/{{DATE}}/$(date)/g" \
                       -e "s/{{DETAILS_SECTION}}/$details_section/g" \
                       -e "s|{{REPORT_URL}}|$report_url|g" \
                       "$TEMPLATES_DIR/email-notification.html")
    
    # Send email
    if command -v sendmail &>/dev/null; then
        {
            echo "To: $email"
            echo "Subject: Stapelwerk Deployment $deployment_id - $status"
            echo "Content-Type: text/html; charset=UTF-8"
            echo
            echo "$email_content"
        } | sendmail "$email" || echo "Warning: Failed to send email notification"
    else
        echo "Warning: sendmail not available for email notifications"
    fi
}

# Main report generation
generate_comprehensive_report() {
    local deployment_id="${1:-}"
    local monitor_id="${2:-}"
    
    echo "Generating comprehensive deployment report..."
    
    # Collect data
    local deployment_data=$(collect_deployment_data "$deployment_id")
    local monitoring_data=$(collect_monitoring_data "$monitor_id")
    local system_metrics=$(collect_system_metrics)
    
    # Generate reports in requested formats
    IFS=',' read -ra FORMATS <<< "$OUTPUT_FORMAT"
    for format in "${FORMATS[@]}"; do
        format=$(echo "$format" | xargs) # trim whitespace
        
        case "$format" in
            "json")
                generate_json_report "$deployment_data" "$monitoring_data" "$system_metrics" \
                    "$REPORTS_DIR/json/${REPORT_ID}.json"
                ;;
            "html")
                generate_html_report "$deployment_data" "$monitoring_data" "$system_metrics" \
                    "$REPORTS_DIR/html/${REPORT_ID}.html"
                ;;
            "pdf")
                local html_file="$REPORTS_DIR/html/${REPORT_ID}.html"
                if [[ ! -f "$html_file" ]]; then
                    generate_html_report "$deployment_data" "$monitoring_data" "$system_metrics" "$html_file"
                fi
                generate_pdf_report "$html_file" "$REPORTS_DIR/pdf/${REPORT_ID}.pdf"
                ;;
        esac
    done
    
    # Send notifications
    local report_url="${REPORT_BASE_URL:-http://localhost:3000}/reports/${REPORT_ID}.html"
    
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        send_slack_notification "$SLACK_WEBHOOK_URL" "$deployment_data" "$report_url"
    fi
    
    if [[ -n "${DEPLOYMENT_EMAIL:-}" ]]; then
        send_email_notification "$DEPLOYMENT_EMAIL" "$deployment_data" "$report_url"
    fi
    
    echo
    echo "Report generation completed!"
    echo "Report ID: $REPORT_ID"
    echo "Available formats: $(echo "$OUTPUT_FORMAT" | tr ',' ' ')"
    echo "Reports location: $REPORTS_DIR"
}

# Help function
show_help() {
    cat << EOF
Stapelwerk Deployment Reporting System

Usage: $0 [options]

Options:
  --deployment-id ID    Specific deployment ID to report on
  --monitor-id ID       Specific monitoring session to include
  --type TYPE           Report type: deployment, monitoring, performance
  --format FORMATS      Output formats (comma-separated): html,json,pdf
  --environment ENV     Deployment environment
  --help               Show this help message

Environment Variables:
  SLACK_WEBHOOK_URL     Slack webhook for notifications
  DEPLOYMENT_EMAIL      Email for notifications
  REPORT_BASE_URL       Base URL for report links

Examples:
  # Generate comprehensive report
  $0

  # Generate specific deployment report
  $0 --deployment-id deploy-20231122-143045

  # Generate PDF only
  $0 --format pdf

  # Generate report with notifications
  SLACK_WEBHOOK_URL=https://hooks.slack.com/... $0
EOF
}

# Parse command line arguments
DEPLOYMENT_ID=""
MONITOR_ID=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --deployment-id)
            DEPLOYMENT_ID="$2"
            shift 2
            ;;
        --monitor-id)
            MONITOR_ID="$2"
            shift 2
            ;;
        --type)
            REPORT_TYPE="$2"
            shift 2
            ;;
        --format)
            OUTPUT_FORMAT="$2"
            shift 2
            ;;
        --environment)
            DEPLOYMENT_ENV="$2"
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
    init_reporting
    generate_comprehensive_report "$DEPLOYMENT_ID" "$MONITOR_ID"
    return 0
}

# Execute main function
main "$@"
exit $?