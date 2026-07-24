# Export Wizard User Guide

**Last Updated:** 2025-12-05  
**Spec Reference:** Phase 4.2 - User Documentation

---

## Overview

The Export Wizard allows you to export your configured stacks to various deployment formats:

- **Helm Charts** - For Kubernetes package management
- **Kustomize Manifests** - For Kubernetes configuration management
- **YAML Files** - Raw Kubernetes or Docker Compose manifests

---

## Getting Started

### Accessing the Export Wizard

1. Navigate to your stack's detail page
2. Click the **Export** button in the top-right corner
3. The Export Wizard will open as a modal dialog

---

## Export Formats

### Helm Chart Export

Helm is the package manager for Kubernetes. Choose this option if you:

- Need versioned, reusable deployments
- Want to share configurations with your team
- Require parameterized values for different environments

**Generated Files:**
- `Chart.yaml` - Chart metadata
- `values.yaml` - Configuration values
- `templates/deployment.yaml` - Deployment resource
- `templates/service.yaml` - Service resource
- `templates/ingress.yaml` (optional) - Ingress resource

**Configuration Options:**

| Option | Description |
|--------|-------------|
| Chart Name | Name of the Helm chart |
| Chart Version | Semantic version (e.g., 1.0.0) |
| Namespace | Target Kubernetes namespace |
| Include Custom Resources | Include CRDs if applicable |

### Kustomize Export

Kustomize provides a template-free way to customize Kubernetes manifests. Choose this option if you:

- Need environment-specific overlays (dev, staging, production)
- Prefer native Kubernetes tooling
- Want to manage patches and transformations

**Generated Structure:**
```
base/
├── kustomization.yaml
├── deployment.yaml
└── service.yaml
overlays/
├── dev/
│   └── kustomization.yaml
├── staging/
│   └── kustomization.yaml
└── production/
    └── kustomization.yaml
```

**Configuration Options:**

| Option | Description |
|--------|-------------|
| Namespace | Base namespace for resources |
| Overlays | Select environments to generate |
| Include Secrets | Include secret references |

### YAML Export

Raw YAML export for direct use with kubectl or Docker Compose. Choose this option if you:

- Want simple, direct deployment files
- Need Docker Compose for local development
- Prefer minimal abstraction

**Format Options:**

| Format | Description |
|--------|-------------|
| Kubernetes | Standard K8s manifests |
| Docker Compose | docker-compose.yml format |
| Both | Both formats in archive |

---

## Step-by-Step Export Process

### Step 1: Select Format

Choose your desired export format:
- Helm Chart
- Kustomize
- YAML

### Step 2: Configure Options

Fill in the configuration options specific to your chosen format.

### Step 3: Preview (Optional)

Click **Preview** to see the generated files before downloading.

### Step 4: Download

Click **Download** to receive your export as a `.tar.gz` archive or single file.

---

## Using Exported Files

### Helm Chart

```bash
# Extract the archive
tar -xzf helm-chart.tar.gz

# Install to cluster
helm install my-stack ./helm-chart -n my-namespace

# Upgrade existing deployment
helm upgrade my-stack ./helm-chart -n my-namespace
```

### Kustomize

```bash
# Extract the archive
tar -xzf kustomize-manifests.tar.gz

# Apply development overlay
kubectl apply -k overlays/dev

# Apply production overlay
kubectl apply -k overlays/production
```

### YAML (Kubernetes)

```bash
# Apply directly
kubectl apply -f kubernetes-manifests.yaml -n my-namespace
```

### YAML (Docker Compose)

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down
```

---

## Best Practices

### Version Your Exports

Always include version numbers in your Helm charts and document changes.

### Review Before Deploying

Use the **Preview** feature to inspect generated files before deployment.

### Environment-Specific Values

For production deployments:
- Use secrets management (not plaintext values)
- Set appropriate resource limits
- Enable health checks

### Backup Current State

Before applying new exports, backup your current deployment state:

```bash
# Backup current state
kubectl get all -n my-namespace -o yaml > backup.yaml
```

---

## Troubleshooting

### Export Takes Too Long

Large stacks may take longer to process. Wait for the progress indicator to complete.

### Invalid YAML Error

Ensure your stack configuration is valid. Check the error message for specific field issues.

### Download Fails

1. Check your network connection
2. Try generating again
3. Contact support if issue persists

---

## Related Documentation

- [Import Manager Guide](./import-manager.md)
- [Stack Configuration](./stacks.md)
- [Kubernetes Deployment](../deployment/kubernetes.md)
