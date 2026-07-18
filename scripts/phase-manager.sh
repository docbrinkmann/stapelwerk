#!/bin/bash

# Deployment Phase Management System
# Manages deployment phases with dependency tracking and execution coordination
# Usage: ./phase-manager.sh [options]

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PHASES_DIR="$PROJECT_DIR/.deployment-phases"
LOG_DIR="$PROJECT_DIR/logs/phases"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

# Phase definitions with dependencies
declare -A PHASE_DEPENDENCIES=(
    [pre_deployment_validation]=""
    [infrastructure_deployment]="pre_deployment_validation"
    [database_migration]="infrastructure_deployment"
    [application_deployment]="database_migration"
    [feature_flag_activation]="application_deployment"
    [smoke_testing]="feature_flag_activation"
    [gradual_rollout]="smoke_testing"
    [post_deployment_validation]="gradual_rollout"
)

declare -A PHASE_STATUS=()
declare -A PHASE_START_TIME=()
declare -A PHASE_END_TIME=()
declare -A PHASE_ERRORS=()

# Initialize phase management
init_phase_manager() {
    echo -e "${BOLD}${BLUE}=== Deployment Phase Manager ===${NC}"
    echo -e "${CYAN}Session: $(date +%Y%m%d-%H%M%S)${NC}"
    echo

    mkdir -p "$PHASES_DIR" "$LOG_DIR"

    # Initialize all phases as pending
    for phase in "${!PHASE_DEPENDENCIES[@]}"; do
        PHASE_STATUS[$phase]="pending"
        PHASE_START_TIME[$phase]=""
        PHASE_END_TIME[$phase]=""
        PHASE_ERRORS[$phase]=""
    done

    # Create phase state file
    save_phase_state
}

# Save current phase state
save_phase_state() {
    local state_file="$PHASES_DIR/current-state.json"
    
    local json_content='{}'
    for phase in "${!PHASE_DEPENDENCIES[@]}"; do
        json_content=$(echo "$json_content" | jq \
            --arg phase "$phase" \
            --arg status "${PHASE_STATUS[$phase]}" \
            --arg start_time "${PHASE_START_TIME[$phase]}" \
            --arg end_time "${PHASE_END_TIME[$phase]}" \
            --arg errors "${PHASE_ERRORS[$phase]}" \
            '. + {($phase): {status: $status, start_time: $start_time, end_time: $end_time, errors: $errors}}')
    done
    
    echo "$json_content" | jq --arg timestamp "$(date -Iseconds)" '. + {last_updated: $timestamp}' > "$state_file"
}

# Load phase state
load_phase_state() {
    local state_file="$PHASES_DIR/current-state.json"
    
    if [[ -f "$state_file" ]]; then
        for phase in "${!PHASE_DEPENDENCIES[@]}"; do
            PHASE_STATUS[$phase]=$(jq -r ".\"$phase\".status // \"pending\"" "$state_file")
            PHASE_START_TIME[$phase]=$(jq -r ".\"$phase\".start_time // \"\"" "$state_file")
            PHASE_END_TIME[$phase]=$(jq -r ".\"$phase\".end_time // \"\"" "$state_file")
            PHASE_ERRORS[$phase]=$(jq -r ".\"$phase\".errors // \"\"" "$state_file")
        done
        echo "Loaded existing phase state"
    fi
}

# Check if phase dependencies are satisfied
check_dependencies() {
    local phase="$1"
    local deps="${PHASE_DEPENDENCIES[$phase]}"
    
    if [[ -z "$deps" ]]; then
        return 0  # No dependencies
    fi
    
    IFS=' ' read -ra DEP_ARRAY <<< "$deps"
    for dep in "${DEP_ARRAY[@]}"; do
        if [[ "${PHASE_STATUS[$dep]}" != "completed" ]]; then
            echo "Dependency not satisfied: $dep is ${PHASE_STATUS[$dep]}"
            return 1
        fi
    done
    
    return 0
}

# Get phases that are ready to execute
get_ready_phases() {
    local ready_phases=()
    
    for phase in "${!PHASE_DEPENDENCIES[@]}"; do
        if [[ "${PHASE_STATUS[$phase]}" == "pending" ]] && check_dependencies "$phase"; then
            ready_phases+=("$phase")
        fi
    done
    
    printf '%s\n' "${ready_phases[@]}"
}

# Execute a phase
execute_phase() {
    local phase="$1"
    local deployment_script="${2:-$SCRIPT_DIR/execute-production-deployment.sh}"
    
    echo -e "${CYAN}Starting phase: $phase${NC}"
    
    PHASE_STATUS[$phase]="running"
    PHASE_START_TIME[$phase]=$(date -Iseconds)
    save_phase_state
    
    # Execute the phase function from deployment script
    if [[ -f "$deployment_script" ]]; then
        # Source the deployment script and call the specific phase function
        set +e  # Don't exit on error for phase execution
        (
            source "$deployment_script" 2>/dev/null || true
            if declare -f "phase_${phase}" &>/dev/null; then
                "phase_${phase}"
            else
                echo "Phase function phase_${phase} not found"
                exit 1
            fi
        ) 2>&1 | tee "$LOG_DIR/${phase}.log"
        
        local exit_code=$?
        set -e
        
        if [[ $exit_code -eq 0 ]]; then
            PHASE_STATUS[$phase]="completed"
            PHASE_END_TIME[$phase]=$(date -Iseconds)
            echo -e "${GREEN}Phase completed: $phase${NC}"
        else
            PHASE_STATUS[$phase]="failed"
            PHASE_END_TIME[$phase]=$(date -Iseconds)
            PHASE_ERRORS[$phase]="Phase execution failed with exit code $exit_code"
            echo -e "${RED}Phase failed: $phase${NC}"
        fi
    else
        PHASE_STATUS[$phase]="failed"
        PHASE_END_TIME[$phase]=$(date -Iseconds)
        PHASE_ERRORS[$phase]="Deployment script not found: $deployment_script"
        echo -e "${RED}Phase failed: $phase (script not found)${NC}"
    fi
    
    save_phase_state
    return $exit_code
}

# Mark phase as completed (for manual override)
mark_phase_completed() {
    local phase="$1"
    
    if [[ -n "${PHASE_DEPENDENCIES[$phase]:-}" ]]; then
        PHASE_STATUS[$phase]="completed"
        PHASE_END_TIME[$phase]=$(date -Iseconds)
        save_phase_state
        echo -e "${GREEN}Phase marked as completed: $phase${NC}"
    else
        echo -e "${RED}Unknown phase: $phase${NC}"
        return 1
    fi
}

# Mark phase as failed (for manual override)
mark_phase_failed() {
    local phase="$1"
    local error_message="${2:-Manual failure}"
    
    if [[ -n "${PHASE_DEPENDENCIES[$phase]:-}" ]]; then
        PHASE_STATUS[$phase]="failed"
        PHASE_END_TIME[$phase]=$(date -Iseconds)
        PHASE_ERRORS[$phase]="$error_message"
        save_phase_state
        echo -e "${RED}Phase marked as failed: $phase${NC}"
    else
        echo -e "${RED}Unknown phase: $phase${NC}"
        return 1
    fi
}

# Reset phase status
reset_phase() {
    local phase="$1"
    
    if [[ -n "${PHASE_DEPENDENCIES[$phase]:-}" ]]; then
        PHASE_STATUS[$phase]="pending"
        PHASE_START_TIME[$phase]=""
        PHASE_END_TIME[$phase]=""
        PHASE_ERRORS[$phase]=""
        save_phase_state
        echo -e "${YELLOW}Phase reset to pending: $phase${NC}"
    else
        echo -e "${RED}Unknown phase: $phase${NC}"
        return 1
    fi
}

# Show phase status
show_status() {
    echo -e "${BOLD}Deployment Phase Status:${NC}"
    echo
    
    local completed_count=0
    local failed_count=0
    local running_count=0
    local pending_count=0
    
    for phase in "${!PHASE_DEPENDENCIES[@]}"; do
        local status="${PHASE_STATUS[$phase]}"
        local status_color=""
        
        case "$status" in
            "completed")
                status_color="$GREEN"
                ((completed_count++))
                ;;
            "failed")
                status_color="$RED"
                ((failed_count++))
                ;;
            "running")
                status_color="$YELLOW"
                ((running_count++))
                ;;
            "pending")
                status_color="$CYAN"
                ((pending_count++))
                ;;
        esac
        
        printf "  %-30s ${status_color}%-12s${NC}" "$phase" "$status"
        
        # Show timing information if available
        if [[ -n "${PHASE_START_TIME[$phase]}" ]]; then
            local start_time="${PHASE_START_TIME[$phase]}"
            local end_time="${PHASE_END_TIME[$phase]}"
            
            if [[ -n "$end_time" ]]; then
                local start_epoch=$(date -j -f "%Y-%m-%dT%H:%M:%S" "${start_time%.*}" "+%s" 2>/dev/null || echo "0")
                local end_epoch=$(date -j -f "%Y-%m-%dT%H:%M:%S" "${end_time%.*}" "+%s" 2>/dev/null || echo "0")
                local duration=$((end_epoch - start_epoch))
                printf " (${duration}s)"
            else
                printf " (running...)"
            fi
        fi
        
        # Show error if failed
        if [[ "$status" == "failed" && -n "${PHASE_ERRORS[$phase]}" ]]; then
            printf "\n    ${RED}Error: ${PHASE_ERRORS[$phase]}${NC}"
        fi
        
        printf "\n"
    done
    
    echo
    echo -e "${BOLD}Summary:${NC}"
    echo -e "  ${GREEN}Completed: $completed_count${NC}"
    echo -e "  ${RED}Failed: $failed_count${NC}"
    echo -e "  ${YELLOW}Running: $running_count${NC}"
    echo -e "  ${CYAN}Pending: $pending_count${NC}"
}

# Show dependency graph
show_dependencies() {
    echo -e "${BOLD}Phase Dependencies:${NC}"
    echo
    
    for phase in "${!PHASE_DEPENDENCIES[@]}"; do
        local deps="${PHASE_DEPENDENCIES[$phase]}"
        printf "  %-30s <- " "$phase"
        
        if [[ -z "$deps" ]]; then
            echo "(no dependencies)"
        else
            echo "$deps"
        fi
    done
}

# Auto-execute ready phases
auto_execute() {
    local max_concurrent="${1:-1}"
    local deployment_script="${2:-$SCRIPT_DIR/execute-production-deployment.sh}"
    
    echo "Starting auto-execution (max concurrent: $max_concurrent)"
    
    while true; do
        local ready_phases
        ready_phases=($(get_ready_phases))
        
        if [[ ${#ready_phases[@]} -eq 0 ]]; then
            # Check if all phases are completed or if there are failures
            local pending_count=0
            local failed_count=0
            
            for phase in "${!PHASE_DEPENDENCIES[@]}"; do
                case "${PHASE_STATUS[$phase]}" in
                    "pending") ((pending_count++)) ;;
                    "failed") ((failed_count++)) ;;
                esac
            done
            
            if [[ $pending_count -eq 0 ]]; then
                if [[ $failed_count -gt 0 ]]; then
                    echo -e "${RED}Deployment failed - $failed_count phase(s) failed${NC}"
                    return 1
                else
                    echo -e "${GREEN}All phases completed successfully${NC}"
                    return 0
                fi
            else
                echo -e "${YELLOW}No phases ready to execute, but $pending_count still pending${NC}"
                echo "This might indicate a dependency issue or all phases are blocked"
                return 1
            fi
        fi
        
        # Execute ready phases (up to max_concurrent)
        local executed=0
        for phase in "${ready_phases[@]}"; do
            if [[ $executed -ge $max_concurrent ]]; then
                break
            fi
            
            execute_phase "$phase" "$deployment_script" &
            ((executed++))
        done
        
        # Wait for all background jobs to complete
        wait
        
        # Small delay before checking again
        sleep 2
    done
}

# Help function
show_help() {
    cat << EOF
Deployment Phase Management System

Usage: $0 <command> [options]

Commands:
  status                    Show current phase status
  dependencies              Show phase dependency graph
  ready                     List phases ready to execute
  execute <phase>           Execute a specific phase
  mark-completed <phase>    Mark phase as completed
  mark-failed <phase>       Mark phase as failed
  reset <phase>             Reset phase to pending
  reset-all                 Reset all phases to pending
  auto-execute [N]          Auto-execute ready phases (max N concurrent)
  
Options:
  --script PATH             Path to deployment script (default: execute-production-deployment.sh)
  --help                    Show this help message

Examples:
  # Show current status
  $0 status

  # Execute specific phase
  $0 execute pre_deployment_validation

  # Auto-execute with max 2 concurrent phases
  $0 auto-execute 2

  # Reset a failed phase
  $0 reset database_migration
EOF
}

# Parse command line arguments
COMMAND="${1:-status}"
shift || true

DEPLOYMENT_SCRIPT="$SCRIPT_DIR/execute-production-deployment.sh"

while [[ $# -gt 0 ]]; do
    case $1 in
        --script)
            DEPLOYMENT_SCRIPT="$2"
            shift 2
            ;;
        --help)
            show_help
            exit 0
            ;;
        -*)
            echo "Unknown option: $1"
            show_help
            exit 1
            ;;
        *)
            # This is a command argument
            break
            ;;
    esac
done

# Main execution
main() {
    init_phase_manager
    load_phase_state
    
    case "$COMMAND" in
        "status")
            show_status
            ;;
        "dependencies")
            show_dependencies
            ;;
        "ready")
            echo -e "${BOLD}Ready phases:${NC}"
            get_ready_phases
            ;;
        "execute")
            local phase="${1:-}"
            if [[ -z "$phase" ]]; then
                echo "Error: Phase name required"
                show_help
                exit 1
            fi
            execute_phase "$phase" "$DEPLOYMENT_SCRIPT"
            ;;
        "mark-completed")
            local phase="${1:-}"
            if [[ -z "$phase" ]]; then
                echo "Error: Phase name required"
                show_help
                exit 1
            fi
            mark_phase_completed "$phase"
            ;;
        "mark-failed")
            local phase="${1:-}"
            local error="${2:-Manual failure}"
            if [[ -z "$phase" ]]; then
                echo "Error: Phase name required"
                show_help
                exit 1
            fi
            mark_phase_failed "$phase" "$error"
            ;;
        "reset")
            local phase="${1:-}"
            if [[ -z "$phase" ]]; then
                echo "Error: Phase name required"
                show_help
                exit 1
            fi
            reset_phase "$phase"
            ;;
        "reset-all")
            for phase in "${!PHASE_DEPENDENCIES[@]}"; do
                reset_phase "$phase"
            done
            ;;
        "auto-execute")
            local max_concurrent="${1:-1}"
            auto_execute "$max_concurrent" "$DEPLOYMENT_SCRIPT"
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