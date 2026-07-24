# Import Manager User Guide

**Last Updated:** 2025-12-05  
**Spec Reference:** Phase 4.2 - User Documentation

---

## Overview

The Import Manager allows you to import existing stack configurations from YAML files, enabling you to:

- Migrate existing Docker Compose configurations
- Import Kubernetes manifests
- Transfer stacks between environments

---

## Supported Formats

### Docker Compose

Standard `docker-compose.yml` files (versions 2.x and 3.x).

```yaml
version: '3.8'
services:
  web:
    image: nginx:latest
    ports:
      - "80:80"
  database:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD: secret
```

### Stapelwerk YAML

Native format with additional metadata:

```yaml
name: my-stack
description: Production web application
version: 1.0.0
services:
  - id: nginx
    name: web
    image: nginx:latest
    version: 1.25.0
    ports:
      - internal: 80
        external: 80
    healthCheck:
      command: "curl -f http://localhost/"
      interval: 30
      timeout: 10
      retries: 3
```

---

## Step-by-Step Import Process

### Step 1: Access Import Manager

1. Navigate to **Stacks** in the main menu
2. Click **Import Stack** button
3. The Import Manager dialog opens

### Step 2: Upload or Paste YAML

**Option A: Upload File**
- Click the upload area
- Select your YAML file
- Supported: `.yml`, `.yaml` files up to 5MB

**Option B: Paste Content**
- Click the "Paste YAML" tab
- Paste your configuration directly
- Click "Parse" to continue

### Step 3: Review Validation Results

The system validates your YAML and displays:

**✅ Valid Items:**
- Services found and matched in catalog
- Properly configured settings

**⚠️ Warnings:**
- Missing health checks
- Missing resource limits
- Insecure configurations

**❌ Errors:**
- Invalid YAML syntax
- Unknown services
- Circular dependencies

### Step 4: Resolve Issues

For each issue:

1. **Service Not Found** - Map to an available service or skip
2. **Invalid Version** - Select an available version
3. **Circular Dependency** - Review and break the cycle

### Step 5: Confirm Import

Review the import preview showing:

- Stack name and description
- Number of services
- Networks and volumes
- Any warnings to acknowledge

Click **Import** to create the stack.

---

## Validation Rules

### YAML Structure

The importer validates:

| Field | Requirements |
|-------|-------------|
| `name` | Required, 1-255 characters |
| `services` | Required, at least 1 service |
| `services[].id` | Required, valid service ID |
| `services[].name` | Required, display name |
| `services[].image` | Required, Docker image reference |

### Service Verification

Each service is checked against the catalog:

1. **Service Exists** - Must be in Stapelwerk catalog
2. **Version Available** - Specified version must be available
3. **Compatibility** - Service must be compatible with stack

### Dependency Analysis

The import builds a dependency graph and checks for:

- **Circular Dependencies** - A→B→C→A cycles
- **Missing Dependencies** - References to undefined services
- **Ordered Deployment** - Proper startup sequence

---

## Import Preview

Before finalizing, review the preview:

```
┌──────────────────────────────────────────────┐
│  Import Preview                               │
├──────────────────────────────────────────────┤
│  Stack: my-production-stack                  │
│  Services: 5                                  │
│  Networks: 2                                  │
│  Volumes: 3                                   │
├──────────────────────────────────────────────┤
│  ⚠️ Warnings:                                │
│  • 2 services missing health checks          │
│  • 1 service using latest tag                │
└──────────────────────────────────────────────┘
```

---

## Common Import Scenarios

### Migrating from Docker Compose

1. Export your `docker-compose.yml`
2. Upload to Import Manager
3. Map any custom images to catalog services
4. Import and customize as needed

### Importing from Another Instance

1. Export stack from source instance
2. Download the YAML file
3. Upload to destination Import Manager
4. Verify service availability

### Importing Kubernetes Manifests

1. Convert K8s manifests to stack format
2. Or use the YAML conversion option
3. Review mapped services
4. Import with adjustments

---

## Troubleshooting

### "Invalid YAML Syntax"

**Cause:** Malformed YAML structure

**Solution:**
1. Validate YAML at [yamlvalidator.com](https://yamlvalidator.com)
2. Check for:
   - Incorrect indentation
   - Missing colons
   - Unquoted special characters

### "Service Not Found in Catalog"

**Cause:** Service ID doesn't match catalog

**Solution:**
1. Use the service mapping feature
2. Select a similar available service
3. Or skip the service and add manually later

### "Circular Dependency Detected"

**Cause:** Services have mutual dependencies

**Solution:**
1. Review the dependency cycle shown
2. Remove one dependency to break the cycle
3. Re-import the corrected YAML

### "Version Not Available"

**Cause:** Specified version not in catalog

**Solution:**
1. Check available versions in catalog
2. Update YAML with available version
3. Or use `latest` (not recommended for production)

---

## Best Practices

### Before Importing

- **Validate YAML** - Use a linter before uploading
- **Check Service Availability** - Verify services exist in catalog
- **Review Dependencies** - Ensure no circular references

### During Import

- **Address All Warnings** - Don't ignore security warnings
- **Add Health Checks** - Essential for production stacks
- **Set Resource Limits** - Prevent runaway containers

### After Import

- **Test the Stack** - Deploy to development first
- **Update Secrets** - Don't import plaintext passwords
- **Enable Monitoring** - Add observability configuration

---

## Related Documentation

- [Export Wizard Guide](./export-wizard.md)
- [Stack Configuration](./stacks.md)
- [YAML Format Reference](../api/yaml-format.md)
