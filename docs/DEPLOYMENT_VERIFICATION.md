# Deployment Verification Checklist

This document provides a comprehensive checklist for verifying the BuildMyStack deployment on GitLab Pages and Docker hosting.

## 🎯 Quick Verification

Run the automated E2E test suite:

```bash
bash scripts/e2e-test.sh
```

## 📋 Manual Verification Checklist

### Pre-Deployment Checks

- [ ] All environment variables are set in GitLab CI/CD settings
- [ ] Docker registry credentials are configured
- [ ] SSH keys are set up for deployment access
- [ ] Server has sufficient resources (disk, memory, CPU)
- [ ] Database is properly configured and accessible
- [ ] SSL certificates are valid and not expiring soon

### Infrastructure Verification

#### Docker Host

```bash
# SSH into the Docker host
ssh root@gitlab.minilab.live

# Verify Docker is running
docker --version
docker ps

# Check available disk space
df -h /opt/buildmystack

# Check memory usage
free -h

# Verify Docker networks
docker network ls
```

#### Database

```bash
# Check PostgreSQL container status
docker ps | grep buildmystack-db

# Test database connection
docker exec buildmystack-db pg_isready -U buildmystack

# Check database version
docker exec buildmystack-db psql -U buildmystack -c "SELECT version();"

# Verify database size
docker exec buildmystack-db psql -U buildmystack -c "SELECT pg_size_pretty(pg_database_size('buildmystack'));"
```

#### Application Container

```bash
# Check container status
docker ps | grep buildmystack-app

# View container logs
docker logs --tail 100 buildmystack-app

# Check container health
docker inspect buildmystack-app | grep -A 10 Health

# View container stats
docker stats --no-stream buildmystack-app
```

### Application Verification

#### Health Endpoints

- [ ] Main health endpoint: https://buildmystack.minilab.live/api/health
  ```bash
  curl https://buildmystack.minilab.live/api/health
  # Expected: {"status": "ok", "timestamp": "..."}
  ```

- [ ] Database health: https://buildmystack.minilab.live/api/health/db
  ```bash
  curl https://buildmystack.minilab.live/api/health/db
  # Expected: {"database": "connected", ...}
  ```

#### Core Functionality

- [ ] Home page loads: https://buildmystack.minilab.live/
- [ ] API routes respond: https://buildmystack.minilab.live/api/status
- [ ] Authentication works (if applicable)
- [ ] Database queries execute successfully
- [ ] File uploads work (if applicable)
- [ ] Real-time features work (WebSockets, etc.)

#### Static Content (GitLab Pages)

- [ ] GitLab Pages site loads: https://sebastian.gitlab.io/build-my-stack/
- [ ] Documentation is accessible: https://sebastian.gitlab.io/build-my-stack/docs/
- [ ] All documentation pages render correctly
- [ ] Navigation between docs pages works
- [ ] Images and assets load properly

### Security Verification

#### SSL/TLS

```bash
# Check SSL certificate
echo | openssl s_client -servername buildmystack.minilab.live -connect buildmystack.minilab.live:443 2>/dev/null | openssl x509 -noout -dates

# Test SSL labs (manual check)
# Visit: https://www.ssllabs.com/ssltest/analyze.html?d=buildmystack.minilab.live
```

- [ ] SSL certificate is valid
- [ ] Certificate not expiring in next 30 days
- [ ] HTTPS redirect from HTTP works
- [ ] SSL/TLS version is modern (TLS 1.2+)

#### Security Headers

```bash
# Check security headers
curl -I https://buildmystack.minilab.live/
```

Verify presence of:
- [ ] X-Frame-Options
- [ ] X-Content-Type-Options
- [ ] X-XSS-Protection
- [ ] Strict-Transport-Security (HSTS)
- [ ] Referrer-Policy

#### Firewall and Access

```bash
# Check firewall rules
sudo ufw status

# Verify only necessary ports are open
sudo ss -tulpn | grep LISTEN
```

- [ ] Only ports 80, 443, 22 are exposed
- [ ] Database port (5432) is not publicly accessible
- [ ] SSH is configured with key-based auth only

### Performance Verification

#### Response Times

```bash
# Test home page response time
curl -w "@curl-format.txt" -o /dev/null -s https://buildmystack.minilab.live/

# Create curl-format.txt:
cat > curl-format.txt << 'EOF'
    time_namelookup:  %{time_namelookup}\n
       time_connect:  %{time_connect}\n
    time_appconnect:  %{time_appconnect}\n
   time_pretransfer:  %{time_pretransfer}\n
      time_redirect:  %{time_redirect}\n
 time_starttransfer:  %{time_starttransfer}\n
                    ----------\n
         time_total:  %{time_total}\n
EOF
```

- [ ] Home page loads in < 2 seconds
- [ ] API responses in < 500ms
- [ ] Database queries complete in < 100ms
- [ ] Static assets cached properly

#### Load Testing (Optional)

```bash
# Simple load test with Apache Bench
ab -n 1000 -c 10 https://buildmystack.minilab.live/

# Or use wrk
wrk -t4 -c100 -d30s https://buildmystack.minilab.live/
```

### Database Verification

#### Migrations

```bash
# Check migration status
docker exec buildmystack-app npx prisma migrate status

# View migration history
docker exec buildmystack-db psql -U buildmystack -c "SELECT * FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 10;"
```

- [ ] All migrations applied successfully
- [ ] No pending migrations
- [ ] Database schema matches application code

#### Backups

```bash
# Check if backups exist
ls -lh /opt/buildmystack/backups/

# Verify latest backup
ls -lht /opt/buildmystack/backups/ | head -5

# Check backup cron job
crontab -l | grep backup-db.sh
```

- [ ] Backup script is executable
- [ ] Cron job is configured (daily at 2 AM)
- [ ] Recent backups exist (< 24 hours old)
- [ ] Backup files are not empty
- [ ] Old backups are being rotated (only 7 days kept)

#### Test Backup Restore (Recommended)

```bash
# Create a test restore (use a test database)
bash /opt/buildmystack/scripts/backup-db.sh
# Follow restore instructions in CRON_SETUP.md
```

### Monitoring and Logging

#### Container Logs

```bash
# View application logs
docker logs -f buildmystack-app

# Search for errors
docker logs buildmystack-app 2>&1 | grep -i error

# Check for warnings
docker logs buildmystack-app 2>&1 | grep -i warning
```

- [ ] No critical errors in logs
- [ ] Application startup successful
- [ ] No memory leaks or crashes

#### System Resources

```bash
# Check CPU usage
top -b -n 1 | head -20

# Check memory
free -h

# Check disk I/O
iostat -x 1 5

# Check network
netstat -i
```

- [ ] CPU usage < 70%
- [ ] Memory usage < 80%
- [ ] Disk usage < 80%
- [ ] No network errors or packet loss

### GitLab CI/CD Verification

#### Pipeline Status

- [ ] Latest pipeline passed all stages
- [ ] Docker image built successfully
- [ ] Tests passed (unit, integration, E2E)
- [ ] Static content generated
- [ ] Deployment to Docker host successful
- [ ] GitLab Pages deployment successful

#### Pipeline Jobs

```bash
# View latest pipeline
# Visit: https://gitlab.com/sebastian/build-my-stack/-/pipelines

# Or use GitLab CLI
glab ci status
glab ci view
```

#### Registry

```bash
# List Docker images in registry
# Visit: https://gitlab.com/sebastian/build-my-stack/container_registry

# Or check locally
docker images | grep buildmystack
```

- [ ] Latest image is tagged with commit SHA
- [ ] Latest image is tagged as `latest`
- [ ] Old images are being cleaned up (retention policy)

### Rollback Verification

#### Test Rollback Process

```bash
# SSH to server
ssh root@gitlab.minilab.live

# List available image versions
docker images | grep buildmystack

# Test rollback to previous version
bash /opt/buildmystack/scripts/rollback.sh <PREVIOUS_TAG>

# Verify application still works
curl https://buildmystack.minilab.live/api/health

# Roll forward to latest
bash /opt/buildmystack/scripts/deploy.sh
```

- [ ] Rollback script executes without errors
- [ ] Application remains accessible during rollback
- [ ] Health checks pass after rollback
- [ ] Can roll forward to latest version

### Documentation Verification

- [ ] All deployment docs are up to date
- [ ] Environment variables are documented
- [ ] Troubleshooting guide is complete
- [ ] Architecture diagrams are current
- [ ] API documentation matches implementation

## 🚨 Troubleshooting Common Issues

### Application Won't Start

```bash
# Check container logs
docker logs buildmystack-app

# Check environment variables
docker exec buildmystack-app env | grep -E 'DATABASE_URL|NEXTAUTH'

# Restart container
docker restart buildmystack-app
```

### Database Connection Issues

```bash
# Test database connectivity
docker exec buildmystack-app ping buildmystack-db

# Check database logs
docker logs buildmystack-db

# Verify database credentials
docker exec buildmystack-db psql -U buildmystack -c "SELECT 1;"
```

### SSL Certificate Issues

```bash
# Check certificate expiry
sudo certbot certificates

# Renew certificate manually
sudo certbot renew --force-renewal

# Reload nginx
sudo systemctl reload nginx
```

### High Memory Usage

```bash
# Check container memory limits
docker inspect buildmystack-app | grep -A 5 Memory

# Restart container to clear memory
docker restart buildmystack-app

# Consider increasing memory limits in docker-compose.yml
```

### Slow Response Times

```bash
# Check database query performance
docker exec buildmystack-db psql -U buildmystack -c "SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;"

# Check nginx access logs
tail -f /var/log/nginx/access.log

# Monitor container resources
docker stats buildmystack-app
```

## 📊 Success Metrics

Deployment is considered successful when:

- ✅ All automated E2E tests pass
- ✅ Application responds with 200 OK on health endpoint
- ✅ Database is accessible and migrations are current
- ✅ SSL certificate is valid and HTTPS is working
- ✅ GitLab Pages static content is accessible
- ✅ No critical errors in logs (last 24 hours)
- ✅ Response times are < 2 seconds for main pages
- ✅ Backups are running and recent backup exists
- ✅ Rollback process has been tested successfully
- ✅ System resources are within acceptable limits

## 📧 Contact and Escalation

If deployment verification fails:

1. Check troubleshooting section above
2. Review recent changes in GitLab
3. Check server logs and monitoring
4. Contact: sebastian@minilab.live
5. Emergency rollback: `bash scripts/rollback.sh <LAST_KNOWN_GOOD_TAG>`

## 📚 Related Documentation

- [Server Setup Guide](./SERVER_SETUP.md)
- [SSL Setup Guide](./SSL_SETUP.md)
- [Cron Setup Guide](./CRON_SETUP.md)
- [Deployment Scripts](../scripts/)
- [GitLab CI/CD Configuration](../.gitlab-ci.docker.yml)
