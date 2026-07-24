#!/bin/bash
# K3s Cluster Teardown Script
# Safely removes K3s and optionally cleans up volumes

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DRY_RUN="${DRY_RUN:-false}"
CLEAN_VOLUMES="${CLEAN_VOLUMES:-false}"
FORCE="${FORCE:-false}"
NODE_TYPE="${NODE_TYPE:-server}" # server or agent

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

log_debug() {
    echo -e "${BLUE}[DEBUG]${NC} $1"
}

check_k3s_installation() {
    log_info "Checking K3s installation..."
    
    if command -v k3s &> /dev/null; then
        log_info "K3s installation found"
        k3s --version || true
        return 0
    else
        log_warn "K3s is not installed on this system"
        return 1
    fi
}

backup_important_data() {
    log_info "Creating backup of important data..."
    
    local backup_dir="/tmp/k3s-backup-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$backup_dir"
    
    # Backup kubeconfig if exists
    if [ -f /etc/rancher/k3s/k3s.yaml ]; then
        cp /etc/rancher/k3s/k3s.yaml "$backup_dir/k3s.yaml.backup"
        log_info "Kubeconfig backed up to $backup_dir/k3s.yaml.backup"
    fi
    
    # Backup token if exists
    if [ -f /var/lib/rancher/k3s/server/node-token ]; then
        cp /var/lib/rancher/k3s/server/node-token "$backup_dir/node-token.backup"
        log_info "Node token backed up to $backup_dir/node-token.backup"
    fi
    
    # List persistent volumes (for reference)
    if command -v k3s &> /dev/null; then
        k3s kubectl get pv -o wide > "$backup_dir/persistent-volumes.txt" 2>/dev/null || true
        k3s kubectl get pvc --all-namespaces -o wide > "$backup_dir/persistent-volume-claims.txt" 2>/dev/null || true
    fi
    
    log_info "Backup completed at: $backup_dir"
}

uninstall_helm_releases() {
    log_info "Checking for Helm releases..."
    
    if ! command -v helm &> /dev/null; then
        log_debug "Helm not installed, skipping Helm cleanup"
        return 0
    fi
    
    if [ "$DRY_RUN" == "true" ]; then
        log_info "[DRY RUN] Would uninstall the following Helm releases:"
        helm list --all-namespaces 2>/dev/null || true
        return 0
    fi
    
    # Get all Helm releases
    local releases=$(helm list --all-namespaces -q 2>/dev/null || echo "")
    
    if [ -z "$releases" ]; then
        log_info "No Helm releases found"
        return 0
    fi
    
    log_info "Found Helm releases to uninstall:"
    echo "$releases"
    
    # Uninstall each release
    while IFS= read -r release; do
        if [ -n "$release" ]; then
            local namespace=$(helm list --all-namespaces | grep "^$release" | awk '{print $2}')
            log_info "Uninstalling Helm release: $release (namespace: $namespace)"
            helm uninstall "$release" -n "$namespace" --wait || log_warn "Failed to uninstall $release"
        fi
    done <<< "$releases"
    
    # Special handling for cert-manager CRDs
    if k3s kubectl get crd certificates.cert-manager.io &>/dev/null; then
        log_info "Removing cert-manager CRDs..."
        k3s kubectl delete crd \
            certificaterequests.cert-manager.io \
            certificates.cert-manager.io \
            challenges.acme.cert-manager.io \
            clusterissuers.cert-manager.io \
            issuers.cert-manager.io \
            orders.acme.cert-manager.io 2>/dev/null || true
    fi
}

drain_node() {
    local node_name="${1:-$(hostname)}"
    
    log_info "Draining node: $node_name"
    
    if [ "$DRY_RUN" == "true" ]; then
        log_info "[DRY RUN] Would drain node: $node_name"
        return 0
    fi
    
    # Check if node exists
    if ! k3s kubectl get node "$node_name" &>/dev/null; then
        log_warn "Node $node_name not found in cluster"
        return 0
    fi
    
    # Drain the node
    k3s kubectl drain "$node_name" \
        --ignore-daemonsets \
        --delete-emptydir-data \
        --force \
        --timeout=60s || log_warn "Failed to drain node $node_name"
    
    # Delete the node
    k3s kubectl delete node "$node_name" || log_warn "Failed to delete node $node_name"
}

stop_k3s_services() {
    log_info "Stopping K3s services..."
    
    if [ "$DRY_RUN" == "true" ]; then
        log_info "[DRY RUN] Would stop K3s services"
        systemctl status k3s 2>/dev/null || true
        systemctl status k3s-agent 2>/dev/null || true
        return 0
    fi
    
    # Stop K3s server
    if systemctl is-active --quiet k3s; then
        log_info "Stopping k3s service..."
        systemctl stop k3s
        systemctl disable k3s
    fi
    
    # Stop K3s agent
    if systemctl is-active --quiet k3s-agent; then
        log_info "Stopping k3s-agent service..."
        systemctl stop k3s-agent
        systemctl disable k3s-agent
    fi
    
    # Kill any remaining k3s processes
    log_info "Killing remaining k3s processes..."
    pkill -9 -f "k3s" || true
}

uninstall_k3s() {
    log_info "Uninstalling K3s..."
    
    if [ "$DRY_RUN" == "true" ]; then
        log_info "[DRY RUN] Would run K3s uninstall script"
        [ -f /usr/local/bin/k3s-uninstall.sh ] && echo "  Server uninstall script found"
        [ -f /usr/local/bin/k3s-agent-uninstall.sh ] && echo "  Agent uninstall script found"
        return 0
    fi
    
    # Run the appropriate uninstall script
    if [ "$NODE_TYPE" == "server" ] && [ -f /usr/local/bin/k3s-uninstall.sh ]; then
        log_info "Running K3s server uninstall script..."
        /usr/local/bin/k3s-uninstall.sh
    elif [ "$NODE_TYPE" == "agent" ] && [ -f /usr/local/bin/k3s-agent-uninstall.sh ]; then
        log_info "Running K3s agent uninstall script..."
        /usr/local/bin/k3s-agent-uninstall.sh
    else
        log_warn "K3s uninstall script not found, performing manual cleanup..."
        manual_cleanup
    fi
}

manual_cleanup() {
    log_info "Performing manual K3s cleanup..."
    
    if [ "$DRY_RUN" == "true" ]; then
        log_info "[DRY RUN] Would perform manual cleanup of K3s files and directories"
        return 0
    fi
    
    # Remove K3s binaries
    rm -f /usr/local/bin/k3s
    rm -f /usr/local/bin/k3s-killall.sh
    rm -f /usr/local/bin/k3s-uninstall.sh
    rm -f /usr/local/bin/k3s-agent-uninstall.sh
    rm -f /usr/local/bin/kubectl
    rm -f /usr/local/bin/crictl
    rm -f /usr/local/bin/ctr
    
    # Remove K3s data
    rm -rf /var/lib/rancher/k3s
    rm -rf /etc/rancher/k3s
    
    # Remove systemd units
    rm -f /etc/systemd/system/k3s.service
    rm -f /etc/systemd/system/k3s.service.env
    rm -f /etc/systemd/system/k3s-agent.service
    rm -f /etc/systemd/system/k3s-agent.service.env
    
    # Reload systemd
    systemctl daemon-reload
}

cleanup_network_interfaces() {
    log_info "Cleaning up network interfaces..."
    
    if [ "$DRY_RUN" == "true" ]; then
        log_info "[DRY RUN] Would clean up network interfaces (cni0, flannel.1)"
        ip link show | grep -E "cni0|flannel" || true
        return 0
    fi
    
    # Remove CNI interfaces
    ip link delete cni0 2>/dev/null || true
    ip link delete flannel.1 2>/dev/null || true
    
    # Remove bridge interfaces
    for i in $(ip link show | grep "veth" | awk -F: '{print $2}' | tr -d ' '); do
        ip link delete "$i" 2>/dev/null || true
    done
    
    # Clean iptables rules added by K3s
    iptables-save | grep -v "KUBE\|CNI\|FLANNEL" | iptables-restore 2>/dev/null || true
}

cleanup_volumes() {
    log_info "Cleaning up volumes..."
    
    if [ "$CLEAN_VOLUMES" != "true" ]; then
        log_warn "Volume cleanup skipped. Use --clean-volumes to remove persistent data."
        return 0
    fi
    
    if [ "$DRY_RUN" == "true" ]; then
        log_info "[DRY RUN] Would clean up the following volumes:"
        find /var/lib/rancher -type d -name "pv-*" 2>/dev/null || true
        return 0
    fi
    
    log_warn "⚠️  This will DELETE all persistent volume data!"
    if [ "$FORCE" != "true" ]; then
        read -p "Are you SURE you want to delete all volume data? Type 'yes' to confirm: " confirmation
        if [ "$confirmation" != "yes" ]; then
            log_info "Volume cleanup cancelled"
            return 0
        fi
    fi
    
    # Remove local-path-provisioner data
    rm -rf /var/lib/rancher/k3s/storage/*
    
    # Remove any custom PV directories
    find /var/lib/rancher -type d -name "pv-*" -exec rm -rf {} + 2>/dev/null || true
}

cleanup_docker_resources() {
    log_info "Checking for Docker resources..."
    
    if ! command -v docker &> /dev/null; then
        log_debug "Docker not installed, skipping Docker cleanup"
        return 0
    fi
    
    if [ "$DRY_RUN" == "true" ]; then
        log_info "[DRY RUN] Would clean up Docker resources:"
        docker ps -a --filter "label=io.kubernetes" --format "table {{.Names}}\t{{.Status}}" 2>/dev/null || true
        return 0
    fi
    
    # Stop and remove K3s-related containers
    local containers=$(docker ps -aq --filter "label=io.kubernetes" 2>/dev/null || echo "")
    if [ -n "$containers" ]; then
        log_info "Removing Kubernetes-related Docker containers..."
        docker rm -f $containers || true
    fi
    
    # Remove K3s-related volumes
    local volumes=$(docker volume ls -q --filter "label=io.kubernetes" 2>/dev/null || echo "")
    if [ -n "$volumes" ]; then
        log_info "Removing Kubernetes-related Docker volumes..."
        docker volume rm $volumes || true
    fi
}

verify_cleanup() {
    log_info "Verifying cleanup..."
    
    local issues=0
    
    # Check for K3s binary
    if command -v k3s &> /dev/null; then
        log_warn "K3s binary still exists"
        ((issues++))
    fi
    
    # Check for K3s processes
    if pgrep -f "k3s" > /dev/null; then
        log_warn "K3s processes still running"
        ((issues++))
    fi
    
    # Check for K3s directories
    if [ -d /var/lib/rancher/k3s ] || [ -d /etc/rancher/k3s ]; then
        log_warn "K3s directories still exist"
        ((issues++))
    fi
    
    # Check for systemd services
    if systemctl list-units --all | grep -q k3s; then
        log_warn "K3s systemd services still registered"
        ((issues++))
    fi
    
    if [ $issues -eq 0 ]; then
        log_info "✅ Cleanup verification passed - K3s has been completely removed"
    else
        log_warn "⚠️  Cleanup verification found $issues issue(s) - manual intervention may be required"
    fi
}

print_usage() {
    cat <<EOF
Usage: $0 [OPTIONS]

Options:
    --type <server|agent>     Node type to uninstall (default: server)
    --clean-volumes          Remove persistent volume data (DANGEROUS!)
    --force                  Skip confirmation prompts
    --dry-run                Show what would be done without executing
    --help                   Show this help message

Examples:
    # Uninstall K3s server (preserves volumes)
    $0
    
    # Uninstall K3s agent
    $0 --type agent
    
    # Complete cleanup including volumes
    $0 --clean-volumes --force
    
    # Dry run to see what would be removed
    $0 --dry-run --clean-volumes

WARNING: This script will remove K3s and all its components.
         Use --clean-volumes with caution as it will DELETE all persistent data!

EOF
    exit 0
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --type)
            NODE_TYPE="$2"
            shift 2
            ;;
        --clean-volumes)
            CLEAN_VOLUMES="true"
            shift
            ;;
        --force)
            FORCE="true"
            shift
            ;;
        --dry-run)
            DRY_RUN="true"
            shift
            ;;
        --help)
            print_usage
            ;;
        *)
            log_error "Unknown option: $1"
            ;;
    esac
done

# Main execution
main() {
    log_info "Starting K3s teardown process..."
    log_info "Configuration:"
    log_info "  Node Type: $NODE_TYPE"
    log_info "  Clean Volumes: $CLEAN_VOLUMES"
    log_info "  Force: $FORCE"
    log_info "  Dry Run: $DRY_RUN"
    
    # Safety check
    if [ "$DRY_RUN" != "true" ] && [ "$FORCE" != "true" ]; then
        echo -e "${YELLOW}⚠️  WARNING: This will remove K3s from your system!${NC}"
        if [ "$CLEAN_VOLUMES" == "true" ]; then
            echo -e "${RED}⚠️  DANGER: --clean-volumes will DELETE all persistent data!${NC}"
        fi
        read -p "Are you sure you want to continue? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Teardown cancelled"
            exit 0
        fi
    fi
    
    # Check if K3s is installed
    if ! check_k3s_installation && [ "$FORCE" != "true" ]; then
        log_info "K3s is not installed, nothing to do"
        exit 0
    fi
    
    # Backup important data
    if [ "$DRY_RUN" != "true" ]; then
        backup_important_data
    fi
    
    # Uninstall Helm releases
    uninstall_helm_releases
    
    # Drain and remove node (for server)
    if [ "$NODE_TYPE" == "server" ] && command -v k3s &> /dev/null; then
        drain_node
    fi
    
    # Stop K3s services
    stop_k3s_services
    
    # Uninstall K3s
    uninstall_k3s
    
    # Cleanup network interfaces
    cleanup_network_interfaces
    
    # Cleanup volumes (if requested)
    cleanup_volumes
    
    # Cleanup Docker resources
    cleanup_docker_resources
    
    # Verify cleanup
    verify_cleanup
    
    log_info "=========================================="
    log_info "K3s teardown completed"
    log_info "=========================================="
    
    if [ "$CLEAN_VOLUMES" == "true" ]; then
        log_warn "All persistent volume data has been removed"
    else
        log_info "Persistent volumes were preserved. Use --clean-volumes to remove them."
    fi
}

# Check if running as root (required for most cleanup operations)
if [[ $EUID -ne 0 ]] && [ "$DRY_RUN" != "true" ]; then
    log_warn "This script should be run as root for complete cleanup"
    log_info "Attempting to use sudo..."
    exec sudo "$0" "$@"
fi

# Run main function
main