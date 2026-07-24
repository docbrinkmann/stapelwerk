#!/bin/bash
# K3s Cluster Provisioning Script
# Supports single-node and multi-node K3s installation with ingress-nginx

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K3S_VERSION="${K3S_VERSION:-latest}"
CLUSTER_PROFILE="${CLUSTER_PROFILE:-single-node}" # single-node, ha-embedded, ha-external
INSTALL_INGRESS="${INSTALL_INGRESS:-true}"
INSTALL_CERT_MANAGER="${INSTALL_CERT_MANAGER:-false}"
INSTALL_METRICS_SERVER="${INSTALL_METRICS_SERVER:-false}"
DRY_RUN="${DRY_RUN:-false}"
NODE_TYPE="${NODE_TYPE:-server}" # server or agent
SERVER_URL="${SERVER_URL:-}"
TOKEN="${TOKEN:-}"
CLUSTER_INIT="${CLUSTER_INIT:-false}" # For HA embedded etcd
DISABLE_TRAEFIK="${DISABLE_TRAEFIK:-true}"
DISABLE_SERVICELB="${DISABLE_SERVICELB:-false}"
DISABLE_LOCAL_STORAGE="${DISABLE_LOCAL_STORAGE:-false}"
KUBECONFIG_PATH="${KUBECONFIG_PATH:-$HOME/.kube/config}"
KUBECONFIG_EXPORT_PATH="${KUBECONFIG_EXPORT_PATH:-$HOME/.kube/config-k3s}"
FLANNEL_BACKEND="${FLANNEL_BACKEND:-vxlan}" # vxlan, ipsec, wireguard, host-gw
CLUSTER_CIDR="${CLUSTER_CIDR:-10.42.0.0/16}"
SERVICE_CIDR="${SERVICE_CIDR:-10.43.0.0/16}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

check_prerequisites() {
    log_info "Running comprehensive preflight checks..."
    
    local errors=0
    local warnings=0
    
    # Check OS
    log_info "Checking operating system..."
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        log_info "  ✓ Linux detected"
        # Check Linux distribution
        if [ -f /etc/os-release ]; then
            . /etc/os-release
            log_info "  ✓ Distribution: $NAME $VERSION"
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        log_info "  ✓ macOS detected"
        log_warn "  ⚠ K3s on macOS requires Docker Desktop or a Linux VM"
        ((warnings++))
    else
        log_error "  ✗ Unsupported OS: $OSTYPE"
        ((errors++))
    fi
    
    # Check architecture
    local arch=$(uname -m)
    case $arch in
        x86_64|amd64)
            log_info "  ✓ Architecture: amd64"
            ;;
        aarch64|arm64)
            log_info "  ✓ Architecture: arm64"
            ;;
        armv7l|armhf)
            log_info "  ✓ Architecture: armhf"
            ;;
        *)
            log_error "  ✗ Unsupported architecture: $arch"
            ((errors++))
            ;;
    esac
    
    # Check if running as root (required for K3s)
    if [[ $EUID -ne 0 ]] && [[ "$NODE_TYPE" == "server" ]]; then
        log_warn "This script should be run as root for server installation"
        log_info "Attempting to use sudo..."
        exec sudo "$0" "$@"
    fi
    
    # Check kernel version
    log_info "Checking kernel version..."
    local kernel_version=$(uname -r)
    log_info "  ✓ Kernel: $kernel_version"
    
    # Check required kernel modules
    log_info "Checking kernel modules..."
    local required_modules=("br_netfilter" "overlay")
    for mod in "${required_modules[@]}"; do
        if lsmod | grep -q "^$mod"; then
            log_info "  ✓ Module $mod loaded"
        else
            log_warn "  ⚠ Module $mod not loaded, attempting to load..."
            modprobe $mod 2>/dev/null || log_warn "    Could not load $mod"
            ((warnings++))
        fi
    done
    
    # Check required sysctl parameters
    log_info "Checking sysctl parameters..."
    local ip_forward=$(sysctl -n net.ipv4.ip_forward 2>/dev/null)
    if [ "$ip_forward" == "1" ]; then
        log_info "  ✓ IP forwarding enabled"
    else
        log_warn "  ⚠ IP forwarding disabled, enabling..."
        sysctl -w net.ipv4.ip_forward=1 2>/dev/null
        ((warnings++))
    fi
    
    # Check required ports
    log_info "Checking required ports..."
    local required_ports=(6443 10250)
    if [ "$NODE_TYPE" == "server" ]; then
        required_ports+=(2379 2380 8472)
    fi
    
    for port in "${required_ports[@]}"; do
        if lsof -i:$port >/dev/null 2>&1; then
            log_warn "  ⚠ Port $port is already in use"
            ((warnings++))
        else
            log_info "  ✓ Port $port available"
        fi
    done
    
    # Check system resources
    log_info "Checking system resources..."
    if [ -f /proc/meminfo ]; then
        local mem_kb=$(grep MemTotal /proc/meminfo | awk '{print $2}')
        local mem_gb=$((mem_kb / 1024 / 1024))
        if [ "$mem_gb" -ge 4 ]; then
            log_info "  ✓ Memory: ${mem_gb}GB (recommended)"
        elif [ "$mem_gb" -ge 2 ]; then
            log_warn "  ⚠ Memory: ${mem_gb}GB (minimum met)"
            ((warnings++))
        else
            log_error "  ✗ Memory: ${mem_gb}GB (minimum 2GB required)"
            ((errors++))
        fi
    fi
    
    # Check CPU cores
    local cpu_cores=$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 1)
    if [ "$cpu_cores" -ge 2 ]; then
        log_info "  ✓ CPU cores: $cpu_cores"
    else
        log_warn "  ⚠ CPU cores: $cpu_cores (2+ recommended)"
        ((warnings++))
    fi
    
    # Check disk space
    local available_space=$(df / | awk 'NR==2 {print int($4/1024/1024)}')
    if [ "$available_space" -ge 10 ]; then
        log_info "  ✓ Available disk space: ${available_space}GB"
    elif [ "$available_space" -ge 5 ]; then
        log_warn "  ⚠ Available disk space: ${available_space}GB (10GB+ recommended)"
        ((warnings++))
    else
        log_error "  ✗ Available disk space: ${available_space}GB (minimum 5GB required)"
        ((errors++))
    fi
    
    # Check for existing K3s installation
    if command -v k3s &> /dev/null; then
        log_warn "  ⚠ K3s is already installed"
        if [[ "${FORCE:-false}" != "true" ]]; then
            log_error "    Use --force to reinstall"
            ((errors++))
        else
            log_info "    Force flag set, will reinstall"
        fi
    else
        log_info "  ✓ No existing K3s installation found"
    fi
    
    # Check cgroups (required for containers)
    log_info "Checking cgroups..."
    if [ -d "/sys/fs/cgroup" ]; then
        log_info "  ✓ Cgroups v1/v2 available"
        # Check cgroup v2
        if [ -f /sys/fs/cgroup/cgroup.controllers ]; then
            log_info "  ✓ Cgroups v2 detected"
        fi
    else
        log_error "  ✗ Cgroups not available (required for containers)"
        ((errors++))
    fi
    
    # Check swap (should be disabled for K8s)
    log_info "Checking swap..."
    if [ "$(swapon -s 2>/dev/null | wc -l)" -gt 1 ]; then
        log_warn "  ⚠ Swap is enabled (Kubernetes performs better with swap disabled)"
        ((warnings++))
    else
        log_info "  ✓ Swap is disabled"
    fi
    
    # Check DNS resolution
    log_info "Checking DNS resolution..."
    if nslookup google.com >/dev/null 2>&1; then
        log_info "  ✓ DNS resolution working"
    else
        log_error "  ✗ DNS resolution failed"
        ((errors++))
    fi
    
    # Check internet connectivity
    log_info "Checking internet connectivity..."
    if curl -s --head https://get.k3s.io >/dev/null; then
        log_info "  ✓ Internet connectivity verified"
    else
        log_error "  ✗ Cannot reach get.k3s.io"
        ((errors++))
    fi
    
    # Check required commands
    log_info "Checking required commands..."
    local required_commands=("curl" "iptables")
    for cmd in "${required_commands[@]}"; do
        if command -v $cmd &> /dev/null; then
            log_info "  ✓ Command $cmd found"
        else
            log_error "  ✗ Command $cmd not found"
            ((errors++))
        fi
    done
    
    # Summary
    log_info "="
    log_info "Preflight check summary:"
    if [ $errors -gt 0 ]; then
        log_error "  Errors: $errors (installation cannot proceed)"
        exit 1
    fi
    if [ $warnings -gt 0 ]; then
        log_warn "  Warnings: $warnings (review before proceeding)"
    else
        log_info "  ✓ All checks passed!"
    fi
    log_info "="
}

configure_install_args() {
    local install_args="--write-kubeconfig-mode 644"
    
    # Disable components as configured
    if [ "$DISABLE_TRAEFIK" == "true" ]; then
        install_args="$install_args --disable traefik"
    fi
    
    if [ "$DISABLE_SERVICELB" == "true" ]; then
        install_args="$install_args --disable servicelb"
    fi
    
    if [ "$DISABLE_LOCAL_STORAGE" == "true" ]; then
        install_args="$install_args --disable local-storage"
    fi
    
    # Network configuration
    install_args="$install_args --cluster-cidr=$CLUSTER_CIDR"
    install_args="$install_args --service-cidr=$SERVICE_CIDR"
    install_args="$install_args --flannel-backend=$FLANNEL_BACKEND"
    
    # Profile-specific configuration
    case "$CLUSTER_PROFILE" in
        single-node)
            log_info "Using single-node profile (all roles on one node)"
            ;;
        ha-embedded)
            log_info "Using HA embedded etcd profile"
            if [ "$CLUSTER_INIT" == "true" ]; then
                install_args="$install_args --cluster-init"
            else
                install_args="$install_args --server=$SERVER_URL"
            fi
            ;;
        ha-external)
            log_info "Using HA external datastore profile"
            if [ -n "$DATASTORE_ENDPOINT" ]; then
                install_args="$install_args --datastore-endpoint=$DATASTORE_ENDPOINT"
            fi
            ;;
        *)
            log_warn "Unknown profile: $CLUSTER_PROFILE, using defaults"
            ;;
    esac
    
    echo "$install_args"
}

install_k3s_server() {
    log_info "Installing K3s server node (Profile: $CLUSTER_PROFILE)..."
    
    local install_args=$(configure_install_args)
    
    if [ "$DRY_RUN" == "true" ]; then
        log_info "[DRY RUN] Would execute: curl -sfL https://get.k3s.io | sh -s - server $install_args"
        return 0
    fi
    
    # Install K3s
    curl -sfL https://get.k3s.io | \
        K3S_VERSION="$K3S_VERSION" \
        sh -s - server $install_args
    
    # Wait for K3s to be ready
    log_info "Waiting for K3s to be ready..."
    sleep 10
    
    local max_attempts=30
    local attempt=0
    while [ $attempt -lt $max_attempts ]; do
        if k3s kubectl get nodes >/dev/null 2>&1; then
            log_info "K3s is ready!"
            break
        fi
        sleep 5
        attempt=$((attempt + 1))
    done
    
    if [ $attempt -eq $max_attempts ]; then
        log_error "K3s failed to start within timeout"
    fi
    
    # Export kubeconfig
    export_kubeconfig
    
    # Get join token for worker nodes
    local token=$(cat /var/lib/rancher/k3s/server/node-token)
    local server_ip=$(hostname -I | awk '{print $1}')
    
    log_info "==============================================="
    log_info "K3s server installation completed!"
    log_info "Server URL: https://${server_ip}:6443"
    log_info "Join token: ${token}"
    log_info "==============================================="
    
    # Save cluster info
    cat > /tmp/k3s-cluster-info.txt <<EOF
SERVER_URL=https://${server_ip}:6443
TOKEN=${token}
EOF
    
    log_info "Cluster info saved to /tmp/k3s-cluster-info.txt"
}

install_k3s_agent() {
    log_info "Installing K3s agent node..."
    
    if [ -z "$SERVER_URL" ] || [ -z "$TOKEN" ]; then
        log_error "SERVER_URL and TOKEN must be provided for agent installation"
    fi
    
    if [ "$DRY_RUN" == "true" ]; then
        log_info "[DRY RUN] Would execute: curl -sfL https://get.k3s.io | K3S_URL=$SERVER_URL K3S_TOKEN=$TOKEN sh -"
        return 0
    fi
    
    # Install K3s agent
    curl -sfL https://get.k3s.io | \
        K3S_VERSION="$K3S_VERSION" \
        K3S_URL="$SERVER_URL" \
        K3S_TOKEN="$TOKEN" \
        sh -
    
    log_info "K3s agent installation completed!"
}

export_kubeconfig() {
    log_info "Exporting kubeconfig..."
    
    # Create .kube directory if it doesn't exist
    mkdir -p "$(dirname "$KUBECONFIG_EXPORT_PATH")"
    
    # Copy kubeconfig
    if [ -f /etc/rancher/k3s/k3s.yaml ]; then
        cp /etc/rancher/k3s/k3s.yaml "$KUBECONFIG_EXPORT_PATH"
        chmod 600 "$KUBECONFIG_EXPORT_PATH"
        
        # Update server address if needed
        if command -v yq &> /dev/null; then
            local server_ip=$(hostname -I | awk '{print $1}')
            yq eval ".clusters[0].cluster.server = \"https://${server_ip}:6443\"" -i "$KUBECONFIG_EXPORT_PATH"
        else
            # Use sed as fallback
            local server_ip=$(hostname -I | awk '{print $1}')
            sed -i "s/127.0.0.1/${server_ip}/g" "$KUBECONFIG_EXPORT_PATH"
        fi
        
        export KUBECONFIG="$KUBECONFIG_EXPORT_PATH"
        log_info "Kubeconfig exported to $KUBECONFIG_EXPORT_PATH"
        
        # Also copy to default location if different
        if [ "$KUBECONFIG_EXPORT_PATH" != "$KUBECONFIG_PATH" ] && [ "$KUBECONFIG_PATH" != "/etc/rancher/k3s/k3s.yaml" ]; then
            cp "$KUBECONFIG_EXPORT_PATH" "$KUBECONFIG_PATH"
            log_info "Kubeconfig also copied to $KUBECONFIG_PATH"
        fi
    else
        log_error "K3s kubeconfig not found at /etc/rancher/k3s/k3s.yaml"
    fi
}

install_helm() {
    log_info "Installing Helm package manager..."
    
    if command -v helm &> /dev/null; then
        log_info "Helm is already installed"
        helm version
        return 0
    fi
    
    if [ "$DRY_RUN" == "true" ]; then
        log_info "[DRY RUN] Would install Helm"
        return 0
    fi
    
    # Install Helm
    curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
    
    # Verify installation
    helm version
    log_info "Helm installed successfully"
}

install_ingress_nginx() {
    log_info "Installing NGINX Ingress Controller..."
    
    if [ "$DRY_RUN" == "true" ]; then
        log_info "[DRY RUN] Would install ingress-nginx via Helm"
        return 0
    fi
    
    # Ensure Helm is installed
    install_helm
    
    # Add ingress-nginx Helm repo
    helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
    helm repo update
    
    # Create values file for ingress-nginx
    cat > /tmp/ingress-nginx-values.yaml <<EOF
controller:
  service:
    type: LoadBalancer
  publishService:
    enabled: true
  metrics:
    enabled: true
    serviceMonitor:
      enabled: false
  config:
    use-forwarded-headers: "true"
    compute-full-forwarded-for: "true"
    use-proxy-protocol: "false"
  resources:
    limits:
      cpu: 200m
      memory: 256Mi
    requests:
      cpu: 100m
      memory: 128Mi
  autoscaling:
    enabled: false
    minReplicas: 1
    maxReplicas: 3
  admissionWebhooks:
    enabled: true
    failurePolicy: Fail
    port: 8443
defaultBackend:
  enabled: true
  resources:
    limits:
      cpu: 50m
      memory: 64Mi
    requests:
      cpu: 10m
      memory: 32Mi
EOF
    
    # Install ingress-nginx
    helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
        --namespace ingress-nginx \
        --create-namespace \
        --values /tmp/ingress-nginx-values.yaml \
        --wait --timeout 5m
    
    # Wait for ingress controller to be ready
    log_info "Waiting for ingress controller to be ready..."
    kubectl wait --namespace ingress-nginx \
        --for=condition=ready pod \
        --selector=app.kubernetes.io/component=controller \
        --timeout=120s
    
    # Get ingress controller LoadBalancer IP/hostname
    local ingress_ip=$(kubectl get svc ingress-nginx-controller -n ingress-nginx -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
    local ingress_hostname=$(kubectl get svc ingress-nginx-controller -n ingress-nginx -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
    
    if [ -n "$ingress_ip" ]; then
        log_info "Ingress controller available at IP: $ingress_ip"
    elif [ -n "$ingress_hostname" ]; then
        log_info "Ingress controller available at hostname: $ingress_hostname"
    else
        log_warn "Ingress controller LoadBalancer IP/hostname not yet available"
        log_info "You can check the status with: kubectl get svc -n ingress-nginx"
    fi
    
    # Set as default ingress class
    kubectl annotate ingressclass nginx ingressclass.kubernetes.io/is-default-class=true
    
    log_info "NGINX Ingress Controller installed successfully"
}
        --set controller.service.type=LoadBalancer \
        --set controller.metrics.enabled=true \
        --set controller.podAnnotations."prometheus\.io/scrape"=true \
        --set controller.podAnnotations."prometheus\.io/port"=10254 \
        --wait
    
    log_info "ingress-nginx installed successfully"
}

install_cert_manager() {
    log_info "Installing cert-manager for automatic TLS certificate management..."
    
    if [ "$DRY_RUN" == "true" ]; then
        log_info "[DRY RUN] Would install cert-manager"
        return 0
    fi
    
    # Ensure Helm is installed
    install_helm
    
    # Add cert-manager Helm repo
    helm repo add jetstack https://charts.jetstack.io
    helm repo update
    
    # Install cert-manager CRDs
    log_info "Installing cert-manager CRDs..."
    kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.3/cert-manager.crds.yaml
    
    # Wait for CRDs to be established
    sleep 5
    
    # Create values file for cert-manager
    cat > /tmp/cert-manager-values.yaml <<EOF
installCRDs: false  # We already installed them
replicaCount: 1
webhook:
  replicaCount: 1
cainjector:
  replicaCount: 1
startupapicheck:
  enabled: false
prometheus:
  enabled: true
  servicemonitor:
    enabled: false
resources:
  limits:
    cpu: 100m
    memory: 128Mi
  requests:
    cpu: 50m
    memory: 64Mi
webhook:
  resources:
    limits:
      cpu: 100m
      memory: 128Mi
    requests:
      cpu: 50m
      memory: 64Mi
cainjector:
  resources:
    limits:
      cpu: 100m
      memory: 128Mi
    requests:
      cpu: 50m
      memory: 64Mi
EOF
    
    # Install cert-manager
    helm upgrade --install cert-manager jetstack/cert-manager \
        --namespace cert-manager \
        --create-namespace \
        --version v1.13.3 \
        --values /tmp/cert-manager-values.yaml \
        --wait --timeout 5m
    
    # Wait for cert-manager to be ready
    log_info "Waiting for cert-manager to be ready..."
    kubectl wait --namespace cert-manager \
        --for=condition=ready pod \
        --selector=app.kubernetes.io/instance=cert-manager \
        --timeout=120s
    
    # Create a ClusterIssuer for Let's Encrypt (staging)
    log_info "Creating Let's Encrypt staging ClusterIssuer..."
    cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-staging
spec:
  acme:
    server: https://acme-staging-v02.api.letsencrypt.org/directory
    email: admin@example.com  # Change this!
    privateKeySecretRef:
      name: letsencrypt-staging
    solvers:
    - http01:
        ingress:
          class: nginx
EOF
    
    # Create a ClusterIssuer for Let's Encrypt (production)
    log_info "Creating Let's Encrypt production ClusterIssuer..."
    cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@example.com  # Change this!
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF
    
    log_info "cert-manager installed successfully with Let's Encrypt ClusterIssuers"
    log_warn "Remember to update the email address in the ClusterIssuers!"
}

install_metrics_server() {
    log_info "Installing metrics-server for resource monitoring..."
    
    if [ "$DRY_RUN" == "true" ]; then
        log_info "[DRY RUN] Would install metrics-server"
        return 0
    fi
    
    # Ensure Helm is installed
    install_helm
    
    # Add metrics-server Helm repo
    helm repo add metrics-server https://kubernetes-sigs.github.io/metrics-server/
    helm repo update
    
    # Create values file for metrics-server
    cat > /tmp/metrics-server-values.yaml <<EOF
replicas: 1
args:
  - --cert-dir=/tmp
  - --kubelet-preferred-address-types=InternalIP,ExternalIP,Hostname
  - --kubelet-use-node-status-port
  - --metric-resolution=15s
  - --kubelet-insecure-tls  # For development/self-signed certs
resources:
  limits:
    cpu: 100m
    memory: 200Mi
  requests:
    cpu: 50m
    memory: 100Mi
service:
  type: ClusterIP
serviceMonitor:
  enabled: false
podDisruptionBudget:
  enabled: false
  minAvailable: 1
EOF
    
    # Install metrics-server via Helm
    helm upgrade --install metrics-server metrics-server/metrics-server \
        --namespace kube-system \
        --values /tmp/metrics-server-values.yaml \
        --wait --timeout 5m
    
    # Wait for metrics-server to be ready
    log_info "Waiting for metrics-server to be ready..."
    kubectl wait --namespace kube-system \
        --for=condition=ready pod \
        --selector=app.kubernetes.io/name=metrics-server \
        --timeout=120s
    
    # Test metrics-server
    log_info "Testing metrics-server..."
    sleep 30  # Give it time to collect initial metrics
    
    if kubectl top nodes &>/dev/null; then
        log_info "metrics-server is working! You can now use:"
        log_info "  kubectl top nodes"
        log_info "  kubectl top pods --all-namespaces"
        kubectl top nodes || true
    else
        log_warn "metrics-server installed but metrics not yet available. Try again in a few minutes."
    fi
    
    log_info "metrics-server installed successfully"
}

install_metrics_server_manifest() {
    # Fallback installation via manifest if Helm fails
    log_info "Installing metrics-server via manifest..."
    kubectl apply -f - <<EOF
apiVersion: v1
kind: ServiceAccount
metadata:
  labels:
    k8s-app: metrics-server
  name: metrics-server
  namespace: kube-system
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  labels:
    k8s-app: metrics-server
  name: system:metrics-server
rules:
- apiGroups:
  - ""
  resources:
  - pods
  - nodes
  - nodes/stats
  - namespaces
  - configmaps
  verbs:
  - get
  - list
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  labels:
    k8s-app: metrics-server
  name: system:metrics-server
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: system:metrics-server
subjects:
- kind: ServiceAccount
  name: metrics-server
  namespace: kube-system
---
apiVersion: v1
kind: Service
metadata:
  labels:
    k8s-app: metrics-server
  name: metrics-server
  namespace: kube-system
spec:
  ports:
  - name: https
    port: 443
    protocol: TCP
    targetPort: https
  selector:
    k8s-app: metrics-server
---
apiVersion: apps/v1
kind: Deployment
metadata:
  labels:
    k8s-app: metrics-server
  name: metrics-server
  namespace: kube-system
spec:
  selector:
    matchLabels:
      k8s-app: metrics-server
  template:
    metadata:
      labels:
        k8s-app: metrics-server
    spec:
      containers:
      - args:
        - --cert-dir=/tmp
        - --secure-port=4443
        - --kubelet-preferred-address-types=InternalIP,ExternalIP,Hostname
        - --kubelet-use-node-status-port
        - --metric-resolution=15s
        - --kubelet-insecure-tls
        image: registry.k8s.io/metrics-server/metrics-server:v0.6.4
        imagePullPolicy: IfNotPresent
        name: metrics-server
        ports:
        - containerPort: 4443
          name: https
          protocol: TCP
        resources:
          requests:
            cpu: 100m
            memory: 200Mi
        volumeMounts:
        - mountPath: /tmp
          name: tmp-dir
      serviceAccountName: metrics-server
      volumes:
      - emptyDir: {}
        name: tmp-dir
EOF
    
    log_info "metrics-server installed successfully"
}

validate_cluster() {
    log_info "Running post-installation validation..."
    
    local errors=0
    local warnings=0
    
    # Use k3s kubectl or regular kubectl
    local kubectl_cmd="kubectl"
    if command -v k3s &> /dev/null; then
        kubectl_cmd="k3s kubectl"
    fi
    
    # Check nodes are ready
    log_info "Checking node status..."
    local nodes=$($kubectl_cmd get nodes -o json 2>/dev/null)
    if [ $? -eq 0 ]; then
        local ready_nodes=$(echo "$nodes" | jq -r '.items[] | select(.status.conditions[] | select(.type=="Ready" and .status=="True")) | .metadata.name' | wc -l)
        local total_nodes=$(echo "$nodes" | jq -r '.items | length')
        
        if [ "$ready_nodes" -eq "$total_nodes" ] && [ "$total_nodes" -gt 0 ]; then
            log_info "  ✓ All nodes ready ($ready_nodes/$total_nodes)"
            $kubectl_cmd get nodes
        else
            log_error "  ✗ Not all nodes ready ($ready_nodes/$total_nodes)"
            ((errors++))
        fi
    else
        log_error "  ✗ Cannot connect to cluster"
        ((errors++))
    fi
    
    # Check system pods
    log_info "Checking system pods..."
    local system_pods=$($kubectl_cmd get pods -n kube-system -o json 2>/dev/null)
    if [ $? -eq 0 ]; then
        local running_pods=$(echo "$system_pods" | jq -r '.items[] | select(.status.phase=="Running") | .metadata.name' | wc -l)
        local total_pods=$(echo "$system_pods" | jq -r '.items | length')
        
        if [ "$running_pods" -eq "$total_pods" ] && [ "$total_pods" -gt 0 ]; then
            log_info "  ✓ All system pods running ($running_pods/$total_pods)"
        else
            log_warn "  ⚠ Some system pods not running ($running_pods/$total_pods)"
            ((warnings++))
            # Show non-running pods
            echo "$system_pods" | jq -r '.items[] | select(.status.phase!="Running") | "    " + .metadata.name + ": " + .status.phase'
        fi
    fi
    
    # Check CoreDNS
    log_info "Checking CoreDNS..."
    local coredns_pods=$($kubectl_cmd get pods -n kube-system -l k8s-app=kube-dns -o json 2>/dev/null)
    if [ $? -eq 0 ]; then
        local coredns_running=$(echo "$coredns_pods" | jq -r '.items[] | select(.status.phase=="Running") | .metadata.name' | wc -l)
        if [ "$coredns_running" -gt 0 ]; then
            log_info "  ✓ CoreDNS is running"
        else
            log_error "  ✗ CoreDNS is not running"
            ((errors++))
        fi
    fi
    
    # Check default storage class
    log_info "Checking storage classes..."
    local storage_classes=$($kubectl_cmd get storageclass -o json 2>/dev/null)
    if [ $? -eq 0 ]; then
        local default_sc=$(echo "$storage_classes" | jq -r '.items[] | select(.metadata.annotations."storageclass.kubernetes.io/is-default-class"=="true") | .metadata.name')
        if [ -n "$default_sc" ]; then
            log_info "  ✓ Default storage class: $default_sc"
        else
            log_warn "  ⚠ No default storage class set"
            ((warnings++))
        fi
        $kubectl_cmd get storageclass
    fi
    
    # Check ingress controller (if installed)
    if [ "$INSTALL_INGRESS" == "true" ]; then
        log_info "Checking ingress controller..."
        local ingress_pods=$($kubectl_cmd get pods -n ingress-nginx -o json 2>/dev/null)
        if [ $? -eq 0 ]; then
            local ingress_running=$(echo "$ingress_pods" | jq -r '.items[] | select(.status.phase=="Running" and (.metadata.name | contains("controller"))) | .metadata.name' | wc -l)
            if [ "$ingress_running" -gt 0 ]; then
                log_info "  ✓ Ingress controller is running"
                # Check ingress class
                local default_ic=$($kubectl_cmd get ingressclass -o json | jq -r '.items[] | select(.metadata.annotations."ingressclass.kubernetes.io/is-default-class"=="true") | .metadata.name')
                if [ -n "$default_ic" ]; then
                    log_info "  ✓ Default ingress class: $default_ic"
                else
                    log_warn "  ⚠ No default ingress class set"
                    ((warnings++))
                fi
            else
                log_error "  ✗ Ingress controller is not running"
                ((errors++))
            fi
        fi
    fi
    
    # Check cert-manager (if installed)
    if [ "$INSTALL_CERT_MANAGER" == "true" ]; then
        log_info "Checking cert-manager..."
        local cert_manager_pods=$($kubectl_cmd get pods -n cert-manager -o json 2>/dev/null)
        if [ $? -eq 0 ]; then
            local cert_manager_running=$(echo "$cert_manager_pods" | jq -r '.items[] | select(.status.phase=="Running") | .metadata.name' | wc -l)
            if [ "$cert_manager_running" -gt 0 ]; then
                log_info "  ✓ cert-manager is running"
                # Check ClusterIssuers
                local issuers=$($kubectl_cmd get clusterissuer -o json 2>/dev/null | jq -r '.items[].metadata.name' | tr '\n' ', ' | sed 's/,$//')
                if [ -n "$issuers" ]; then
                    log_info "  ✓ ClusterIssuers: $issuers"
                fi
            else
                log_error "  ✗ cert-manager is not running"
                ((errors++))
            fi
        fi
    fi
    
    # Check metrics-server (if installed)
    if [ "$INSTALL_METRICS_SERVER" == "true" ]; then
        log_info "Checking metrics-server..."
        local metrics_server_pods=$($kubectl_cmd get pods -n kube-system -l app.kubernetes.io/name=metrics-server -o json 2>/dev/null)
        if [ $? -eq 0 ]; then
            local metrics_running=$(echo "$metrics_server_pods" | jq -r '.items[] | select(.status.phase=="Running") | .metadata.name' | wc -l)
            if [ "$metrics_running" -gt 0 ]; then
                log_info "  ✓ metrics-server is running"
                # Test metrics API
                if $kubectl_cmd top nodes &>/dev/null; then
                    log_info "  ✓ Metrics API is working"
                else
                    log_warn "  ⚠ Metrics API not yet ready"
                    ((warnings++))
                fi
            else
                log_error "  ✗ metrics-server is not running"
                ((errors++))
            fi
        fi
    fi
    
    # Test cluster DNS
    log_info "Testing cluster DNS..."
    cat <<EOF | $kubectl_cmd apply -f - &>/dev/null
apiVersion: v1
kind: Pod
metadata:
  name: dns-test
  namespace: default
spec:
  containers:
  - name: dns-test
    image: busybox:1.35
    command: ['sh', '-c', 'nslookup kubernetes.default && echo DNS_OK']
  restartPolicy: Never
EOF
    
    sleep 5
    local dns_result=$($kubectl_cmd logs dns-test 2>/dev/null | grep -c DNS_OK)
    $kubectl_cmd delete pod dns-test --force &>/dev/null
    
    if [ "$dns_result" -gt 0 ]; then
        log_info "  ✓ Cluster DNS is working"
    else
        log_error "  ✗ Cluster DNS test failed"
        ((errors++))
    fi
    
    # Summary
    log_info "="
    log_info "Validation summary:"
    if [ $errors -gt 0 ]; then
        log_error "  Errors: $errors (cluster may not be fully functional)"
    fi
    if [ $warnings -gt 0 ]; then
        log_warn "  Warnings: $warnings"
    fi
    if [ $errors -eq 0 ] && [ $warnings -eq 0 ]; then
        log_info "  ✓ All validation checks passed!"
    fi
    log_info "="
    
    # Display cluster info
    log_info "Cluster information:"
    $kubectl_cmd cluster-info
    
    return $errors
}

print_usage() {
    cat <<EOF
Usage: $0 [OPTIONS]

Options:
    --type <server|agent>     Node type to install (default: server)
    --server-url <url>        Server URL for agent nodes
    --token <token>           Join token for agent nodes
    --no-ingress              Don't install ingress-nginx
    --with-cert-manager       Install cert-manager
    --with-metrics-server     Install metrics-server
    --dry-run                 Show what would be done without executing
    --force                   Force reinstallation if K3s already exists
    --help                    Show this help message

Examples:
    # Install single-node cluster
    $0
    
    # Install server node with all addons
    $0 --with-cert-manager --with-metrics-server
    
    # Install agent node
    $0 --type agent --server-url https://192.168.1.100:6443 --token K3s-token-here
    
    # Dry run to see what would be installed
    $0 --dry-run

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
        --server-url)
            SERVER_URL="$2"
            shift 2
            ;;
        --token)
            TOKEN="$2"
            shift 2
            ;;
        --no-ingress)
            INSTALL_INGRESS="false"
            shift
            ;;
        --with-cert-manager)
            INSTALL_CERT_MANAGER="true"
            shift
            ;;
        --with-metrics-server)
            INSTALL_METRICS_SERVER="true"
            shift
            ;;
        --dry-run)
            DRY_RUN="true"
            shift
            ;;
        --force)
            FORCE="true"
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
    log_info "Starting K3s provisioning..."
    log_info "Configuration:"
    log_info "  Node Type: $NODE_TYPE"
    log_info "  K3s Version: $K3S_VERSION"
    log_info "  Install Ingress: $INSTALL_INGRESS"
    log_info "  Install Cert Manager: $INSTALL_CERT_MANAGER"
    log_info "  Install Metrics Server: $INSTALL_METRICS_SERVER"
    log_info "  Dry Run: $DRY_RUN"
    
    # Safety check
    if [ "$DRY_RUN" != "true" ]; then
        read -p "This will install K3s on your system. Continue? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Installation cancelled"
            exit 0
        fi
    fi
    
    # Run preflight checks
    check_prerequisites "${FORCE:-}"
    
    # Install based on node type
    if [ "$NODE_TYPE" == "server" ]; then
        install_k3s_server
        
        # Install additional components
        if [ "$INSTALL_INGRESS" == "true" ]; then
            install_ingress_nginx
        fi
        
        if [ "$INSTALL_CERT_MANAGER" == "true" ]; then
            install_cert_manager
        fi
        
        if [ "$INSTALL_METRICS_SERVER" == "true" ]; then
            install_metrics_server
        fi
        
        # Validate cluster
        validate_cluster
        
    elif [ "$NODE_TYPE" == "agent" ]; then
        install_k3s_agent
    else
        log_error "Invalid node type: $NODE_TYPE"
    fi
    
    log_info "==========================================

"
    log_info "K3s provisioning completed successfully!"
    log_info "=========================================="
    
    if [ "$NODE_TYPE" == "server" ]; then
        log_info ""
        log_info "Next steps:"
        log_info "1. Export KUBECONFIG=$KUBECONFIG_PATH"
        log_info "2. Verify cluster: kubectl get nodes"
        log_info "3. Deploy your application: kubectl apply -f your-app.yaml"
        
        if [ -f /tmp/k3s-cluster-info.txt ]; then
            log_info ""
            log_info "To add worker nodes, run on worker machines:"
            log_info "  $0 --type agent --server-url <SERVER_URL> --token <TOKEN>"
            log_info "(Find SERVER_URL and TOKEN in /tmp/k3s-cluster-info.txt)"
        fi
    fi
}

# Run main function
main