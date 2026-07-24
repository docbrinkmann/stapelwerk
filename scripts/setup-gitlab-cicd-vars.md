# GitLab CI/CD Variables Setup Guide

## Prerequisites

Before starting, ensure you have:
1. ✅ Run `scripts/setup-production-env.sh` and saved the generated secrets
2. ✅ Generated SSH key pair for deployment
3. ✅ Access to GitLab project settings

---

## Step 1: Generate SSH Key for CI/CD Deployment

```bash
# Generate a new ED25519 SSH key
ssh-keygen -t ed25519 -C "gitlab-ci-deploy@build-my-stack" -f ~/.ssh/gitlab-ci-buildmystack

# This creates two files:
# - ~/.ssh/gitlab-ci-buildmystack (private key - for GitLab CI/CD)
# - ~/.ssh/gitlab-ci-buildmystack.pub (public key - for server)
```

### Copy public key to server:

```bash
# Display the public key
cat ~/.ssh/gitlab-ci-buildmystack.pub

# Add this to your server's authorized_keys:
# ssh user@*************** "mkdir -p ~/.ssh && chmod 700 ~/.ssh"
# ssh user@*************** "cat >> ~/.ssh/authorized_keys" < ~/.ssh/gitlab-ci-buildmystack.pub
```

---

## Step 2: Add Variables to GitLab

Go to: **GitLab Project → Settings → CI/CD → Variables → Expand → Add Variable**

### Required Variables:

| Variable Name | Type | Value | Protected | Masked | Expanded |
|--------------|------|-------|-----------|--------|----------|
| `SSH_PRIVATE_KEY` | File | Contents of `~/.ssh/gitlab-ci-buildmystack` | ✅ Yes | ✅ Yes | ❌ No |
| `SERVER_HOST` | Variable | `***************` | ✅ Yes | ❌ No | ✅ Yes |
| `SERVER_USER` | Variable | Your server username | ✅ Yes | ❌ No | ✅ Yes |
| `DATABASE_URL` | Variable | From .env.production | ✅ Yes | ✅ Yes | ❌ No |
| `NEXTAUTH_SECRET` | Variable | From .env.production | ✅ Yes | ✅ Yes | ❌ No |
| `NEXTAUTH_URL` | Variable | `https://buildmystack.minilab.live` | ✅ Yes | ❌ No | ✅ Yes |
| `CI_REGISTRY` | Variable | `registry.gitlab.minilab.live` | ✅ Yes | ❌ No | ✅ Yes |
| `CI_REGISTRY_IMAGE` | Variable | `registry.gitlab.minilab.live/username/build-my-stack` | ✅ Yes | ❌ No | ✅ Yes |

### Optional Variables (if using):

| Variable Name | Type | Value | Protected | Masked | Expanded |
|--------------|------|-------|-----------|--------|----------|
| `SENTRY_DSN` | Variable | Your Sentry DSN | ✅ Yes | ✅ Yes | ❌ No |
| `SENTRY_AUTH_TOKEN` | Variable | Your Sentry token | ✅ Yes | ✅ Yes | ❌ No |
| `REDIS_URL` | Variable | Your Redis connection string | ✅ Yes | ✅ Yes | ❌ No |

---

## Step 3: Quick Commands to Get Values

### Display SSH Private Key:
```bash
cat ~/.ssh/gitlab-ci-buildmystack
```

### Get values from .env.production:
```bash
# Display NEXTAUTH_SECRET
grep "^NEXTAUTH_SECRET=" .env.production | cut -d'=' -f2

# Display DATABASE_URL
grep "^DATABASE_URL=" .env.production | cut -d'=' -f2

# Display CI_REGISTRY_IMAGE
grep "^CI_REGISTRY_IMAGE=" .env.production | cut -d'=' -f2
```

---

## Step 4: Add Variables in GitLab UI

### For each variable:

1. **Click "Add variable"**

2. **Fill in the details:**
   - **Key**: Variable name (e.g., `SSH_PRIVATE_KEY`)
   - **Value**: The actual value
   - **Type**: Variable or File (use File for SSH_PRIVATE_KEY)
   - **Environment scope**: All (default)
   - **Flags**:
     - ✅ **Protect variable**: Check this (only available on protected branches)
     - ✅ **Mask variable**: Check for sensitive values (passwords, tokens, keys)
     - ⚠️ **Expand variable reference**: Uncheck for complex values like SSH keys

3. **Click "Add variable"**

---

## Step 5: Verify SSH Key Setup

Test SSH connection from your local machine:

```bash
# Test SSH connection with the deployment key
ssh -i ~/.ssh/gitlab-ci-buildmystack user@***************

# If successful, you should get a shell prompt
# Exit with: exit
```

---

## Step 6: Verify GitLab Runner Can Access Registry

The GitLab CI pipeline will automatically authenticate to the container registry using:
- `CI_REGISTRY_USER` (automatically provided by GitLab)
- `CI_REGISTRY_PASSWORD` (automatically provided by GitLab)

No additional setup needed for registry authentication in CI/CD!

---

## Common Issues & Solutions

### Issue: SSH connection fails in CI/CD

**Solution**: Ensure:
1. SSH private key is added as **File** type (not Variable)
2. Public key is in server's `~/.ssh/authorized_keys`
3. Server's `~/.ssh` directory has `700` permissions
4. Server's `~/.ssh/authorized_keys` has `600` permissions

### Issue: "Permission denied" when pulling Docker image

**Solution**: 
1. Verify `CI_REGISTRY_IMAGE` is correct
2. Check project has access to container registry
3. Ensure GitLab Runner has registry permissions

### Issue: DATABASE_URL not working

**Solution**:
- Ensure format: `postgresql://USER:PASSWORD@HOST:PORT/DATABASE`
- No spaces in the connection string
- Password is URL-encoded if it contains special characters

---

## Validation Checklist

Before running the CI/CD pipeline:

- [ ] SSH private key added to GitLab CI/CD variables (as File type)
- [ ] SSH public key added to production server
- [ ] SSH connection tested successfully
- [ ] All required variables added to GitLab
- [ ] Protected variables only on protected branches (main)
- [ ] Sensitive variables are masked
- [ ] CI_REGISTRY_IMAGE matches your project path
- [ ] DATABASE_URL uses `postgres` hostname (not localhost)
- [ ] Server can access GitLab Container Registry

---

## Next Steps

After setting up variables:

1. **Commit and push to a feature branch** to test the pipeline
2. **Check CI/CD pipeline** in GitLab → CI/CD → Pipelines
3. **Verify tests pass** in the test stage
4. **Merge to main** when ready
5. **Manually trigger deploy** in the pipeline (deploy:docker job)

---

## Quick Reference: Variable Usage in Pipeline

```yaml
# .gitlab-ci.docker.yml uses these variables:

# For SSH deployment:
- $SSH_PRIVATE_KEY      # Your private key for server access
- $SERVER_HOST          # Server IP or hostname
- $SERVER_USER          # Username on the server

# For container registry:
- $CI_REGISTRY_IMAGE    # Full path to your Docker image
- $CI_REGISTRY_USER     # Auto-provided by GitLab
- $CI_REGISTRY_PASSWORD # Auto-provided by GitLab

# For application configuration:
- $DATABASE_URL         # PostgreSQL connection string
- $NEXTAUTH_SECRET      # NextAuth session secret
- $NEXTAUTH_URL         # Public application URL
```

---

## Security Best Practices

✅ **DO**:
- Use File type for SSH keys
- Mask all sensitive values (passwords, tokens, keys)
- Protect variables for production environments
- Rotate secrets periodically
- Use strong, randomly generated passwords

❌ **DON'T**:
- Commit secrets to repository
- Share masked variables publicly
- Use the same passwords across environments
- Store production secrets in development
- Echo or log sensitive variables in CI/CD jobs

---

**For detailed server setup, see:** `docs/SERVER_SETUP.md`
**For deployment procedures, see:** `docs/DEPLOYMENT_COMPLETE.md`
