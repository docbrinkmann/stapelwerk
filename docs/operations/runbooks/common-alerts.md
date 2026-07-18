# Common Alerts Runbook

**Last Updated:** 2025-12-05  
**Spec Reference:** Phase 4.4 - Monitoring & Observability

---

## Alert Response Overview

This runbook provides step-by-step procedures for responding to common alerts in the BuildMyStack production environment.

---

## High Priority Alerts

### 🔴 HighErrorRate

**Severity:** Critical  
**Threshold:** Error rate > 5% for 5 minutes

**Symptoms:**
- Users reporting errors
- API requests failing
- Dashboard showing error spikes

**Investigation Steps:**

1. **Check recent deployments**
   ```bash
   kubectl rollout history deployment/build-my-stack -n production
   ```

2. **Review application logs**
   ```bash
   kubectl logs -f deployment/build-my-stack -n production --tail=500 | grep -i error
   ```

3. **Check database connectivity**
   ```bash
   kubectl exec -it deployment/build-my-stack -n production -- \
     nc -zv $DB_HOST 5432
   ```

4. **Review recent changes**
   - Check ArgoCD sync history
   - Review recent merge requests

**Resolution:**
- If caused by bad deploy: [Rollback](#rollback-procedure)
- If database issue: [Database Recovery](#database-issues)
- If external dependency: Enable circuit breaker

---

### 🔴 HighLatency

**Severity:** Critical  
**Threshold:** P95 latency > 2s for 5 minutes

**Symptoms:**
- Slow page loads
- API timeouts
- User complaints

**Investigation Steps:**

1. **Check resource usage**
   ```bash
   kubectl top pods -n production
   ```

2. **Review database queries**
   ```bash
   # Check slow query log
   kubectl logs deployment/postgres -n production | grep -i slow
   ```

3. **Check external services**
   - ArgoCD API latency
   - External API dependencies

4. **Review traces**
   - Open Jaeger/Tempo UI
   - Find slow traces
   - Identify bottleneck

**Resolution:**
- Scale pods if CPU/memory bound
- Optimize slow database queries
- Add caching for hot paths
- Enable rate limiting for abusive clients

---

### 🔴 PodCrashLooping

**Severity:** Critical  
**Threshold:** Pod restart count > 3 in 10 minutes

**Symptoms:**
- Service unavailability
- Intermittent errors
- Pod restart events

**Investigation Steps:**

1. **Check pod status**
   ```bash
   kubectl get pods -n production -l app=build-my-stack
   kubectl describe pod <pod-name> -n production
   ```

2. **Check container logs**
   ```bash
   kubectl logs <pod-name> -n production --previous
   ```

3. **Check events**
   ```bash
   kubectl get events -n production --sort-by='.lastTimestamp'
   ```

4. **Check resource limits**
   ```bash
   kubectl describe deployment/build-my-stack -n production | grep -A5 Resources
   ```

**Resolution:**
- OOMKilled: Increase memory limits
- Config error: Fix configuration and redeploy
- Dependency failure: Check upstream services
- Image issue: Roll back to previous image

---

### 🟠 HighMemoryUsage

**Severity:** Warning  
**Threshold:** Memory > 80% for 10 minutes

**Symptoms:**
- OOMKilled pods
- Degraded performance
- Increased GC time

**Investigation Steps:**

1. **Check memory usage**
   ```bash
   kubectl top pods -n production
   ```

2. **Check for memory leaks**
   ```bash
   # Review heap dumps if available
   kubectl exec deployment/build-my-stack -n production -- \
     node --inspect=0.0.0.0:9229
   ```

3. **Review recent changes**
   - Check for new dependencies
   - Review memory-intensive operations

**Resolution:**
- Scale horizontally if traffic-related
- Increase memory limits temporarily
- Identify and fix memory leak
- Add memory profiling to CI

---

### 🟠 HighCPUUsage

**Severity:** Warning  
**Threshold:** CPU > 80% for 10 minutes

**Symptoms:**
- High latency
- Throttling
- Degraded response times

**Investigation Steps:**

1. **Check CPU usage**
   ```bash
   kubectl top pods -n production
   ```

2. **Profile application**
   - Check flame graphs
   - Identify hot code paths

3. **Check for runaway processes**
   ```bash
   kubectl exec deployment/build-my-stack -n production -- top -b -n1
   ```

**Resolution:**
- Scale horizontally
- Optimize hot code paths
- Add caching
- Rate limit expensive operations

---

### 🟠 DatabaseConnectionPool

**Severity:** Warning  
**Threshold:** Connection pool usage > 80%

**Symptoms:**
- Database connection errors
- Slow queries
- Request timeouts

**Investigation Steps:**

1. **Check connection count**
   ```sql
   SELECT count(*) FROM pg_stat_activity 
   WHERE datname = 'buildmystack';
   ```

2. **Check for idle connections**
   ```sql
   SELECT * FROM pg_stat_activity 
   WHERE state = 'idle' 
   AND datname = 'buildmystack';
   ```

3. **Review connection pool config**
   ```bash
   kubectl exec deployment/build-my-stack -n production -- \
     printenv | grep -i pool
   ```

**Resolution:**
- Increase pool size (if database can handle)
- Fix connection leaks
- Add connection timeout
- Scale database if needed

---

## Standard Procedures

### Rollback Procedure

```bash
# Quick rollback to previous version
kubectl rollout undo deployment/build-my-stack -n production

# Wait for rollout
kubectl rollout status deployment/build-my-stack -n production

# Verify health
curl -s https://build-my-stack.example.com/api/health | jq
```

### Scale Procedure

```bash
# Scale up
kubectl scale deployment/build-my-stack --replicas=5 -n production

# Verify scaling
kubectl get pods -n production -l app=build-my-stack
```

### Database Issues

```bash
# Check database status
kubectl exec deployment/postgres -n production -- pg_isready

# Check replication lag
kubectl exec deployment/postgres -n production -- \
  psql -c "SELECT * FROM pg_stat_replication;"

# Force failover (if using HA)
kubectl annotate pod postgres-0 -n production \
  postgresql.patroni.io/failover=true
```

---

## Escalation Matrix

| Severity | Response Time | Escalation |
|----------|--------------|------------|
| Critical | < 15 min | On-call → Team Lead → Manager |
| Warning | < 1 hour | On-call → Team Lead |
| Info | Next business day | Assigned engineer |

---

## Communication Templates

### Incident Started

```
🚨 INCIDENT: [Alert Name]
Status: Investigating
Impact: [Describe user impact]
Start Time: [Time]
Updates: [Slack channel / Status page]
```

### Incident Resolved

```
✅ RESOLVED: [Alert Name]
Status: Resolved
Duration: [X minutes/hours]
Root Cause: [Brief description]
Post-Mortem: [Link - to be created]
```

---

## Related Documentation

- [Rollback Plan](../deployment/rollback-plan.md)
- [Monitoring Architecture](../ARCHITECTURE.md#monitoring)
- [Incident Response](./incident-response.md)
