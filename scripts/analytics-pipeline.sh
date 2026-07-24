#!/bin/bash

# Automated Adoption Analytics Pipeline
# Processes user behavior data and generates adoption insights
# Usage: ./analytics-pipeline.sh [options]

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PIPELINE_DIR="$PROJECT_DIR/analytics-pipeline"
DATA_DIR="$PIPELINE_DIR/data"
PROCESSED_DIR="$PIPELINE_DIR/processed"
INSIGHTS_DIR="$PIPELINE_DIR/insights"

# Colors and formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Pipeline configuration
PIPELINE_ID="analytics-$(date +%Y%m%d-%H%M%S)"
BATCH_SIZE="${BATCH_SIZE:-1000}"
LOOKBACK_DAYS="${LOOKBACK_DAYS:-30}"
MIN_SESSION_DURATION="${MIN_SESSION_DURATION:-60}" # seconds

# Initialize pipeline
init_pipeline() {
    echo -e "${BOLD}${BLUE}=== Stapelwerk Analytics Pipeline ===${NC}"
    echo -e "${CYAN}Pipeline ID: $PIPELINE_ID${NC}"
    echo -e "${CYAN}Batch Size: $BATCH_SIZE${NC}"
    echo -e "${CYAN}Lookback Days: $LOOKBACK_DAYS${NC}"
    echo

    # Create necessary directories
    mkdir -p "$DATA_DIR/raw" "$DATA_DIR/staging" "$PROCESSED_DIR" "$INSIGHTS_DIR"
    
    # Initialize pipeline state
    cat > "$PIPELINE_DIR/pipeline-state.json" << EOF
{
    "pipelineId": "$PIPELINE_ID",
    "startTime": "$(date -Iseconds)",
    "status": "initializing",
    "stages": {
        "extract": "pending",
        "transform": "pending", 
        "load": "pending",
        "analyze": "pending"
    },
    "metrics": {
        "recordsProcessed": 0,
        "usersAnalyzed": 0,
        "sessionsProcessed": 0,
        "insightsGenerated": 0
    }
}
EOF
}

# Extract user behavior data
extract_data() {
    echo "Extracting user behavior data..."
    update_pipeline_stage "extract" "running"
    
    local cutoff_date=$(date -d "$LOOKBACK_DAYS days ago" '+%Y-%m-%d' 2>/dev/null || date -v -${LOOKBACK_DAYS}d '+%Y-%m-%d')
    
    # Extract analytics events
    if [[ -n "${DATABASE_URL:-}" ]]; then
        psql "$DATABASE_URL" -c "
            COPY (
                SELECT 
                    id,
                    user_id,
                    event_type,
                    event_data,
                    created_at,
                    session_id
                FROM analytics_events 
                WHERE created_at >= '$cutoff_date'
                ORDER BY created_at
            ) TO STDOUT WITH CSV HEADER
        " > "$DATA_DIR/raw/analytics_events.csv" 2>/dev/null || {
            echo "Warning: Could not extract analytics events from database"
            touch "$DATA_DIR/raw/analytics_events.csv"
        }
    fi
    
    # Extract user sessions
    if [[ -n "${DATABASE_URL:-}" ]]; then
        psql "$DATABASE_URL" -c "
            COPY (
                SELECT 
                    id,
                    user_id,
                    session_start,
                    session_end,
                    page_views,
                    actions_count,
                    duration_seconds,
                    created_at
                FROM user_sessions 
                WHERE created_at >= '$cutoff_date'
                    AND duration_seconds >= $MIN_SESSION_DURATION
                ORDER BY created_at
            ) TO STDOUT WITH CSV HEADER
        " > "$DATA_DIR/raw/user_sessions.csv" 2>/dev/null || {
            echo "Warning: Could not extract user sessions from database"
            touch "$DATA_DIR/raw/user_sessions.csv"
        }
    fi
    
    # Extract user data
    if [[ -n "${DATABASE_URL:-}" ]]; then
        psql "$DATABASE_URL" -c "
            COPY (
                SELECT 
                    id,
                    email,
                    name,
                    created_at,
                    last_login,
                    user_type
                FROM users
                WHERE created_at >= '$cutoff_date - INTERVAL 90 days'
                ORDER BY created_at
            ) TO STDOUT WITH CSV HEADER
        " > "$DATA_DIR/raw/users.csv" 2>/dev/null || {
            echo "Warning: Could not extract users from database"
            touch "$DATA_DIR/raw/users.csv"
        }
    fi
    
    local records_extracted=$(wc -l < "$DATA_DIR/raw/analytics_events.csv" 2>/dev/null || echo "0")
    jq --argjson records "$records_extracted" '.metrics.recordsProcessed = $records' "$PIPELINE_DIR/pipeline-state.json" > "$PIPELINE_DIR/temp.json" && mv "$PIPELINE_DIR/temp.json" "$PIPELINE_DIR/pipeline-state.json"
    
    update_pipeline_stage "extract" "completed"
    echo "Extracted $records_extracted analytics records"
}

# Transform and clean data
transform_data() {
    echo "Transforming and cleaning data..."
    update_pipeline_stage "transform" "running"
    
    # Create user behavior aggregations
    if [[ -f "$DATA_DIR/raw/analytics_events.csv" ]] && [[ -s "$DATA_DIR/raw/analytics_events.csv" ]]; then
        python3 << 'PYTHON_SCRIPT' > "$DATA_DIR/staging/user_behavior_summary.csv"
import pandas as pd
import json
from datetime import datetime, timedelta
import sys
import os

try:
    # Read analytics events
    events_df = pd.read_csv(os.environ['DATA_DIR'] + '/raw/analytics_events.csv')
    
    if len(events_df) == 0:
        print("user_id,recommendation_views,recommendation_clicks,recommendation_adoptions,template_views,template_applications,stack_creations,sessions,avg_session_duration,engagement_score")
        sys.exit(0)
    
    # Parse event_data JSON
    events_df['event_data'] = events_df['event_data'].apply(lambda x: json.loads(x) if pd.notna(x) and x.strip() else {})
    events_df['created_at'] = pd.to_datetime(events_df['created_at'])
    
    # Aggregate by user
    user_stats = events_df.groupby('user_id').agg({
        'id': 'count',  # total events
        'session_id': 'nunique'  # unique sessions
    }).rename(columns={'id': 'total_events', 'session_id': 'sessions'})
    
    # Count specific event types
    event_counts = events_df.pivot_table(
        index='user_id', 
        columns='event_type', 
        values='id', 
        aggfunc='count', 
        fill_value=0
    )
    
    # Merge aggregations
    result = user_stats.join(event_counts, how='outer').fillna(0)
    
    # Calculate engagement score
    def calculate_engagement_score(row):
        score = 0
        score += row.get('recommendation_view', 0) * 1
        score += row.get('recommendation_click', 0) * 3
        score += row.get('recommendation_adoption', 0) * 5
        score += row.get('template_view', 0) * 2
        score += row.get('template_application', 0) * 8
        score += row.get('stack_creation', 0) * 10
        return score
    
    result['engagement_score'] = result.apply(calculate_engagement_score, axis=1)
    
    # Select and rename columns
    output_columns = [
        'recommendation_view', 'recommendation_click', 'recommendation_adoption',
        'template_view', 'template_application', 'stack_creation',
        'sessions', 'engagement_score'
    ]
    
    result = result.reindex(columns=output_columns, fill_value=0)
    result.columns = [
        'recommendation_views', 'recommendation_clicks', 'recommendation_adoptions',
        'template_views', 'template_applications', 'stack_creations',
        'sessions', 'engagement_score'
    ]
    
    # Add average session duration (mock calculation)
    result['avg_session_duration'] = result['sessions'] * 300  # 5 minutes average
    
    # Output CSV
    result.to_csv(sys.stdout)

except Exception as e:
    print(f"Error processing data: {e}", file=sys.stderr)
    print("user_id,recommendation_views,recommendation_clicks,recommendation_adoptions,template_views,template_applications,stack_creations,sessions,avg_session_duration,engagement_score")

PYTHON_SCRIPT
    else
        echo "user_id,recommendation_views,recommendation_clicks,recommendation_adoptions,template_views,template_applications,stack_creations,sessions,avg_session_duration,engagement_score" > "$DATA_DIR/staging/user_behavior_summary.csv"
    fi
    
    # Create cohort analysis
    create_cohort_analysis
    
    # Create funnel analysis
    create_funnel_analysis
    
    update_pipeline_stage "transform" "completed"
    echo "Data transformation completed"
}

# Create cohort analysis
create_cohort_analysis() {
    if [[ -f "$DATA_DIR/raw/users.csv" ]] && [[ -s "$DATA_DIR/raw/users.csv" ]]; then
        python3 << 'PYTHON_SCRIPT' > "$DATA_DIR/staging/cohort_analysis.csv"
import pandas as pd
from datetime import datetime
import sys
import os

try:
    users_df = pd.read_csv(os.environ['DATA_DIR'] + '/raw/users.csv')
    events_df = pd.read_csv(os.environ['DATA_DIR'] + '/raw/analytics_events.csv')
    
    if len(users_df) == 0 or len(events_df) == 0:
        print("cohort_month,users_acquired,month_1_retention,month_2_retention,month_3_retention")
        sys.exit(0)
    
    users_df['created_at'] = pd.to_datetime(users_df['created_at'])
    events_df['created_at'] = pd.to_datetime(events_df['created_at'])
    
    # Create monthly cohorts
    users_df['cohort_month'] = users_df['created_at'].dt.to_period('M')
    
    # Calculate retention by month
    cohorts = []
    for cohort in users_df['cohort_month'].unique():
        cohort_users = users_df[users_df['cohort_month'] == cohort]['id'].tolist()
        cohort_start = pd.to_datetime(str(cohort))
        
        # Month 1 retention
        month_1_start = cohort_start + pd.DateOffset(months=1)
        month_1_end = cohort_start + pd.DateOffset(months=2)
        month_1_active = events_df[
            (events_df['user_id'].isin(cohort_users)) &
            (events_df['created_at'] >= month_1_start) &
            (events_df['created_at'] < month_1_end)
        ]['user_id'].nunique()
        
        # Month 2 retention  
        month_2_start = cohort_start + pd.DateOffset(months=2)
        month_2_end = cohort_start + pd.DateOffset(months=3)
        month_2_active = events_df[
            (events_df['user_id'].isin(cohort_users)) &
            (events_df['created_at'] >= month_2_start) &
            (events_df['created_at'] < month_2_end)
        ]['user_id'].nunique()
        
        # Month 3 retention
        month_3_start = cohort_start + pd.DateOffset(months=3)
        month_3_end = cohort_start + pd.DateOffset(months=4)
        month_3_active = events_df[
            (events_df['user_id'].isin(cohort_users)) &
            (events_df['created_at'] >= month_3_start) &
            (events_df['created_at'] < month_3_end)
        ]['user_id'].nunique()
        
        cohorts.append({
            'cohort_month': str(cohort),
            'users_acquired': len(cohort_users),
            'month_1_retention': month_1_active / len(cohort_users) if len(cohort_users) > 0 else 0,
            'month_2_retention': month_2_active / len(cohort_users) if len(cohort_users) > 0 else 0,
            'month_3_retention': month_3_active / len(cohort_users) if len(cohort_users) > 0 else 0
        })
    
    cohorts_df = pd.DataFrame(cohorts)
    cohorts_df.to_csv(sys.stdout, index=False)

except Exception as e:
    print(f"Error in cohort analysis: {e}", file=sys.stderr)
    print("cohort_month,users_acquired,month_1_retention,month_2_retention,month_3_retention")

PYTHON_SCRIPT
    else
        echo "cohort_month,users_acquired,month_1_retention,month_2_retention,month_3_retention" > "$DATA_DIR/staging/cohort_analysis.csv"
    fi
}

# Create funnel analysis
create_funnel_analysis() {
    if [[ -f "$DATA_DIR/raw/analytics_events.csv" ]] && [[ -s "$DATA_DIR/raw/analytics_events.csv" ]]; then
        python3 << 'PYTHON_SCRIPT' > "$DATA_DIR/staging/funnel_analysis.csv"
import pandas as pd
import sys
import os

try:
    events_df = pd.read_csv(os.environ['DATA_DIR'] + '/raw/analytics_events.csv')
    
    if len(events_df) == 0:
        print("stage,users,conversion_rate")
        sys.exit(0)
    
    # Define funnel stages
    funnel_stages = [
        ('visit', 'page_view'),
        ('view_recommendations', 'recommendation_view'),
        ('click_recommendation', 'recommendation_click'),
        ('adopt_recommendation', 'recommendation_adoption'),
        ('create_stack', 'stack_creation')
    ]
    
    total_users = events_df['user_id'].nunique()
    
    funnel_data = []
    prev_users = total_users
    
    for stage_name, event_type in funnel_stages:
        stage_users = events_df[events_df['event_type'] == event_type]['user_id'].nunique()
        conversion_rate = stage_users / prev_users if prev_users > 0 else 0
        
        funnel_data.append({
            'stage': stage_name,
            'users': stage_users,
            'conversion_rate': conversion_rate
        })
        
        prev_users = max(stage_users, 1)  # Prevent division by zero
    
    funnel_df = pd.DataFrame(funnel_data)
    funnel_df.to_csv(sys.stdout, index=False)

except Exception as e:
    print(f"Error in funnel analysis: {e}", file=sys.stderr)
    print("stage,users,conversion_rate")

PYTHON_SCRIPT
    else
        echo "stage,users,conversion_rate" > "$DATA_DIR/staging/funnel_analysis.csv"
    fi
}

# Generate insights
analyze_insights() {
    echo "Generating adoption insights..."
    update_pipeline_stage "analyze" "running"
    
    local insights_file="$INSIGHTS_DIR/adoption-insights-$(date +%Y%m%d).json"
    
    # Generate comprehensive insights
    cat > "$insights_file" << EOF
{
    "generated_at": "$(date -Iseconds)",
    "pipeline_id": "$PIPELINE_ID",
    "analysis_period": {
        "days": $LOOKBACK_DAYS,
        "start_date": "$(date -d "$LOOKBACK_DAYS days ago" -Iseconds 2>/dev/null || date -v -${LOOKBACK_DAYS}d -Iseconds)",
        "end_date": "$(date -Iseconds)"
    },
    "user_adoption": $(generate_user_adoption_insights),
    "feature_adoption": $(generate_feature_adoption_insights),
    "engagement_patterns": $(generate_engagement_insights),
    "recommendations": $(generate_recommendations)
}
EOF
    
    # Create summary report
    create_summary_report "$insights_file"
    
    update_pipeline_stage "analyze" "completed"
    echo "Insights generated: $insights_file"
}

# Generate user adoption insights
generate_user_adoption_insights() {
    local total_users=0
    local active_users=0
    local new_users=0
    
    if [[ -f "$DATA_DIR/staging/user_behavior_summary.csv" ]]; then
        total_users=$(tail -n +2 "$DATA_DIR/staging/user_behavior_summary.csv" | wc -l)
        active_users=$(tail -n +2 "$DATA_DIR/staging/user_behavior_summary.csv" | awk -F',' '$8 > 0' | wc -l)
    fi
    
    cat << JSON
{
    "total_users_analyzed": $total_users,
    "active_users": $active_users,
    "activation_rate": $(echo "scale=4; $active_users / $total_users" | bc -l 2>/dev/null || echo "0"),
    "segments": {
        "power_users": $(tail -n +2 "$DATA_DIR/staging/user_behavior_summary.csv" 2>/dev/null | awk -F',' '$9 > 50' | wc -l || echo "0"),
        "casual_users": $(tail -n +2 "$DATA_DIR/staging/user_behavior_summary.csv" 2>/dev/null | awk -F',' '$9 > 10 && $9 <= 50' | wc -l || echo "0"),
        "inactive_users": $(tail -n +2 "$DATA_DIR/staging/user_behavior_summary.csv" 2>/dev/null | awk -F',' '$9 <= 10' | wc -l || echo "0")
    }
}
JSON
}

# Generate feature adoption insights
generate_feature_adoption_insights() {
    local rec_adoption_rate=0
    local template_adoption_rate=0
    
    if [[ -f "$DATA_DIR/staging/user_behavior_summary.csv" ]]; then
        local total_users=$(tail -n +2 "$DATA_DIR/staging/user_behavior_summary.csv" | wc -l)
        local rec_users=$(tail -n +2 "$DATA_DIR/staging/user_behavior_summary.csv" | awk -F',' '$3 > 0' | wc -l)
        local template_users=$(tail -n +2 "$DATA_DIR/staging/user_behavior_summary.csv" | awk -F',' '$5 > 0' | wc -l)
        
        rec_adoption_rate=$(echo "scale=4; $rec_users / $total_users" | bc -l 2>/dev/null || echo "0")
        template_adoption_rate=$(echo "scale=4; $template_users / $total_users" | bc -l 2>/dev/null || echo "0")
    fi
    
    cat << JSON
{
    "ai_recommendations": {
        "adoption_rate": $rec_adoption_rate,
        "avg_views_per_user": $(tail -n +2 "$DATA_DIR/staging/user_behavior_summary.csv" 2>/dev/null | awk -F',' '{sum+=$2; count++} END {if(count>0) print sum/count; else print 0}' || echo "0"),
        "conversion_rate": $(tail -n +2 "$DATA_DIR/staging/user_behavior_summary.csv" 2>/dev/null | awk -F',' '$2 > 0 {views+=$2; adoptions+=$3} END {if(views>0) print adoptions/views; else print 0}' || echo "0")
    },
    "template_system": {
        "adoption_rate": $template_adoption_rate,
        "avg_views_per_user": $(tail -n +2 "$DATA_DIR/staging/user_behavior_summary.csv" 2>/dev/null | awk -F',' '{sum+=$4; count++} END {if(count>0) print sum/count; else print 0}' || echo "0"),
        "conversion_rate": $(tail -n +2 "$DATA_DIR/staging/user_behavior_summary.csv" 2>/dev/null | awk -F',' '$4 > 0 {views+=$4; apps+=$5} END {if(views>0) print apps/views; else print 0}' || echo "0")
    }
}
JSON
}

# Generate engagement insights
generate_engagement_insights() {
    cat << JSON
{
    "avg_engagement_score": $(tail -n +2 "$DATA_DIR/staging/user_behavior_summary.csv" 2>/dev/null | awk -F',' '{sum+=$9; count++} END {if(count>0) print sum/count; else print 0}' || echo "0"),
    "avg_sessions_per_user": $(tail -n +2 "$DATA_DIR/staging/user_behavior_summary.csv" 2>/dev/null | awk -F',' '{sum+=$7; count++} END {if(count>0) print sum/count; else print 0}' || echo "0"),
    "top_activities": [
        "recommendation_viewing",
        "template_browsing",
        "stack_creation"
    ]
}
JSON
}

# Generate recommendations
generate_recommendations() {
    local rec_adoption=$(tail -n +2 "$DATA_DIR/staging/user_behavior_summary.csv" 2>/dev/null | awk -F',' '$2 > 0 {views+=$2; adoptions+=$3} END {if(views>0) print adoptions/views; else print 0}' || echo "0")
    local template_adoption=$(tail -n +2 "$DATA_DIR/staging/user_behavior_summary.csv" 2>/dev/null | awk -F',' '$4 > 0 {views+=$4; apps+=$5} END {if(views>0) print apps/views; else print 0}' || echo "0")
    
    local recommendations="["
    
    if [[ $(echo "$rec_adoption < 0.1" | bc -l 2>/dev/null || echo "1") -eq 1 ]]; then
        recommendations+='"Improve AI recommendation relevance and positioning",'
    fi
    
    if [[ $(echo "$template_adoption < 0.05" | bc -l 2>/dev/null || echo "1") -eq 1 ]]; then
        recommendations+='"Enhance template discoverability and onboarding",'
    fi
    
    recommendations+='"Implement user onboarding improvements",'
    recommendations+='"Add more personalized content based on user behavior"'
    recommendations+="]"
    
    echo "$recommendations"
}

# Create summary report
create_summary_report() {
    local insights_file="$1"
    local summary_file="$INSIGHTS_DIR/adoption-summary-$(date +%Y%m%d).md"
    
    cat > "$summary_file" << EOF
# Stapelwerk Adoption Analytics Report

**Generated:** $(date)
**Analysis Period:** $LOOKBACK_DAYS days
**Pipeline ID:** $PIPELINE_ID

## Key Metrics

$(jq -r '.user_adoption | "- **Total Users Analyzed:** \(.total_users_analyzed)\n- **Active Users:** \(.active_users)\n- **Activation Rate:** \(.activation_rate * 100 | floor)%"' "$insights_file")

## Feature Adoption

### AI Recommendations
$(jq -r '.feature_adoption.ai_recommendations | "- **Adoption Rate:** \(.adoption_rate * 100 | floor)%\n- **Average Views per User:** \(.avg_views_per_user | floor)\n- **Conversion Rate:** \(.conversion_rate * 100 | floor)%"' "$insights_file")

### Template System
$(jq -r '.feature_adoption.template_system | "- **Adoption Rate:** \(.adoption_rate * 100 | floor)%\n- **Average Views per User:** \(.avg_views_per_user | floor)\n- **Conversion Rate:** \(.conversion_rate * 100 | floor)%"' "$insights_file")

## User Segments

$(jq -r '.user_adoption.segments | "- **Power Users:** \(.power_users)\n- **Casual Users:** \(.casual_users)\n- **Inactive Users:** \(.inactive_users)"' "$insights_file")

## Recommendations

$(jq -r '.recommendations | map("- " + .) | join("\n")' "$insights_file")

---

*This report was generated automatically by the Stapelwerk Analytics Pipeline.*
EOF
    
    echo "Summary report created: $summary_file"
}

# Update pipeline stage
update_pipeline_stage() {
    local stage="$1"
    local status="$2"
    
    jq --arg stage "$stage" --arg status "$status" '.stages[$stage] = $status | .status = $status' "$PIPELINE_DIR/pipeline-state.json" > "$PIPELINE_DIR/temp.json" && mv "$PIPELINE_DIR/temp.json" "$PIPELINE_DIR/pipeline-state.json"
}

# Run full pipeline
run_pipeline() {
    echo "Running full analytics pipeline..."
    
    extract_data
    transform_data
    analyze_insights
    
    # Update final status
    jq '.status = "completed" | .completedAt = now | .completedAt |= strftime("%Y-%m-%dT%H:%M:%SZ")' "$PIPELINE_DIR/pipeline-state.json" > "$PIPELINE_DIR/temp.json" && mv "$PIPELINE_DIR/temp.json" "$PIPELINE_DIR/pipeline-state.json"
    
    echo -e "${GREEN}Analytics pipeline completed successfully!${NC}"
    echo "Results available in: $INSIGHTS_DIR"
}

# Help function
show_help() {
    cat << EOF
Stapelwerk Adoption Analytics Pipeline

Usage: $0 <command> [options]

Commands:
  run                   Run full analytics pipeline
  extract               Extract data only
  transform             Transform data only
  analyze               Generate insights only
  status                Show pipeline status

Options:
  --batch-size N        Batch processing size (default: 1000)
  --lookback-days N     Days to look back for analysis (default: 30)
  --min-session N       Minimum session duration in seconds (default: 60)
  --help               Show this help message

Environment Variables:
  DATABASE_URL         Database connection string

Examples:
  # Run full pipeline
  $0 run

  # Extract data with 7-day lookback
  $0 extract --lookback-days 7

  # Run pipeline with larger batch size
  $0 run --batch-size 5000
EOF
}

# Show pipeline status
show_status() {
    if [[ -f "$PIPELINE_DIR/pipeline-state.json" ]]; then
        echo -e "${BOLD}Pipeline Status${NC}"
        echo
        jq -r '
            "Pipeline ID: " + .pipelineId,
            "Status: " + .status,
            "Started: " + .startTime,
            "",
            "Stages:",
            "  Extract: " + .stages.extract,
            "  Transform: " + .stages.transform,
            "  Analyze: " + .stages.analyze,
            "",
            "Metrics:",
            "  Records Processed: " + (.metrics.recordsProcessed | tostring),
            "  Users Analyzed: " + (.metrics.usersAnalyzed | tostring),
            "  Insights Generated: " + (.metrics.insightsGenerated | tostring)
        ' "$PIPELINE_DIR/pipeline-state.json"
    else
        echo "No pipeline status found. Run the pipeline first."
    fi
}

# Parse command line arguments
COMMAND="${1:-run}"
shift || true

while [[ $# -gt 0 ]]; do
    case $1 in
        --batch-size)
            BATCH_SIZE="$2"
            shift 2
            ;;
        --lookback-days)
            LOOKBACK_DAYS="$2"
            shift 2
            ;;
        --min-session)
            MIN_SESSION_DURATION="$2"
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
    init_pipeline
    
    case "$COMMAND" in
        "run")
            run_pipeline
            ;;
        "extract")
            extract_data
            ;;
        "transform")
            transform_data
            ;;
        "analyze")
            analyze_insights
            ;;
        "status")
            show_status
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