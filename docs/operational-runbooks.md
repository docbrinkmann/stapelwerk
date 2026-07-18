# BuildMyStack AI-Powered Recommendations - Operational Runbooks

## Table of Contents

1. [Overview](#overview)
2. [Monitoring and Alerting](#monitoring-and-alerting)
3. [Incident Response](#incident-response)
4. [Troubleshooting Guide](#troubleshooting-guide)
5. [Maintenance Procedures](#maintenance-procedures)
6. [Performance Management](#performance-management)
7. [Database Operations](#database-operations)
8. [Security Operations](#security-operations)
9. [Deployment Procedures](#deployment-procedures)
10. [Backup and Recovery](#backup-and-recovery)

## Overview

This document provides comprehensive operational procedures for managing the BuildMyStack AI-Powered Recommendations system in production. These runbooks are designed for SRE teams, DevOps engineers, and on-call engineers.

### System Components Overview
- **Frontend**: Next.js application with real-time updates
- **Backend**: tRPC API with Node.js
- **Database**: PostgreSQL with automated backups
- **Cache**: Redis for sessions and feature flags
- **Infrastructure**: Kubernetes cluster with auto-scaling
- **Monitoring**: Prometheus, Grafana, and custom dashboards

### Key Contacts
- **Primary On-Call**: SRE Team (pager: +1-xxx-xxx-xxxx)
- **Secondary On-Call**: DevOps Team (slack: @devops-oncall)
- **Engineering Lead**: AI/ML Team (slack: @ai-team-lead)
- **Product Owner**: Product Team (email: product@buildmystack.com)

## Monitoring and Alerting

### Primary Monitoring Dashboards

#### 1. System Health Dashboard
**URL**: `https://grafana.buildmystack.com/d/system-health`
**Refresh Interval**: 30 seconds

**Key Metrics**:
- API Response Times (P95, P99)
- Database Connection Pool Status
- Redis Connectivity
- Kubernetes Pod Health
- Memory and CPU Usage

#### 2. AI Recommendations Dashboard
**URL**: `https://grafana.buildmystack.com/d/ai-recommendations`
**Refresh Interval**: 1 minute

**Key Metrics**:
- Recommendation Generation Rate
- ML Model Accuracy Scores
- Feature Flag Rollout Status
- User Engagement Metrics
- Cache Hit Ratios

#### 3. Business Metrics Dashboard
**URL**: `https://grafana.buildmystack.com/d/business-metrics`
**Refresh Interval**: 5 minutes

**Key Metrics**:
- Daily/Weekly/Monthly Active Users
- Template Usage Statistics
- Stack Creation Rates
- User Feedback Scores

### Alert Definitions

#### Critical Alerts (P0 - Immediate Response Required)

##### Application Down Alert
```yaml
Alert Name: application-down
Severity: P0 - Critical
Trigger: HTTP health check failing for > 2 minutes
Response Time: < 5 minutes
Escalation: Auto-page primary on-call

Runbook Steps:
1. Check application pods status: `kubectl get pods -n buildmystack-prod`
2. Check recent deployments: `kubectl rollout history deployment/buildmystack-app -n buildmystack-prod`
3. Check logs: `kubectl logs -n buildmystack-prod deployment/buildmystack-app --tail=100`
4. If deployment issue, rollback: `kubectl rollout undo deployment/buildmystack-app -n buildmystack-prod`
5. Monitor recovery and update incident channel
```

##### Database Connection Failure
```yaml
Alert Name: database-connection-failure
Severity: P0 - Critical
Trigger: Database connection pool exhausted or connection failures > 50%
Response Time: < 5 minutes
Escalation: Auto-page primary on-call + DBA

Runbook Steps:
1. Check database status: `kubectl get pods -n buildmystack-prod -l app=postgres`
2. Check connection pool metrics in Grafana dashboard
3. Review database logs: `kubectl logs -n buildmystack-prod -l app=postgres --tail=200`
4. Check for long-running queries: Connect to DB and run monitoring queries
5. Scale application pods if needed: `kubectl scale deployment buildmystack-app --replicas=5 -n buildmystack-prod`
6. Contact DBA if database-level intervention required
```

##### High Error Rate Alert
```yaml
Alert Name: high-error-rate
Severity: P0 - Critical
Trigger: HTTP 5xx error rate > 5% for > 5 minutes
Response Time: < 10 minutes
Escalation: Auto-page primary on-call

Runbook Steps:
1. Check error logs: `kubectl logs -n buildmystack-prod deployment/buildmystack-app --tail=200 | grep ERROR`
2. Check recent deployments and feature flag changes
3. Review API endpoint performance in Grafana
4. Check external service dependencies (Redis, ML service)
5. Consider feature flag rollback if related to new features
6. Escalate to engineering team if code issue identified
```

#### Warning Alerts (P1 - Response Within 30 Minutes)

##### High Response Time Alert
```yaml
Alert Name: high-response-time
Severity: P1 - Warning
Trigger: API P95 response time > 2 seconds for > 10 minutes
Response Time: < 30 minutes

Runbook Steps:
1. Check application performance metrics
2. Review database slow query logs
3. Check Redis cache hit rates
4. Monitor CPU/memory usage across pods
5. Consider scaling if resource-constrained
6. Review recent code changes if performance degradation identified
```

##### Low Cache Hit Rate Alert
```yaml
Alert Name: low-cache-hit-rate
Severity: P1 - Warning
Trigger: Redis cache hit rate < 80% for > 15 minutes
Response Time: < 30 minutes

Runbook Steps:
1. Check Redis health: `kubectl get pods -n buildmystack-prod -l app=redis`
2. Review cache metrics in monitoring dashboard
3. Check for cache evictions or memory pressure
4. Review recent code changes affecting caching strategy
5. Consider cache warm-up if needed
```

### Alert Response Procedures

#### Incident Communication Protocol
1. **Acknowledge Alert**: Within 5 minutes of receiving P0 alerts
2. **Create Incident**: Use incident management tool to track progress
3. **Communicate Status**: Update #incidents Slack channel every 15 minutes during active incidents
4. **Escalate**: Follow escalation matrix if unable to resolve within SLA

#### Escalation Matrix
- **L1**: Primary On-Call Engineer (0-30 minutes)
- **L2**: Secondary On-Call + Engineering Team Lead (30-60 minutes)
- **L3**: Engineering Manager + Product Owner (60+ minutes)
- **L4**: VP Engineering + CTO (Critical business impact)

## Incident Response

### Incident Classification

#### Severity Levels
- **P0 (Critical)**: Complete service outage, data loss, security breach
- **P1 (High)**: Significant feature degradation, performance issues affecting users
- **P2 (Medium)**: Minor feature issues, non-critical bugs
- **P3 (Low)**: Cosmetic issues, enhancement requests

#### Response Times
- **P0**: 5 minutes acknowledgment, 30 minutes initial response
- **P1**: 30 minutes acknowledgment, 2 hours initial response
- **P2**: 4 hours acknowledgment, 24 hours initial response
- **P3**: 24 hours acknowledgment, best effort response

### Incident Response Playbook

#### Phase 1: Detection and Triage (0-15 minutes)
1. **Alert Acknowledgment**
   ```bash
   # Acknowledge alert in monitoring system
   # Join incident Slack channel: #incident-YYYY-MM-DD-HHHMM
   # Page additional team members if needed
   ```

2. **Initial Assessment**
   ```bash
   # Check system status
   curl -I https://buildmystack.com/api/health
   
   # Check Kubernetes cluster health
   kubectl get nodes
   kubectl get pods -n buildmystack-prod
   
   # Check monitoring dashboards
   # - System Health: Critical metrics overview
   # - Error Rates: Recent error trends
   # - Performance: Response time trends
   ```

3. **Impact Assessment**
   - Determine user impact scope
   - Check if issue is customer-facing
   - Estimate affected user percentage
   - Assess business impact

#### Phase 2: Investigation and Containment (15-60 minutes)
1. **Deep Dive Investigation**
   ```bash
   # Check application logs
   kubectl logs -n buildmystack-prod deployment/buildmystack-app --tail=500
   
   # Check recent deployments
   kubectl rollout history deployment/buildmystack-app -n buildmystack-prod
   
   # Check resource usage
   kubectl top nodes
   kubectl top pods -n buildmystack-prod
   
   # Check database health
   psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"
   
   # Check Redis health
   redis-cli -u $REDIS_URL ping
   ```

2. **Immediate Containment Actions**
   ```bash
   # If deployment-related, rollback
   kubectl rollout undo deployment/buildmystack-app -n buildmystack-prod
   
   # If feature flag related, disable problematic features
   redis-cli -u $REDIS_URL SET feature:problematic_feature:percentage 0
   
   # If resource exhaustion, scale up
   kubectl scale deployment buildmystack-app --replicas=6 -n buildmystack-prod
   
   # If external dependency issue, enable graceful degradation
   # Update feature flags to bypass failing services
   ```

#### Phase 3: Resolution and Recovery (60+ minutes)
1. **Root Cause Analysis**
   - Identify primary cause of incident
   - Document timeline of events
   - Gather evidence (logs, metrics, traces)
   - Confirm fix addresses root cause

2. **Implement Fix**
   ```bash
   # Deploy hotfix if code change required
   git checkout hotfix/incident-fix
   # Test and deploy following emergency deployment procedures
   
   # Or implement configuration fix
   kubectl patch configmap app-config -n buildmystack-prod --patch='{"data":{"key":"value"}}'
   kubectl rollout restart deployment/buildmystack-app -n buildmystack-prod
   ```

3. **Verify Resolution**
   ```bash
   # Check health endpoints
   curl -s https://buildmystack.com/api/health | jq .
   
   # Monitor key metrics for 15+ minutes
   # Verify user-facing functionality
   # Check error rates return to baseline
   ```

#### Phase 4: Post-Incident Activities
1. **Incident Close-out**
   - Update incident tracker with resolution
   - Notify stakeholders of resolution
   - Document lessons learned
   - Schedule post-mortem if P0/P1 incident

2. **Post-Mortem Process** (For P0/P1 incidents)
   - Schedule within 48 hours of resolution
   - Include timeline, root cause, contributing factors
   - Identify action items with owners and due dates
   - Focus on preventing similar incidents

## Troubleshooting Guide

### Common Issues and Solutions

#### Application Issues

##### Issue: High Memory Usage
**Symptoms**: Pods being killed by OOMKiller, slow response times
**Investigation**:
```bash
# Check pod memory usage
kubectl top pods -n buildmystack-prod

# Check pod resource limits
kubectl describe pod <pod-name> -n buildmystack-prod

# Check for memory leaks in application logs
kubectl logs -n buildmystack-prod <pod-name> | grep -i "memory\|heap\|oom"
```
**Resolution**:
```bash
# Immediate: Restart problematic pods
kubectl delete pod <pod-name> -n buildmystack-prod

# Short-term: Increase memory limits
kubectl patch deployment buildmystack-app -n buildmystack-prod \
  -p '{"spec":{"template":{"spec":{"containers":[{"name":"app","resources":{"limits":{"memory":"1Gi"}}}]}}}}'

# Long-term: Investigate and fix memory leaks in code
```

##### Issue: Database Connection Pool Exhausted
**Symptoms**: Connection timeout errors, "too many connections" errors
**Investigation**:
```bash
# Check current connections
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"

# Check connection pool configuration
psql $DATABASE_URL -c "SHOW max_connections;"

# Check for idle connections
psql $DATABASE_URL -c "SELECT state, count(*) FROM pg_stat_activity GROUP BY state;"
```
**Resolution**:
```bash
# Immediate: Kill idle connections if safe
psql $DATABASE_URL -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle' AND query_start < NOW() - INTERVAL '30 minutes';"

# Tune connection pool settings in application
# Update Prisma connection pool settings
# Scale down application replicas temporarily if needed
```

#### Infrastructure Issues

##### Issue: Kubernetes Node Not Ready
**Symptoms**: Pods stuck in Pending state, scheduling failures
**Investigation**:
```bash
# Check node status
kubectl get nodes

# Describe problematic node
kubectl describe node <node-name>

# Check node resource usage
kubectl top node <node-name>
```
**Resolution**:
```bash
# Cordon node to prevent new pods
kubectl cordon <node-name>

# Drain node safely
kubectl drain <node-name> --ignore-daemonsets --delete-emptydir-data

# Check cloud provider for node issues
# Replace node if hardware issues detected

# Uncordon node once fixed
kubectl uncordon <node-name>
```

##### Issue: Persistent Volume Issues
**Symptoms**: Pods stuck in ContainerCreating, volume mount failures
**Investigation**:
```bash
# Check PV status
kubectl get pv

# Check PVC status
kubectl get pvc -n buildmystack-prod

# Describe problematic PVC
kubectl describe pvc <pvc-name> -n buildmystack-prod
```
**Resolution**:
```bash
# Check cloud provider storage service
# Verify storage class configuration
# Recreate PVC if corrupted (ensure data backup first)

# If using dynamic provisioning, check storage class
kubectl get storageclass
```

### Performance Troubleshooting

#### Slow API Response Times
**Investigation Checklist**:
1. Check current load and traffic patterns
2. Review database query performance
3. Analyze cache hit rates
4. Check external service dependencies
5. Review recent code deployments

**Diagnostic Commands**:
```bash
# Check API response times
curl -w "@curl-format.txt" -o /dev/null -s https://buildmystack.com/api/health

# Check database slow queries
psql $DATABASE_URL -c "SELECT query, mean_time, calls FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"

# Check Redis performance
redis-cli -u $REDIS_URL --latency-history -i 1

# Check application performance metrics
kubectl logs -n buildmystack-prod deployment/buildmystack-app | grep "SLOW_QUERY\|PERFORMANCE"
```

#### High CPU Usage
**Investigation Steps**:
```bash
# Check pod CPU usage
kubectl top pods -n buildmystack-prod

# Check node CPU usage
kubectl top nodes

# Profile application if needed
# Use debugging endpoints or profiling tools

# Check for CPU-intensive operations in logs
kubectl logs -n buildmystack-prod deployment/buildmystack-app | grep -i "cpu\|performance\|slow"
```

### Network Troubleshooting

#### DNS Resolution Issues
```bash
# Test DNS resolution from pod
kubectl exec -it <pod-name> -n buildmystack-prod -- nslookup google.com

# Check kube-dns status
kubectl get pods -n kube-system -l k8s-app=kube-dns

# Check CoreDNS logs
kubectl logs -n kube-system -l k8s-app=kube-dns
```

#### Service Connectivity Issues
```bash
# Check service endpoints
kubectl get endpoints -n buildmystack-prod

# Test service connectivity
kubectl exec -it <pod-name> -n buildmystack-prod -- nc -zv <service-name> <port>

# Check network policies
kubectl get networkpolicies -n buildmystack-prod
```

## Maintenance Procedures

### Regular Maintenance Tasks

#### Daily Tasks (Automated)
1. **System Health Checks**
   - Automated health check validation
   - Log rotation and cleanup
   - Certificate expiry monitoring
   - Backup verification

2. **Performance Monitoring**
   - Response time trend analysis
   - Resource utilization review
   - Cache performance optimization
   - Database query performance review

#### Weekly Tasks (Manual/Automated)
1. **Security Updates**
   ```bash
   # Check for security updates
   kubectl get nodes -o wide
   
   # Review vulnerability scans
   trivy image buildmystack:latest
   
   # Update base images if needed
   # Follow deployment procedures for updates
   ```

2. **Capacity Planning Review**
   ```bash
   # Check resource usage trends
   kubectl top nodes
   kubectl top pods -n buildmystack-prod
   
   # Review auto-scaling metrics
   kubectl get hpa -n buildmystack-prod
   
   # Plan for capacity increases if needed
   ```

3. **Backup Verification**
   ```bash
   # Verify database backups
   ./scripts/db-backup-restore.sh test-restore
   
   # Check backup retention policies
   # Test disaster recovery procedures quarterly
   ```

#### Monthly Tasks
1. **Dependency Updates**
   - Review and update NPM dependencies
   - Update Docker base images
   - Review Kubernetes cluster updates
   - Security patch management

2. **Performance Optimization**
   - Database maintenance and optimization
   - Cache strategy review
   - CDN configuration optimization
   - API endpoint performance analysis

3. **Documentation Updates**
   - Update runbooks based on incidents
   - Review and update monitoring alerts
   - Update contact information
   - Review and update procedures

### Planned Maintenance Windows

#### Maintenance Window Schedule
- **Standard Maintenance**: Sundays 2:00-4:00 AM UTC
- **Emergency Maintenance**: As needed with advance notice
- **Major Updates**: Scheduled with business stakeholders

#### Pre-Maintenance Checklist
```bash
# 1. Notify stakeholders
# Send maintenance notification 72 hours in advance

# 2. Prepare maintenance plan
# Document all changes and rollback procedures
# Test changes in staging environment

# 3. Prepare monitoring
# Set up additional monitoring during maintenance
# Prepare rollback procedures

# 4. Coordinate with teams
# Ensure on-call engineer available
# Coordinate with dependent teams
```

#### During Maintenance Procedure
```bash
# 1. Start maintenance window
echo "Maintenance started: $(date)" >> maintenance.log

# 2. Enable maintenance mode (if applicable)
kubectl patch configmap app-config -n buildmystack-prod \
  --patch='{"data":{"maintenance_mode":"true"}}'

# 3. Perform maintenance tasks
# Follow planned procedures with logging

# 4. Verify changes
# Run health checks and functional tests

# 5. Disable maintenance mode
kubectl patch configmap app-config -n buildmystack-prod \
  --patch='{"data":{"maintenance_mode":"false"}}'

# 6. Monitor post-maintenance
# Watch metrics for 30 minutes after completion
echo "Maintenance completed: $(date)" >> maintenance.log
```

#### Post-Maintenance Checklist
- Verify all systems operational
- Check monitoring dashboards
- Review maintenance logs
- Update documentation if procedures changed
- Conduct retrospective for improvements

## Performance Management

### Performance Monitoring Strategy

#### Key Performance Indicators (KPIs)
1. **User Experience Metrics**
   - API response time (P50, P95, P99)
   - Time to first recommendation
   - Page load times
   - Real-time update latency

2. **System Performance Metrics**
   - Throughput (requests per second)
   - Error rates by endpoint
   - Database query performance
   - Cache hit ratios

3. **Infrastructure Metrics**
   - CPU and memory utilization
   - Network I/O
   - Disk utilization
   - Pod restarts and failures

#### Performance Baselines
```yaml
API Response Time Targets:
  - P50: < 200ms
  - P95: < 500ms
  - P99: < 1000ms

Database Query Performance:
  - Average query time: < 50ms
  - Slow query threshold: > 1000ms
  - Connection pool utilization: < 80%

Cache Performance:
  - Hit ratio: > 90%
  - Average response time: < 10ms

System Resources:
  - CPU utilization: < 70%
  - Memory utilization: < 80%
  - Disk utilization: < 85%
```

### Performance Optimization Procedures

#### Database Performance Tuning
```sql
-- Monitor slow queries
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 20;

-- Check index usage
SELECT 
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation
FROM pg_stats 
WHERE schemaname = 'public'
ORDER BY n_distinct DESC;

-- Analyze query plans for optimization
EXPLAIN ANALYZE SELECT * FROM recommendations WHERE user_id = 'uuid';
```

#### Cache Optimization
```bash
# Monitor cache hit rates
redis-cli -u $REDIS_URL info stats | grep hit

# Check cache memory usage
redis-cli -u $REDIS_URL info memory

# Analyze cache key patterns
redis-cli -u $REDIS_URL --scan --pattern "*" | head -20

# Optimize cache strategies based on usage patterns
```

#### Application Performance Tuning
```javascript
// Enable application performance monitoring
const performanceMonitor = new PerformanceMonitor();

// Optimize database queries with indexing
await prisma.recommendations.findMany({
  where: { userId },
  include: { user: true },
  // Use indexed columns for filtering
});

// Implement caching for expensive operations
const recommendations = await cacheManager.get(`recommendations:${userId}`);
if (!recommendations) {
  // Generate and cache recommendations
}

// Use connection pooling for external services
const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 50
});
```

### Capacity Planning

#### Capacity Monitoring
```bash
# Check current resource usage trends
kubectl top nodes --sort-by=cpu
kubectl top pods -n buildmystack-prod --sort-by=cpu

# Monitor auto-scaling metrics
kubectl get hpa -n buildmystack-prod -o wide

# Check persistent volume usage
df -h /data/postgres
```

#### Scaling Procedures
```bash
# Scale application horizontally
kubectl scale deployment buildmystack-app --replicas=5 -n buildmystack-prod

# Scale vertically (increase resources)
kubectl patch deployment buildmystack-app -n buildmystack-prod \
  -p '{"spec":{"template":{"spec":{"containers":[{"name":"app","resources":{"limits":{"memory":"2Gi","cpu":"1000m"}}}]}}}}'

# Scale database (if using cloud provider)
# Follow cloud provider procedures for database scaling

# Add nodes to cluster if needed
# Follow cloud provider procedures for node scaling
```

## Database Operations

### Database Maintenance

#### Routine Maintenance Tasks
```sql
-- Vacuum and analyze tables (weekly)
VACUUM ANALYZE;

-- Update table statistics
ANALYZE;

-- Check table bloat
SELECT 
  schemaname, 
  tablename, 
  n_dead_tup, 
  n_live_tup,
  round(n_dead_tup::float / n_live_tup::float * 100, 2) as dead_percentage
FROM pg_stat_user_tables 
WHERE n_live_tup > 0 
ORDER BY dead_percentage DESC;

-- Reindex if necessary
REINDEX INDEX CONCURRENTLY idx_name;
```

#### Performance Monitoring
```sql
-- Monitor connection usage
SELECT 
  state, 
  count(*) 
FROM pg_stat_activity 
GROUP BY state;

-- Check lock contention
SELECT 
  blocked_locks.pid AS blocked_pid,
  blocked_activity.usename AS blocked_user,
  blocking_locks.pid AS blocking_pid,
  blocking_activity.usename AS blocking_user,
  blocked_activity.query AS blocked_statement,
  blocking_activity.query AS current_statement_in_blocking_process
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.GRANTED;
```

#### Database Schema Migrations
```bash
# Pre-migration checklist
# 1. Backup database
./scripts/db-backup-restore.sh backup production

# 2. Test migration in staging
npm run migrate:staging

# 3. Plan rollback procedure
# Document rollback steps

# Execute migration
npm run migrate:production

# Post-migration verification
npm run migrate:verify

# Monitor performance after migration
# Check for any degradation in query performance
```

### Database Backup and Recovery

#### Automated Backup Procedures
```bash
# Daily automated backups (cron job)
0 2 * * * /opt/scripts/db-backup-restore.sh backup production

# Weekly full backups
0 1 * * 0 /opt/scripts/db-backup-restore.sh full-backup production

# Monthly archival backups
0 0 1 * * /opt/scripts/db-backup-restore.sh archive production
```

#### Backup Verification
```bash
# Test backup integrity weekly
/opt/scripts/db-backup-restore.sh verify-backup latest

# Test restore procedure monthly
/opt/scripts/db-backup-restore.sh test-restore staging

# Check backup storage usage
du -sh /data/backups/
```

#### Disaster Recovery Procedures
```bash
# Point-in-time recovery
# 1. Stop application
kubectl scale deployment buildmystack-app --replicas=0 -n buildmystack-prod

# 2. Restore from backup
./scripts/db-backup-restore.sh restore <backup-timestamp>

# 3. Verify data integrity
./scripts/db-backup-restore.sh verify

# 4. Restart application
kubectl scale deployment buildmystack-app --replicas=3 -n buildmystack-prod

# 5. Verify application functionality
curl -s https://buildmystack.com/api/health
```

## Security Operations

### Security Monitoring

#### Daily Security Checks
```bash
# Check for failed authentication attempts
kubectl logs -n buildmystack-prod deployment/buildmystack-app | grep "AUTH_FAILED"

# Monitor for suspicious activity patterns
kubectl logs -n buildmystack-prod deployment/buildmystack-app | grep "RATE_LIMIT_EXCEEDED"

# Check SSL certificate expiry
echo | openssl s_client -servername buildmystack.com -connect buildmystack.com:443 2>/dev/null | openssl x509 -noout -dates
```

#### Security Incident Response
```bash
# If security incident detected:
# 1. Isolate affected systems
kubectl cordon <affected-node>

# 2. Preserve evidence
kubectl logs -n buildmystack-prod deployment/buildmystack-app > incident-logs-$(date +%Y%m%d-%H%M%S).log

# 3. Block malicious IPs at ingress level
kubectl patch ingress buildmystack-ingress -n buildmystack-prod --patch='...'

# 4. Notify security team immediately
# Follow security incident escalation procedures
```

### Access Control Management

#### User Access Review (Monthly)
```bash
# Review kubectl access
kubectl auth can-i --list --as=user@company.com

# Review application access logs
kubectl logs -n buildmystack-prod deployment/buildmystack-app | grep "USER_LOGIN"

# Review database access
psql $DATABASE_URL -c "SELECT usename, usesuper FROM pg_user;"
```

#### Secret Management
```bash
# Rotate secrets quarterly
# 1. Generate new secrets
openssl rand -base64 32 > new-secret.txt

# 2. Update Kubernetes secrets
kubectl create secret generic app-secrets-new \
  --from-literal=database-password="$(cat new-secret.txt)" \
  -n buildmystack-prod

# 3. Update application configuration
kubectl patch deployment buildmystack-app -n buildmystack-prod --patch='...'

# 4. Verify functionality
curl -s https://buildmystack.com/api/health

# 5. Remove old secrets
kubectl delete secret app-secrets-old -n buildmystack-prod
```

## Deployment Procedures

### Standard Deployment Process

#### Pre-Deployment Checklist
```bash
# 1. Verify staging deployment successful
curl -s https://staging.buildmystack.com/api/health

# 2. Run automated tests
npm run test:production

# 3. Review deployment diff
git diff HEAD~1..HEAD

# 4. Check for database migrations
npm run migrate:check

# 5. Notify stakeholders
# Send deployment notification to #deployments channel
```

#### Deployment Execution
```bash
# 1. Tag release
git tag -a v1.2.3 -m "Production release v1.2.3"
git push origin v1.2.3

# 2. Build and push image
docker build -t buildmystack:v1.2.3 .
docker push buildmystack:v1.2.3

# 3. Update Kubernetes deployment
kubectl set image deployment/buildmystack-app app=buildmystack:v1.2.3 -n buildmystack-prod

# 4. Monitor rollout
kubectl rollout status deployment/buildmystack-app -n buildmystack-prod

# 5. Verify deployment
curl -s https://buildmystack.com/api/health
./scripts/deployment-smoke-tests.sh
```

#### Post-Deployment Monitoring
```bash
# Monitor for 30 minutes post-deployment
# 1. Check error rates
# 2. Monitor response times
# 3. Verify feature functionality
# 4. Check business metrics
```

### Emergency Deployment (Hotfix)

#### Hotfix Process
```bash
# 1. Create hotfix branch
git checkout -b hotfix/critical-fix main

# 2. Apply minimal fix
# Make only necessary changes

# 3. Test hotfix
npm run test
./scripts/run-smoke-tests.sh

# 4. Deploy to staging first
kubectl set image deployment/buildmystack-app app=buildmystack:hotfix-123 -n buildmystack-staging

# 5. Verify staging works
curl -s https://staging.buildmystack.com/api/health

# 6. Deploy to production
kubectl set image deployment/buildmystack-app app=buildmystack:hotfix-123 -n buildmystack-prod

# 7. Monitor closely
# Watch metrics for 1+ hour
```

#### Rollback Procedures
```bash
# If deployment fails or causes issues:
# 1. Immediate rollback
kubectl rollout undo deployment/buildmystack-app -n buildmystack-prod

# 2. Verify rollback success
kubectl rollout status deployment/buildmystack-app -n buildmystack-prod
curl -s https://buildmystack.com/api/health

# 3. Check specific version rollback if needed
kubectl rollout undo deployment/buildmystack-app --to-revision=2 -n buildmystack-prod
```

## Backup and Recovery

### Backup Strategy

#### Backup Types and Schedule
1. **Application Data Backups**
   - Database: Full backup daily, incremental every 6 hours
   - Redis: Snapshot every 4 hours
   - Configuration: Daily backup of Kubernetes manifests

2. **Infrastructure Backups**
   - Kubernetes cluster configuration: Weekly
   - SSL certificates and secrets: Weekly
   - Monitoring configuration: Weekly

#### Backup Procedures
```bash
# Database backup
./scripts/db-backup-restore.sh backup production

# Redis backup
redis-cli -u $REDIS_URL bgsave

# Configuration backup
kubectl get all -n buildmystack-prod -o yaml > backup-$(date +%Y%m%d).yaml

# Upload to backup storage
aws s3 cp backup-$(date +%Y%m%d).yaml s3://buildmystack-backups/configs/
```

### Disaster Recovery

#### Recovery Time Objectives (RTO)
- **Critical Data Loss**: RTO 4 hours
- **Complete System Failure**: RTO 8 hours
- **Partial Service Degradation**: RTO 2 hours

#### Recovery Point Objectives (RPO)
- **Database**: RPO 15 minutes
- **User Sessions**: RPO 1 hour
- **Configuration**: RPO 24 hours

#### Disaster Recovery Procedures

##### Complete System Recovery
```bash
# 1. Assess damage scope
# Determine what systems need recovery

# 2. Provision new infrastructure if needed
# Use infrastructure-as-code to rebuild

# 3. Restore databases
./scripts/db-backup-restore.sh restore latest

# 4. Restore Redis data
redis-cli -u $REDIS_URL_NEW flushall
redis-cli -u $REDIS_URL_NEW --rdb /path/to/backup.rdb

# 5. Deploy applications
kubectl apply -f backup-configs/

# 6. Verify functionality
./scripts/disaster-recovery-tests.sh

# 7. Update DNS if needed
# Point traffic to new infrastructure

# 8. Monitor recovery
# Watch all metrics closely for 24+ hours
```

##### Database-Only Recovery
```bash
# 1. Stop application to prevent data corruption
kubectl scale deployment buildmystack-app --replicas=0 -n buildmystack-prod

# 2. Restore database
./scripts/db-backup-restore.sh restore <specific-backup-timestamp>

# 3. Verify data integrity
./scripts/db-backup-restore.sh verify

# 4. Restart application
kubectl scale deployment buildmystack-app --replicas=3 -n buildmystack-prod

# 5. Run application health checks
./scripts/run-smoke-tests.sh

# 6. Monitor for data consistency issues
```

### Business Continuity

#### Communication Plan
1. **Internal Communication**
   - Engineering team via Slack (#incidents)
   - Management via email and phone
   - Regular status updates every 30 minutes during outages

2. **External Communication**
   - Customer notification via status page
   - Social media updates if widespread impact
   - Support team briefings for customer inquiries

#### Recovery Validation
```bash
# Post-recovery validation checklist
# 1. All services health checks pass
curl -s https://buildmystack.com/api/health | jq .status

# 2. Critical user flows work
./scripts/user-flow-tests.sh

# 3. Data integrity verified
./scripts/data-integrity-checks.sh

# 4. Performance within acceptable ranges
# Check Grafana dashboards for 2+ hours

# 5. All monitoring and alerting functional
# Test alert notifications
```

---

This operational runbook provides comprehensive procedures for managing the BuildMyStack AI-Powered Recommendations system. Regular review and updates of these procedures ensure effective incident response and system maintenance.

For questions or updates to these procedures, contact the SRE team at sre@buildmystack.com.