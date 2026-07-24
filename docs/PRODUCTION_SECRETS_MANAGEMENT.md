# Production Secrets Management & Environment Setup

This document outlines the best practices and procedures for managing secrets and configuring the production environment for the Stapelwerk AI Recommendations system.

## 🔐 Secrets Management Overview

Secure management of production secrets is critical for maintaining the security and integrity of the Stapelwerk AI-powered recommendation system. The following guidelines must be followed for all production deployments.

### Key Principles

1. **Never store secrets in code or version control**
2. **Use a dedicated secrets management system**
3. **Apply least privilege principle for secret access**
4. **Rotate secrets regularly**
5. **Use environment-specific secrets**
6. **Audit secret access**

## 🗄️ Secrets Management Systems

For production deployment, use one of these recommended secrets management solutions:

### 1. HashiCorp Vault (Preferred)

HashiCorp Vault provides secure secret storage with dynamic secrets, encryption as a service, and detailed audit logging.

**Setup Instructions:**

```bash
# Install Vault in production environment
helm repo add hashicorp https://helm.releases.hashicorp.com
helm install vault hashicorp/vault \
  --namespace vault \
  --create-namespace \
  --set "server.ha.enabled=true" \
  --set "server.ha.replicas=3"

# Configure authentication
vault auth enable kubernetes
vault write auth/kubernetes/config \
    kubernetes_host="https://$KUBERNETES_SERVICE_HOST:$KUBERNETES_SERVICE_PORT"

# Create secret policy
vault policy write stapelwerk-ai-policy - <<EOF
path "secret/data/stapelwerk/ai/*" {
  capabilities = ["read"]
}
EOF

# Setup Kubernetes authentication
vault write auth/kubernetes/role/stapelwerk-ai \
    bound_service_account_names=stapelwerk-ai-sa \
    bound_service_account_namespaces=stapelwerk \
    policies=stapelwerk-ai-policy \
    ttl=24h
```

### 2. AWS Secrets Manager (Cloud-Based Alternative)

For AWS-based deployments, AWS Secrets Manager provides managed secret storage with automatic rotation capabilities.

**Setup Instructions:**

```bash
# Create a secret with AWS CLI
aws secretsmanager create-secret \
    --name "/production/stapelwerk-ai" \
    --description "Stapelwerk AI Production Secrets" \
    --secret-string "{\"db_password\":\"SECURE_PASSWORD\",\"redis_password\":\"SECURE_PASSWORD\"}"

# Set up secret rotation
aws secretsmanager rotate-secret \
    --secret-id "/production/stapelwerk-ai" \
    --rotation-lambda-arn "arn:aws:lambda:REGION:ACCOUNT_ID:function:SecretRotation" \
    --rotation-rules "{\"AutomaticallyAfterDays\": 90}"
```

### 3. Kubernetes Secrets (Baseline Option)

For basic deployments, Kubernetes Secrets provide a simple secret management solution.

**Setup Instructions:**

```bash
# Create namespace if it doesn't exist
kubectl create namespace stapelwerk

# Create secret for database
kubectl create secret generic db-secrets \
    --namespace stapelwerk \
    --from-literal=password='SECURE_DB_PASSWORD'

# Create secret for Redis
kubectl create secret generic redis-secrets \
    --namespace stapelwerk \
    --from-literal=password='SECURE_REDIS_PASSWORD'

# Create secret for API keys
kubectl create secret generic ai-secrets \
    --namespace stapelwerk \
    --from-literal=openai-key='OPENAI_API_KEY' \
    --from-literal=anthropic-key='ANTHROPIC_API_KEY'

# Create secret for JWT
kubectl create secret generic app-secrets \
    --namespace stapelwerk \
    --from-literal=jwt-secret='SECURE_JWT_SECRET'

# Create secret for monitoring
kubectl create secret generic monitoring-secrets \
    --namespace stapelwerk \
    --from-literal=sentry-dsn='SENTRY_DSN'
```

## 🔄 Secret Rotation Policy

All production secrets must be rotated regularly to minimize the risk of compromise.

### Rotation Schedule

| Secret Type | Rotation Frequency | Notes |
|------------|-------------------|-------|
| Database credentials | 90 days | Coordinate with DB maintenance window |
| Redis credentials | 90 days | May require service restart |
| API keys (OpenAI, Anthropic) | 180 days | External service provider keys |
| JWT signing secret | 90 days | Requires user re-authentication |
| Admin API tokens | 60 days | High privilege access |
| Feature flag tokens | 90 days | Used for feature control |
| SMTP credentials | 180 days | External service credentials |
| Webhook URLs | 180 days | Regenerate on any suspected exposure |

### Rotation Procedure

1. Generate new secret value
2. Update secret in secrets management system
3. Deploy updated configuration
4. Verify application is using new secret
5. Revoke old secret when safe
6. Document rotation in security log

## 📝 Environment Configuration

### Production Environment Variables

The application uses environment variables for configuration. A template is provided at `/deployment/production.env.template`.

**Setup Process:**

1. Copy the template to a secure location outside version control
2. Replace placeholder values with actual production values
3. Replace all `${SECRET_*}` variables with actual secrets or reference secrets from your secret management system
4. Validate configuration before deployment

### Environment-Specific Configuration

Each deployment environment should have its own set of secrets:

- **Development**: Used for local development
- **Staging**: Used for pre-production testing
- **Production**: Used for the live production environment

Never reuse secrets across environments to prevent cross-environment contamination in case of compromise.

## 🔒 Accessing Secrets in Deployment

### Using HashiCorp Vault with Kubernetes

Install the Vault Agent Injector and configure it to inject secrets as environment variables:

```yaml
# vault-agent-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: vault-agent-config
  namespace: stapelwerk
data:
  config.hcl: |
    auto_auth {
      method "kubernetes" {
        mount_path = "auth/kubernetes"
        config = {
          role = "stapelwerk-ai"
        }
      }
    }

    template {
      destination = "/vault/secrets/config.env"
      contents = <<EOT
        {{- with secret "secret/data/stapelwerk/ai/production" -}}
        export DB_PASSWORD="{{ .Data.data.db_password }}"
        export REDIS_PASSWORD="{{ .Data.data.redis_password }}"
        export OPENAI_API_KEY="{{ .Data.data.openai_api_key }}"
        export ANTHROPIC_API_KEY="{{ .Data.data.anthropic_api_key }}"
        export JWT_SECRET="{{ .Data.data.jwt_secret }}"
        export SENTRY_DSN="{{ .Data.data.sentry_dsn }}"
        {{- end -}}
      EOT
    }
```

Update deployment to use the Vault agent:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: stapelwerk-ai
  namespace: stapelwerk
spec:
  # ... other deployment settings ...
  template:
    metadata:
      annotations:
        vault.hashicorp.com/agent-inject: "true"
        vault.hashicorp.com/agent-inject-status: "update"
        vault.hashicorp.com/role: "stapelwerk-ai"
        vault.hashicorp.com/agent-inject-secret-config.env: "secret/data/stapelwerk/ai/production"
        vault.hashicorp.com/agent-inject-template-config.env: |
          {{- with secret "secret/data/stapelwerk/ai/production" -}}
          export DB_PASSWORD="{{ .Data.data.db_password }}"
          export REDIS_PASSWORD="{{ .Data.data.redis_password }}"
          export OPENAI_API_KEY="{{ .Data.data.openai_api_key }}"
          export ANTHROPIC_API_KEY="{{ .Data.data.anthropic_api_key }}"
          export JWT_SECRET="{{ .Data.data.jwt_secret }}"
          export SENTRY_DSN="{{ .Data.data.sentry_dsn }}"
          {{- end -}}
    spec:
      # ... container specs ...
      containers:
      - name: stapelwerk-ai
        # ... container settings ...
        command:
        - /bin/sh
        - -c
        - source /vault/secrets/config.env && node app.js
```

### Using AWS Secrets Manager

For AWS deployments, you can use the AWS Secrets Manager directly or with a sidecar container:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: stapelwerk-ai
  namespace: stapelwerk
spec:
  # ... other deployment settings ...
  template:
    spec:
      containers:
      - name: stapelwerk-ai
        # ... container settings ...
        env:
        - name: AWS_REGION
          value: "us-east-1"
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: aws-secret-stapelwerk
              key: db_password
        # ... other env vars ...
      initContainers:
      - name: init-secrets
        image: amazon/aws-cli
        command:
        - /bin/sh
        - -c
        - |
          aws secretsmanager get-secret-value --secret-id /production/stapelwerk-ai --query SecretString --output text > /tmp/secrets/secrets.json
          cat /tmp/secrets/secrets.json | jq -r 'to_entries | map("export \(.key)=\(.value|tostring)") | .[]' > /tmp/secrets/env-secrets
        volumeMounts:
        - name: secrets-volume
          mountPath: /tmp/secrets
      volumes:
      - name: secrets-volume
        emptyDir:
          medium: Memory
```

## 🔍 Audit and Monitoring

### Secret Access Auditing

Set up auditing for all secret access operations:

1. Enable audit logging in your secrets management system
2. Forward logs to your central logging system
3. Set up alerts for suspicious access patterns
4. Regularly review access logs

### Example Vault Audit Configuration

```bash
# Enable file audit device
vault audit enable file file_path=/var/log/vault/audit.log

# Enable syslog audit device
vault audit enable syslog tag="vault" facility="AUTH"
```

### Secret Access Monitoring

Set up monitoring to detect potential compromise:

1. Monitor for unauthorized access attempts
2. Alert on unusual access patterns or times
3. Track secret usage metrics
4. Set up alerts for secrets nearing rotation deadlines

## 🧪 Verification and Testing

### Pre-Deployment Verification

Before each production deployment:

1. Verify all required secrets are available
2. Validate secret access configuration
3. Test secret rotation procedures
4. Run security scans on configuration

### Continuous Validation

During operation:

1. Regularly verify secret access is working
2. Monitor for secret-related errors
3. Test secret rotation processes quarterly
4. Validate backup and recovery procedures

## 🚨 Incident Response

In case of suspected secret compromise:

1. Immediately rotate the affected secrets
2. Investigate the extent of the exposure
3. Monitor for unusual activity
4. Document the incident and response
5. Review and update security procedures

## 📊 Secret Inventory

Maintain an inventory of all production secrets with the following information:

1. Secret name and purpose
2. Location in secrets management system
3. Last rotation date
4. Next scheduled rotation
5. Owner/responsible team
6. Criticality level

Do not include actual secret values in this inventory.

## 📚 Best Practices Summary

1. **Principle of Least Privilege**: Grant minimal access required for operation
2. **Separation of Duties**: No single person should have access to all secrets
3. **Defense in Depth**: Use multiple layers of security
4. **Automation**: Automate secret rotation and management
5. **Encryption**: Always encrypt secrets at rest and in transit
6. **Monitoring**: Continuously monitor for security events
7. **Documentation**: Maintain clear, up-to-date documentation
8. **Regular Audits**: Perform regular security audits
9. **Emergency Access**: Define emergency access procedures
10. **Zero Trust**: Verify all access attempts, even from trusted networks

## 🔗 Additional Resources

- [HashiCorp Vault Documentation](https://www.vaultproject.io/docs)
- [AWS Secrets Manager Documentation](https://docs.aws.amazon.com/secretsmanager/)
- [Kubernetes Secrets Documentation](https://kubernetes.io/docs/concepts/configuration/secret/)
- [OWASP Secrets Management Guide](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/09-Testing_for_Weak_Cryptography/05-Testing_for_Weak_or_Unenforced_Username_Policy)
- [CIS Kubernetes Benchmark](https://www.cisecurity.org/benchmark/kubernetes)

---

## Secret Management Tool Installation

### Installing HashiCorp Vault on Kubernetes

For detailed installation, see the [Vault Helm chart documentation](https://www.vaultproject.io/docs/platform/k8s/helm).

Basic installation:

```bash
# Add the HashiCorp Helm repository
helm repo add hashicorp https://helm.releases.hashicorp.com

# Install Vault
helm install vault hashicorp/vault \
  --namespace vault \
  --create-namespace \
  --set "server.ha.enabled=true"
```

### Installing AWS Secrets Manager Provider for Kubernetes

For AWS-based deployments:

```bash
# Install the Secrets Store CSI Driver
helm repo add secrets-store-csi-driver https://kubernetes-sigs.github.io/secrets-store-csi-driver/charts
helm install csi-secrets-store secrets-store-csi-driver/secrets-store-csi-driver \
  --namespace kube-system

# Install the AWS provider
helm repo add aws-secrets-manager https://aws.github.io/secrets-store-csi-driver-provider-aws
helm install -n kube-system secrets-provider-aws aws-secrets-manager/secrets-store-csi-driver-provider-aws
```

---

## Appendix: Secret Generation

### Generating Secure Random Passwords

```bash
# Generate a secure random password
openssl rand -base64 32

# Generate a secure JWT secret
openssl rand -hex 32
```

### Setting Up Database Credentials

Always use dedicated service accounts with minimal privileges:

```sql
-- Create application database user with limited permissions
CREATE USER stapelwerk_app WITH PASSWORD 'SECURE_PASSWORD';
GRANT CONNECT ON DATABASE stapelwerk_prod TO stapelwerk_app;
GRANT USAGE ON SCHEMA public TO stapelwerk_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO stapelwerk_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO stapelwerk_app;

-- Create read-only user for monitoring
CREATE USER stapelwerk_monitor WITH PASSWORD 'SECURE_MONITOR_PASSWORD';
GRANT CONNECT ON DATABASE stapelwerk_prod TO stapelwerk_monitor;
GRANT USAGE ON SCHEMA public TO stapelwerk_monitor;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO stapelwerk_monitor;
```