# Testing Guide for Stapelwerk Deployment

This document describes the testing strategy and available test scripts for verifying the Stapelwerk deployment.

## 🎯 Testing Overview

We have three levels of automated tests for deployment verification:

1. **Smoke Tests** - Quick sanity checks (< 30 seconds)
2. **Integration Tests** - Component interaction verification (1-2 minutes)
3. **End-to-End Tests** - Comprehensive deployment verification (3-5 minutes)

## 🔥 Smoke Tests

**Purpose**: Fast verification that deployment is operational  
**When to run**: After every deployment, before marking deployment as complete  
**Duration**: ~30 seconds  
**Location**: `scripts/smoke-test.sh`

### What it tests:
- ✅ Health endpoint responds with 200 OK
- ✅ Home page is accessible
- ✅ SSL certificate is valid
- ✅ Response time is acceptable (< 3 seconds)

### Usage:

```bash
# Run smoke tests
bash scripts/smoke-test.sh

# With custom URL
APP_URL=https://app.stapelwerk.dev bash scripts/smoke-test.sh
```

### Example Output:

```
🔥 Running smoke tests for Stapelwerk...

Testing health endpoint... ✓
Testing home page... ✓
Testing SSL certificate... ✓
Testing response time... ✓ (0.245s)

✓ All smoke tests passed!
```

## 🔌 Integration Tests

**Purpose**: Verify component integration and communication  
**When to run**: After infrastructure changes or container updates  
**Duration**: 1-2 minutes  
**Location**: `scripts/integration-test.sh`

### What it tests:
- ✅ Container-to-container communication
- ✅ Database operations (read/write)
- ✅ Application database connection (Prisma)
- ✅ Environment variables configuration
- ✅ Volume persistence
- ✅ Network connectivity
- ✅ Container health status
- ✅ Restart policies
- ✅ Port exposure
- ✅ Log collection

### Usage:

```bash
# Run integration tests
bash scripts/integration-test.sh

# With custom Docker host
DOCKER_HOST=gitlab.minilab.live bash scripts/integration-test.sh
```

### Example Output:

```
[INFO] Starting integration tests...

[INFO] Test 1: Testing container-to-container communication...
[PASS] Application container can reach database container

[INFO] Test 2: Testing database operations...
[PASS] Database read operations work
[PASS] Database write operations work

... (additional tests) ...

================================================
All integration tests passed successfully! ✓
================================================
```

## 🚀 End-to-End (E2E) Tests

**Purpose**: Comprehensive verification of entire deployment  
**When to run**: Before production release, after major changes  
**Duration**: 3-5 minutes  
**Location**: `scripts/e2e-test.sh`

### What it tests:

#### Infrastructure Tests:
- ✅ Docker service availability
- ✅ Application container running
- ✅ Database connection

#### Application Tests:
- ✅ Health endpoint
- ✅ Home page accessibility
- ✅ API routes functionality

#### SSL and Security Tests:
- ✅ SSL certificate validity and expiration
- ✅ Security headers presence

#### Network and Performance Tests:
- ✅ WebSocket support configuration
- ✅ Static assets delivery and caching
- ✅ Response time performance

#### Static Pages Tests:
- ✅ GitLab Pages accessibility
- ✅ Documentation pages availability

#### Maintenance Tests:
- ✅ Container logs for errors
- ✅ Database migrations status
- ✅ Backup script existence and permissions
- ✅ Cron job configuration

#### Resource Tests:
- ✅ Disk space availability
- ✅ Container memory usage

### Usage:

```bash
# Run full E2E test suite
bash scripts/e2e-test.sh

# With custom configuration
APP_URL=https://app.stapelwerk.dev \
PAGES_URL=https://sebastian.gitlab.io/stapelwerk \
CONTAINER_NAME=stapelwerk-app \
bash scripts/e2e-test.sh
```

### Example Output:

```
================================================================
  Stapelwerk E2E Deployment Test Suite
================================================================

[INFO] Starting E2E tests at Mon Jan 15 10:30:00 CET 2024

--- Infrastructure Tests ---
[INFO] Testing Docker service availability...
[SUCCESS] ✓ Docker service is running on remote host
[INFO] Testing if application container is running...
[SUCCESS] ✓ Application container is running
[INFO] Testing database connection...
[SUCCESS] ✓ Database is accepting connections

--- Application Tests ---
[INFO] Testing application health endpoint...
[SUCCESS] ✓ Health endpoint returned 200 OK
[INFO] Testing home page accessibility...
[SUCCESS] ✓ Home page returned 200 OK
[INFO] Testing API routes...
[SUCCESS] ✓ API routes are accessible

... (additional test sections) ...

================================================================
  Test Summary
================================================================

[SUCCESS] Tests Passed: 18
✓ All tests passed!
```

## 🔄 CI/CD Integration

All test scripts are designed to be integrated into GitLab CI/CD pipelines.

### Smoke Tests in CI/CD

Add to `.gitlab-ci.yml`:

```yaml
smoke-test:
  stage: test
  script:
    - bash scripts/smoke-test.sh
  only:
    - main
    - develop
  dependencies:
    - deploy
```

### Integration Tests in CI/CD

```yaml
integration-test:
  stage: test
  script:
    - bash scripts/integration-test.sh
  only:
    - main
  dependencies:
    - deploy-docker
```

### E2E Tests in CI/CD

```yaml
e2e-test:
  stage: verify
  script:
    - bash scripts/e2e-test.sh
  only:
    - main
  when: manual  # Run manually for comprehensive verification
  dependencies:
    - deploy-docker
    - deploy-pages
```

## 📊 Test Results Interpretation

### Success Criteria

All tests must pass for deployment to be considered successful:
- Exit code: 0
- No failed tests in output
- All checkmarks (✓) present

### Warnings vs Failures

**Warnings** (⚠): Non-critical issues that should be investigated but don't block deployment:
- Slow response times (> 2s but < 5s)
- Missing optional configurations
- GitLab Pages not deployed (if not yet configured)

**Failures** (✗): Critical issues that must be fixed:
- Health endpoint not responding
- Database connection failures
- Container not running
- SSL certificate invalid or expired

### Common Issues and Solutions

#### Health Endpoint Fails
```bash
# Check container logs
docker logs stapelwerk-app

# Restart container
docker restart stapelwerk-app

# Verify environment variables
docker exec stapelwerk-app env | grep DATABASE_URL
```

#### Database Connection Fails
```bash
# Check database container
docker ps | grep stapelwerk-db

# Test database directly
docker exec stapelwerk-db pg_isready -U stapelwerk

# Verify network
docker network inspect stapelwerk_default
```

#### SSL Certificate Issues
```bash
# Check certificate status
sudo certbot certificates

# Renew if needed
sudo certbot renew --force-renewal

# Reload nginx
sudo systemctl reload nginx
```

## 🔍 Manual Testing Checklist

In addition to automated tests, perform these manual checks:

### Before Deployment:
- [ ] Review changes in merge request
- [ ] Check database migration scripts
- [ ] Verify environment variables are current
- [ ] Ensure backup is recent (< 24 hours)

### After Deployment:
- [ ] Run smoke tests
- [ ] Run integration tests
- [ ] Check application logs for errors
- [ ] Verify new features work as expected
- [ ] Test authentication flows
- [ ] Check database data integrity

### Weekly Checks:
- [ ] Run full E2E test suite
- [ ] Review SSL certificate expiration
- [ ] Check disk space trends
- [ ] Review backup logs
- [ ] Monitor resource usage patterns

## 📈 Performance Benchmarks

Expected performance metrics:

| Metric | Target | Warning | Critical |
|--------|--------|---------|----------|
| Health endpoint response | < 500ms | < 1s | > 2s |
| Home page load time | < 2s | < 3s | > 5s |
| API response time | < 500ms | < 1s | > 2s |
| Database query time | < 100ms | < 500ms | > 1s |
| Memory usage | < 70% | < 80% | > 90% |
| Disk usage | < 70% | < 80% | > 90% |
| CPU usage | < 60% | < 70% | > 80% |

## 🛠️ Troubleshooting Tests

If tests fail:

1. **Check prerequisites**:
   ```bash
   # Verify SSH access
   ssh root@gitlab.minilab.live "echo 'SSH works'"
   
   # Verify Docker access
   ssh root@gitlab.minilab.live "docker ps"
   
   # Verify curl is available
   which curl
   ```

2. **Run tests with verbose output**:
   ```bash
   # Add debug output
   bash -x scripts/e2e-test.sh
   ```

3. **Test components individually**:
   ```bash
   # Test health endpoint directly
   curl -v https://app.stapelwerk.dev/api/health
   
   # Check container status
   ssh root@gitlab.minilab.live "docker ps"
   
   # View container logs
   ssh root@gitlab.minilab.live "docker logs --tail 50 stapelwerk-app"
   ```

4. **Review logs**:
   ```bash
   # Application logs
   docker logs stapelwerk-app
   
   # Database logs
   docker logs stapelwerk-db
   
   # Nginx logs
   sudo tail -f /var/log/nginx/error.log
   ```

## 📝 Adding New Tests

To add new test cases to the E2E suite:

1. Add test function to `scripts/e2e-test.sh`:
   ```bash
   test_new_feature() {
       log_info "Testing new feature..."
       
       # Your test logic here
       
       if [ test_condition ]; then
           test_passed "New feature works"
       else
           test_failed "New feature failed"
           return 1
       fi
   }
   ```

2. Call test in main section:
   ```bash
   main() {
       # ... existing tests ...
       
       echo "--- New Feature Tests ---"
       test_new_feature
       echo ""
       
       # ... rest of tests ...
   }
   ```

3. Document new test in this file

## 📚 Related Documentation

- [Deployment Verification Checklist](./DEPLOYMENT_VERIFICATION.md)
- [Server Setup Guide](./SERVER_SETUP.md)
- [SSL Setup Guide](./SSL_SETUP.md)
- [CI/CD Configuration](../.gitlab-ci.docker.yml)

## 📧 Support

If you encounter issues with tests:
- Email: sebastian@minilab.live
- Check logs: `docker logs stapelwerk-app`
- Review documentation: `docs/` directory
- Emergency rollback: `bash scripts/rollback.sh <TAG>`
