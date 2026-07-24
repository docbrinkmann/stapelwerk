# GitLab Runner Setup for Kubernetes Deployments

This guide covers setting up self-hosted GitLab runners for Kubernetes cluster provisioning and deployments.

## Table of Contents

- [Overview](#overview)
- [Runner Types](#runner-types)
- [Installation](#installation)
- [Configuration](#configuration)
- [Security](#security)
- [Troubleshooting](#troubleshooting)

## Overview

Self-hosted runners are required for:
- **Cluster Provisioning**: Creating K3s/K8s clusters on bare metal or VMs
- **Direct Apply**: Deploying to clusters without GitLab Agent
- **Performance Testing**: Running load tests from within your infrastructure

## Runner Types

### 1. Shell Executor (for Provisioning)

Best for cluster provisioning on the host machine.

```bash
# Install GitLab Runner
curl -L https://packages.gitlab.com/install/repositories/runner/gitlab-runner/script.deb.sh | sudo bash
sudo apt-get install gitlab-runner

# Register runner
sudo gitlab-runner register \
  --non-interactive \
  --url "https://gitlab.com/" \
  --registration-token "$REGISTRATION_TOKEN" \
  --executor "shell" \
  --description "k3s-provisioning-runner" \
  --tag-list "provisioning,k3s" \
  --run-untagged="false" \
  --locked="true"
```

### 2. Docker Executor (for Deployments)

Ideal for containerized deployment jobs.

```bash
# Register Docker runner
sudo gitlab-runner register \
  --non-interactive \
  --url "https://gitlab.com/" \
  --registration-token "$REGISTRATION_TOKEN" \
  --executor "docker" \
  --docker-image "alpine/k8s:1.28.4" \
  --description "k8s-deployment-runner" \
  --tag-list "kubernetes,docker" \
  --docker-privileged \
  --docker-volumes "/var/run/docker.sock:/var/run/docker.sock"
```

### 3. Kubernetes Executor (for Scale)

For running CI jobs directly in Kubernetes.

```yaml
# values.yaml for GitLab Runner Helm chart
gitlabUrl: https://gitlab.com/
runnerRegistrationToken: "$REGISTRATION_TOKEN"

rbac:
  create: true
  clusterWideAccess: false

runners:
  config: |
    [[runners]]
      [runners.kubernetes]
        image = "alpine/k8s:1.28.4"
        namespace = "gitlab-runner"
        privileged = true
        cpu_request = "100m"
        cpu_limit = "1000m"
        memory_request = "128Mi"
        memory_limit = "1Gi"
        service_cpu_request = "100m"
        service_cpu_limit = "500m"
        service_memory_request = "128Mi"
        service_memory_limit = "512Mi"
        helper_cpu_request = "100m"
        helper_cpu_limit = "500m"
        helper_memory_request = "128Mi"
        helper_memory_limit = "512Mi"
  tags: "kubernetes,k8s-executor"
```

Install with Helm:

```bash
helm repo add gitlab https://charts.gitlab.io
helm install gitlab-runner gitlab/gitlab-runner \
  --namespace gitlab-runner \
  --create-namespace \
  -f values.yaml
```

## Configuration

### Runner Configuration File

Edit `/etc/gitlab-runner/config.toml`:

```toml
concurrent = 4
check_interval = 0

[session_server]
  session_timeout = 1800

[[runners]]
  name = "k3s-provisioning-runner"
  url = "https://gitlab.com/"
  token = "RUNNER_TOKEN"
  executor = "shell"
  
  # Shell executor specific
  [runners.custom_build_dir]
    enabled = true
  [runners.cache]
    Type = "s3"
    Shared = true
    [runners.cache.s3]
      ServerAddress = "minio.example.com"
      AccessKey = "ACCESS_KEY"
      SecretKey = "SECRET_KEY"
      BucketName = "runner-cache"
  
  # Environment variables
  environment = [
    "K3S_VERSION=v1.28.4+k3s2",
    "KUBECONFIG=/etc/rancher/k3s/k3s.yaml"
  ]

[[runners]]
  name = "k8s-deployment-runner"
  url = "https://gitlab.com/"
  token = "RUNNER_TOKEN"
  executor = "docker"
  
  [runners.docker]
    tls_verify = false
    image = "alpine/k8s:1.28.4"
    privileged = true
    disable_cache = false
    volumes = [
      "/cache",
      "/var/run/docker.sock:/var/run/docker.sock"
    ]
    shm_size = 0
```

### Required System Packages

For provisioning runners:

```bash
# Base requirements
sudo apt-get update
sudo apt-get install -y \
  curl \
  wget \
  git \
  jq \
  bash \
  openssh-client \
  systemd

# K3s requirements
sudo apt-get install -y \
  iptables \
  conntrack \
  socat \
  util-linux \
  mount \
  ebtables \
  ethtool

# Kubernetes tools
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl

# Helm
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# kubeconform for validation
wget https://github.com/yannh/kubeconform/releases/latest/download/kubeconform-linux-amd64.tar.gz
tar xf kubeconform-linux-amd64.tar.gz
sudo mv kubeconform /usr/local/bin
```

## Security

### 1. Runner Isolation

```bash
# Create dedicated user for runner
sudo useradd -m -s /bin/bash gitlab-runner
sudo usermod -aG docker gitlab-runner

# Set proper permissions
sudo chown -R gitlab-runner:gitlab-runner /home/gitlab-runner
sudo chmod 700 /home/gitlab-runner/.ssh
```

### 2. Secrets Management

```yaml
# .gitlab-ci.yml - Using CI/CD variables
variables:
  KUBECONFIG_BASE64: "$KUBECONFIG_BASE64"  # Masked variable

before_script:
  - echo "$KUBECONFIG_BASE64" | base64 -d > /tmp/kubeconfig
  - export KUBECONFIG=/tmp/kubeconfig
  - chmod 600 /tmp/kubeconfig

after_script:
  - rm -f /tmp/kubeconfig
```

### 3. Network Security

```bash
# Firewall rules for runner
sudo ufw allow 22/tcp       # SSH
sudo ufw allow 443/tcp      # HTTPS to GitLab
sudo ufw allow 6443/tcp     # K3s API
sudo ufw allow 10250/tcp    # Kubelet API
sudo ufw allow 8472/udp     # Flannel VXLAN
```

### 4. Resource Limits

```bash
# Systemd resource limits
sudo systemctl edit gitlab-runner.service

# Add:
[Service]
CPUQuota=200%
MemoryLimit=4G
TasksMax=512
```

## Runner Tags Strategy

Use specific tags for different job types:

```yaml
# Provisioning jobs
tags:
  - provisioning
  - k3s
  - bare-metal

# Deployment jobs
tags:
  - kubernetes
  - docker
  - deployment

# Test jobs
tags:
  - testing
  - performance
```

## Monitoring

### Runner Metrics

```bash
# Enable Prometheus metrics
cat >> /etc/gitlab-runner/config.toml <<EOF
[metrics_server]
  listen_address = ":9252"
EOF

# Restart runner
sudo gitlab-runner restart
```

### Health Checks

```bash
# Check runner status
sudo gitlab-runner status

# Verify runner registration
sudo gitlab-runner verify

# List registered runners
sudo gitlab-runner list

# Check runner logs
sudo journalctl -u gitlab-runner -f
```

## Troubleshooting

### Common Issues

#### 1. Runner Can't Connect to GitLab

```bash
# Test connectivity
curl -v https://gitlab.com/api/v4/version

# Check DNS
nslookup gitlab.com

# Verify token
sudo gitlab-runner verify --delete
```

#### 2. K3s Installation Fails

```bash
# Check system requirements
free -h
df -h
cat /proc/sys/net/ipv4/ip_forward

# Enable required kernel modules
sudo modprobe br_netfilter
sudo modprobe overlay

# Make persistent
cat <<EOF | sudo tee /etc/modules-load.d/k8s.conf
br_netfilter
overlay
EOF
```

#### 3. Docker Permission Issues

```bash
# Add runner to docker group
sudo usermod -aG docker gitlab-runner

# Restart runner service
sudo systemctl restart gitlab-runner
```

#### 4. Kubeconfig Access Issues

```bash
# Fix permissions
sudo chown gitlab-runner:gitlab-runner /etc/rancher/k3s/k3s.yaml
sudo chmod 600 /etc/rancher/k3s/k3s.yaml

# Or use sudo for kubectl
alias kubectl='sudo k3s kubectl'
```

### Debug Mode

Enable debug logging:

```toml
# /etc/gitlab-runner/config.toml
[[runners]]
  log_level = "debug"
```

```bash
# Run in debug mode
sudo gitlab-runner --debug run
```

## Scaling Runners

### Auto-scaling with Docker Machine

```toml
[[runners]]
  executor = "docker+machine"
  [runners.machine]
    IdleCount = 2
    IdleTime = 300
    MaxBuilds = 10
    MachineDriver = "digitalocean"
    MachineName = "gitlab-runner-%s"
    MachineOptions = [
      "digitalocean-access-token=TOKEN",
      "digitalocean-size=s-2vcpu-4gb",
      "digitalocean-region=nyc1"
    ]
```

### Kubernetes-based Auto-scaling

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: gitlab-runner-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: gitlab-runner
  minReplicas: 1
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

## Best Practices

1. **Separate Runners by Purpose**: Use different runners for provisioning vs deployment
2. **Use Tags**: Always tag runners and specify tags in jobs
3. **Limit Concurrent Jobs**: Set appropriate `concurrent` value based on resources
4. **Regular Updates**: Keep runners and their dependencies updated
5. **Monitor Resources**: Set up monitoring and alerting for runner health
6. **Secure Secrets**: Never hardcode credentials, use CI/CD variables
7. **Clean Up**: Implement regular cleanup of old builds and Docker images

## Example Pipeline with Self-hosted Runners

```yaml
# .gitlab-ci.yml
stages:
  - provision
  - deploy
  - test

provision:cluster:
  stage: provision
  tags:
    - provisioning
    - k3s
  script:
    - ./scripts/k8s/provision.sh --profile development
  when: manual

deploy:app:
  stage: deploy
  tags:
    - kubernetes
    - docker
  script:
    - helm upgrade --install myapp ./chart
  needs:
    - provision:cluster

test:smoke:
  stage: test
  tags:
    - testing
  script:
    - ./tests/smoke.sh
  needs:
    - deploy:app
```

## Additional Resources

- [GitLab Runner Documentation](https://docs.gitlab.com/runner/)
- [GitLab Runner Helm Chart](https://docs.gitlab.com/runner/install/kubernetes.html)
- [K3s Documentation](https://docs.k3s.io/)
- [GitLab CI/CD Variables](https://docs.gitlab.com/ee/ci/variables/)