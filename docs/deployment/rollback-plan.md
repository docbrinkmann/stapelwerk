# Production Rollback Plan

**Last Updated:** 2025-12-05  
**Spec Reference:** Phase 4.3 - Deployment

---

## Overview

This document outlines procedures for rolling back production deployments when issues are detected.

---

## Pre-Rollback Checklist

Before initiating rollback:

- [ ] Confirm the issue warrants rollback
- [ ] Identify the target rollback version
- [ ] Notify stakeholders
- [ ] Ensure database backup is available
- [ ] Verify rollback environment readiness

---

## Rollback Procedures

### 1. Application Rollback (Kubernetes)

#### Using kubectl

```bash
# View deployment history
kubectl rollout history deployment/stapelwerk -n production

# Rollback to previous version
kubectl rollout undo deployment/stapelwerk -n production

# Rollback to specific revision
kubectl rollout undo deployment/stapelwerk -n production --to-revision=3

# Verify rollback
kubectl rollout status deployment/stapelwerk -n production
```

#### Using Helm

```bash
# View release history
helm history stapelwerk -n production

# Rollback to previous release
helm rollback stapelwerk -n production

# Rollback to specific revision
helm rollback stapelwerk 3 -n production

# Verify
helm status stapelwerk -n production
```

#### Using ArgoCD (GitOps)

```bash
# Via CLI
argocd app rollback stapelwerk-production REVISION_ID

# Via UI
1. Open ArgoCD dashboard
2. Select application
3. Go to History tab
4. Select target revision
5. Click "Rollback"
```

### 2. Database Rollback

#### Prisma Migrations

```bash
# Revert last migration
npx prisma migrate resolve --rolled-back MIGRATION_NAME

# Or restore from backup
pg_restore -h localhost -U postgres -d stapelwerk backup.dump
```

#### Full Database Restore

```bash
# Stop application
kubectl scale deployment/stapelwerk --replicas=0 -n production

# Restore from backup
pg_restore --clean --if-exists \
  -h $DB_HOST -U $DB_USER -d stapelwerk \
  /backups/stapelwerk-YYYYMMDD.dump

# Restart application
kubectl scale deployment/stapelwerk --replicas=3 -n production
```

### 3. Infrastructure Rollback (Pulumi)

```bash
# View stack history
pulumi stack history

# Restore to previous state
pulumi stack export > current-state.json
pulumi stack import < previous-state.json

# Or destroy and recreate
pulumi destroy --target urn:pulumi:prod::stapelwerk::resource
pulumi up
```

---

## Rollback Decision Tree

```
Issue Detected
     │
     ▼
Is it a security vulnerability?
     │
   Yes ──► Immediate rollback + incident response
     │
    No
     │
     ▼
Is user data at risk?
     │
   Yes ──► Immediate rollback
     │
    No
     │
     ▼
Is service degraded >50%?
     │
   Yes ──► Rollback within 15 min
     │
    No
     │
     ▼
Can hotfix be deployed quickly?
     │
   Yes ──► Deploy hotfix
     │
    No ──► Schedule rollback
```

---

## Rollback Scripts

### Quick Rollback Script

Located at: `scripts/rollback-production.sh`

```bash
#!/bin/bash
# Usage: ./scripts/rollback-production.sh [revision]

set -e

REVISION=${1:-""}
NAMESPACE="production"
DEPLOYMENT="stapelwerk"

echo "🔄 Starting rollback..."

if [ -z "$REVISION" ]; then
    echo "Rolling back to previous version..."
    kubectl rollout undo deployment/$DEPLOYMENT -n $NAMESPACE
else
    echo "Rolling back to revision $REVISION..."
    kubectl rollout undo deployment/$DEPLOYMENT -n $NAMESPACE --to-revision=$REVISION
fi

echo "⏳ Waiting for rollout..."
kubectl rollout status deployment/$DEPLOYMENT -n $NAMESPACE --timeout=300s

echo "✅ Rollback complete!"
kubectl get pods -n $NAMESPACE -l app=$DEPLOYMENT
```

### Database Rollback Script

Located at: `scripts/db-rollback.sh`

```bash
#!/bin/bash
# Usage: ./scripts/db-rollback.sh BACKUP_FILE

set -e

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 BACKUP_FILE"
    exit 1
fi

echo "🔄 Starting database rollback..."

# Scale down app
kubectl scale deployment/stapelwerk --replicas=0 -n production

# Wait for pods to terminate
sleep 10

# Restore database
pg_restore --clean --if-exists \
  -h $DB_HOST -U $DB_USER -d stapelwerk \
  $BACKUP_FILE

# Scale up app
kubectl scale deployment/stapelwerk --replicas=3 -n production

echo "✅ Database rollback complete!"
```

---

## Post-Rollback Actions

### Immediate Actions

1. **Verify Service Health**
   ```bash
   curl -s https://stapelwerk.example.com/api/health | jq
   ```

2. **Monitor Metrics**
   - Check error rates in Grafana
   - Verify response times
   - Monitor resource usage

3. **Review Logs**
   ```bash
   kubectl logs -f deployment/stapelwerk -n production --tail=100
   ```

### Follow-up Actions

1. **Post-Mortem**
   - Document what went wrong
   - Identify root cause
   - Define preventive measures

2. **Communicate**
   - Update stakeholders
   - Update status page
   - Notify affected users if needed

3. **Plan Fix**
   - Create hotfix branch
   - Test thoroughly
   - Schedule new deployment

---

## Emergency Contacts

| Role | Contact |
|------|---------|
| On-Call Engineer | [Internal pager] |
| DevOps Lead | [Contact info] |
| Database Admin | [Contact info] |
| Security Team | [Contact info] |

---

## Rollback History Log

Document all production rollbacks:

| Date | Version | Reason | Duration | Post-Mortem |
|------|---------|--------|----------|-------------|
| YYYY-MM-DD | v1.x.x → v1.y.y | Brief reason | Xm | Link |

---

## Related Documentation

- [Deployment Guide](../DEPLOYMENT.md)
- [Monitoring Runbooks](../operations/runbooks/)
- [Incident Response](../operations/incident-response.md)
