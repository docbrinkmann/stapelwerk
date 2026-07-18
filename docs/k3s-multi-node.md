# K3s Multi-Node Cluster Setup

This guide explains how to set up multi-node K3s clusters using the provision scripts.

## Table of Contents

- [Cluster Profiles](#cluster-profiles)
- [Single-Node Setup](#single-node-setup)
- [Multi-Node Setup](#multi-node-setup)
- [High Availability Setup](#high-availability-setup)
- [Node Management](#node-management)
- [Troubleshooting](#troubleshooting)

## Cluster Profiles

The provision script supports three cluster profiles:

1. **single-node**: All-in-one deployment (default)
2. **ha-embedded**: High availability with embedded etcd
3. **ha-external**: High availability with external datastore

## Single-Node Setup

The simplest deployment for development and testing.

```bash
# Default single-node installation
sudo ./scripts/k8s/provision.sh

# Or explicitly specify the profile
sudo CLUSTER_PROFILE=single-node ./scripts/k8s/provision.sh

# Custom configuration
sudo CLUSTER_PROFILE=single-node \
     DISABLE_TRAEFIK=true \
     INSTALL_INGRESS=true \
     ./scripts/k8s/provision.sh
```

### Single-Node Features

- All Kubernetes components on one machine
- Suitable for development/testing
- Minimal resource requirements (2 CPU, 2GB RAM)
- Local storage provisioner included
- Can be expanded to multi-node later

## Multi-Node Setup

### Adding Worker Nodes

After setting up the initial server:

1. **On the server node**, get the join information:

```bash
# The provision script outputs this, or retrieve it:
cat /tmp/k3s-cluster-info.txt

# Or manually get the token:
sudo cat /var/lib/rancher/k3s/server/node-token

# Get server IP:
hostname -I | awk '{print $1}'
```

2. **On each worker node**, join the cluster:

```bash
# Set the server URL and token from step 1
export SERVER_URL="https://<SERVER_IP>:6443"
export TOKEN="<NODE_TOKEN>"

# Join as agent
sudo NODE_TYPE=agent \
     SERVER_URL="$SERVER_URL" \
     TOKEN="$TOKEN" \
     ./scripts/k8s/provision.sh
```

### Multi-Node Example

**Server Node (192.168.1.100):**
```bash
sudo CLUSTER_PROFILE=single-node \
     DISABLE_TRAEFIK=true \
     ./scripts/k8s/provision.sh
```

**Worker Node 1 (192.168.1.101):**
```bash
sudo NODE_TYPE=agent \
     SERVER_URL="https://192.168.1.100:6443" \
     TOKEN="K10c42a..." \
     ./scripts/k8s/provision.sh
```

**Worker Node 2 (192.168.1.102):**
```bash
sudo NODE_TYPE=agent \
     SERVER_URL="https://192.168.1.100:6443" \
     TOKEN="K10c42a..." \
     ./scripts/k8s/provision.sh
```

### Verify Cluster

```bash
# On server node or with exported kubeconfig
kubectl get nodes

# Expected output:
NAME       STATUS   ROLES                  AGE   VERSION
server01   Ready    control-plane,master   5m    v1.28.4+k3s2
worker01   Ready    <none>                 3m    v1.28.4+k3s2
worker02   Ready    <none>                 2m    v1.28.4+k3s2
```

## High Availability Setup

### HA with Embedded etcd

For production environments requiring high availability without external datastore.

**Requirements:**
- Odd number of server nodes (3 or 5 recommended)
- Minimum 3 server nodes for HA
- 2 CPU, 4GB RAM per server node

**First Server Node:**
```bash
sudo CLUSTER_PROFILE=ha-embedded \
     CLUSTER_INIT=true \
     DISABLE_TRAEFIK=true \
     ./scripts/k8s/provision.sh
```

**Additional Server Nodes:**
```bash
# Get the token from first server
TOKEN=$(ssh user@first-server 'sudo cat /var/lib/rancher/k3s/server/node-token')

sudo CLUSTER_PROFILE=ha-embedded \
     SERVER_URL="https://<FIRST_SERVER_IP>:6443" \
     TOKEN="$TOKEN" \
     ./scripts/k8s/provision.sh
```

**Add Worker Nodes:**
```bash
sudo NODE_TYPE=agent \
     SERVER_URL="https://<ANY_SERVER_IP>:6443" \
     TOKEN="$TOKEN" \
     ./scripts/k8s/provision.sh
```

### HA with External Datastore

Using external PostgreSQL or MySQL for the datastore.

**Prerequisites:**
- External PostgreSQL (12+) or MySQL (5.7+) database
- Database with proper permissions

**Database Setup (PostgreSQL):**
```sql
CREATE DATABASE k3s;
CREATE USER k3s WITH ENCRYPTED PASSWORD 'secure-password';
GRANT ALL PRIVILEGES ON DATABASE k3s TO k3s;
```

**Server Nodes:**
```bash
# All server nodes use same datastore
export DATASTORE_ENDPOINT="postgres://k3s:secure-password@db.example.com:5432/k3s"

sudo CLUSTER_PROFILE=ha-external \
     DATASTORE_ENDPOINT="$DATASTORE_ENDPOINT" \
     DISABLE_TRAEFIK=true \
     ./scripts/k8s/provision.sh
```

### Load Balancer for HA

For production HA clusters, use a load balancer in front of server nodes:

**HAProxy Configuration Example:**
```
global
    maxconn 4096

defaults
    mode tcp
    timeout connect 5s
    timeout client 30s
    timeout server 30s

frontend k3s-frontend
    bind *:6443
    default_backend k3s-backend

backend k3s-backend
    balance roundrobin
    server k3s-server-1 192.168.1.100:6443 check
    server k3s-server-2 192.168.1.101:6443 check
    server k3s-server-3 192.168.1.102:6443 check
```

## Node Management

### Adding Nodes

```bash
# Add a worker node
sudo NODE_TYPE=agent \
     SERVER_URL="https://<SERVER>:6443" \
     TOKEN="<TOKEN>" \
     ./scripts/k8s/provision.sh

# Add a server node (HA embedded only)
sudo CLUSTER_PROFILE=ha-embedded \
     SERVER_URL="https://<FIRST_SERVER>:6443" \
     TOKEN="<TOKEN>" \
     ./scripts/k8s/provision.sh
```

### Removing Nodes

```bash
# Drain the node first (from server)
kubectl drain <node-name> --ignore-daemonsets --delete-emptydir-data

# Delete the node
kubectl delete node <node-name>

# On the node itself, uninstall K3s
sudo ./scripts/k8s/destroy.sh --type agent  # For worker nodes
sudo ./scripts/k8s/destroy.sh --type server # For server nodes
```

### Node Labels and Taints

```bash
# Add labels
kubectl label nodes worker01 node-role.kubernetes.io/worker=true
kubectl label nodes worker01 disktype=ssd

# Add taints
kubectl taint nodes worker01 special=true:NoSchedule

# Remove taints
kubectl taint nodes worker01 special:NoSchedule-
```

## Network Configuration

### Custom Network Settings

```bash
# Custom pod and service CIDR
sudo CLUSTER_PROFILE=single-node \
     CLUSTER_CIDR="10.244.0.0/16" \
     SERVICE_CIDR="10.96.0.0/12" \
     ./scripts/k8s/provision.sh

# Different Flannel backend
sudo CLUSTER_PROFILE=single-node \
     FLANNEL_BACKEND=ipsec \
     ./scripts/k8s/provision.sh

# Available backends: vxlan (default), ipsec, wireguard, host-gw
```

### Network Policies

K3s supports Kubernetes NetworkPolicies by default:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: web-netpol
spec:
  podSelector:
    matchLabels:
      app: web
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: backend
    ports:
    - protocol: TCP
      port: 80
```

## Storage Configuration

### Local Path Provisioner

K3s includes local-path-provisioner by default:

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: local-path-pvc
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: local-path
  resources:
    requests:
      storage: 2Gi
```

### Disable Local Storage

```bash
sudo CLUSTER_PROFILE=single-node \
     DISABLE_LOCAL_STORAGE=true \
     ./scripts/k8s/provision.sh
```

### Add External Storage

```bash
# Install Longhorn
kubectl apply -f https://raw.githubusercontent.com/longhorn/longhorn/master/deploy/longhorn.yaml

# Install OpenEBS
kubectl apply -f https://openebs.github.io/charts/openebs-operator.yaml
```

## Monitoring and Observability

### Enable Metrics Server

```bash
sudo CLUSTER_PROFILE=single-node \
     INSTALL_METRICS_SERVER=true \
     ./scripts/k8s/provision.sh

# Verify
kubectl top nodes
kubectl top pods --all-namespaces
```

### Cluster Info

```bash
# Cluster status
kubectl cluster-info

# Component status
kubectl get componentstatuses

# Node resources
kubectl describe nodes

# System pods
kubectl get pods -n kube-system
```

## Troubleshooting

### Common Issues

#### Nodes Not Joining

```bash
# Check token is valid
sudo cat /var/lib/rancher/k3s/server/node-token

# Check connectivity
curl -k https://<SERVER_IP>:6443

# Check firewall rules
sudo iptables -L -n
```

#### Node Shows NotReady

```bash
# Check node status
kubectl describe node <node-name>

# Check kubelet logs
sudo journalctl -u k3s -f        # On server
sudo journalctl -u k3s-agent -f  # On agent

# Check network
kubectl get pods -n kube-system | grep flannel
```

#### Pod Network Issues

```bash
# Check CNI
ls -la /var/lib/rancher/k3s/agent/etc/cni/net.d/

# Restart flannel
kubectl delete pods -n kube-system -l app=flannel

# Check iptables
sudo iptables-save | grep -i flannel
```

### Reset and Cleanup

```bash
# Complete cleanup
sudo ./scripts/k8s/destroy.sh --type server --clean-volumes --force

# Manual cleanup if needed
sudo k3s-uninstall.sh        # Server
sudo k3s-agent-uninstall.sh  # Agent
```

## Best Practices

1. **Production Clusters**:
   - Use HA setup with 3+ server nodes
   - Configure external load balancer
   - Enable etcd snapshots/backups
   - Use external storage for persistence

2. **Security**:
   - Change default service account tokens
   - Enable audit logging
   - Use network policies
   - Regular updates

3. **Resource Management**:
   - Set resource requests/limits
   - Use node affinity for workload placement
   - Monitor resource usage
   - Plan for node maintenance

4. **Networking**:
   - Use ingress controller instead of NodePort
   - Configure proper DNS
   - Plan IP ranges to avoid conflicts

## Additional Resources

- [K3s Documentation](https://docs.k3s.io/)
- [K3s GitHub](https://github.com/k3s-io/k3s)
- [Rancher Documentation](https://rancher.com/docs/)
- [Kubernetes Documentation](https://kubernetes.io/docs/)