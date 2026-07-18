# Local Docker Testing Guide

## 🎯 Goal
Test the complete Docker setup locally before deploying to production.

---

## ✅ Pre-requisites

- [x] Docker Desktop installed
- [x] Docker Desktop running (check menu bar for whale icon)
- [ ] Wait until Docker shows "Engine running" status

---

## 📋 Testing Checklist

### Phase 1: Build Docker Image (3-5 minutes)
```bash
# Build the production Docker image
docker build -t build-my-stack:test .

# Expected output: "Successfully built..." and "Successfully tagged..."
```

**Verify the build:**
```bash
# Check image was created
docker images | grep build-my-stack

# Check image size (should be ~200MB)
docker images build-my-stack:test --format "{{.Size}}"
```

---

### Phase 2: Test with Local Environment (2 minutes)

**Create local test environment:**
```bash
# Copy example to local test file
cp .env.example .env.local

# Generate test secrets
echo "NEXTAUTH_SECRET=$(openssl rand -base64 32)" >> .env.local
echo "DATABASE_URL=postgresql://postgres:postgres@localhost:5432/buildmystack_test" >> .env.local
```

---

### Phase 3: Run with Docker Compose (5 minutes)

**Start the services:**
```bash
# Start PostgreSQL and app containers
docker compose -f docker-compose.yml up -d

# Watch the logs
docker compose logs -f app
```

**What to look for in logs:**
- ✅ "Server listening on port 3000"
- ✅ "Database connection successful"
- ✅ No error messages

---

### Phase 4: Verify Health Checks (1 minute)

**Test the health endpoint:**
```bash
# Wait 15 seconds for app to start, then:
sleep 15

# Check health endpoint
curl http://localhost:3000/api/health

# Expected response:
# {"status":"ok","timestamp":"2025-...","database":"connected"}
```

**Check Docker health status:**
```bash
# Should show "healthy" status
docker compose ps

# Check specific health status
docker inspect --format='{{.State.Health.Status}}' $(docker ps -q -f name=build-my-stack)
```

---

### Phase 5: Test Application Endpoints (2 minutes)

**Test homepage:**
```bash
curl -I http://localhost:3000

# Expected: HTTP/1.1 200 OK
```

**Test in browser:**
```bash
# Open in your default browser
open http://localhost:3000
```

**What to verify:**
- [ ] Homepage loads correctly
- [ ] No JavaScript errors in console (F12)
- [ ] Styling loads properly
- [ ] Navigation works

---

### Phase 6: Test Database Connection (1 minute)

**Verify PostgreSQL is accessible:**
```bash
# Connect to PostgreSQL container
docker compose exec postgres psql -U postgres -d buildmystack_test -c "SELECT version();"

# Run Prisma migrations
docker compose exec app npx prisma migrate deploy

# Check tables were created
docker compose exec postgres psql -U postgres -d buildmystack_test -c "\dt"
```

---

### Phase 7: Test Container Restart (1 minute)

**Verify container restarts correctly:**
```bash
# Stop the app
docker compose stop app

# Start it again
docker compose start app

# Wait and verify health
sleep 15
curl http://localhost:3000/api/health
```

---

### Phase 8: Test Rollback Scenario (1 minute)

**Simulate a rollback:**
```bash
# Build another version
docker build -t build-my-stack:test-v2 .

# Stop current container
docker compose down app

# Start with old version
docker compose up -d app

# Verify it works
curl http://localhost:3000/api/health
```

---

## 🧹 Cleanup

**When testing is complete:**
```bash
# Stop all containers
docker compose down

# Remove test volumes (optional)
docker compose down -v

# Remove test images (optional)
docker rmi build-my-stack:test build-my-stack:test-v2
```

---

## 🐛 Troubleshooting

### Issue: "Cannot connect to Docker daemon"
```bash
# Check Docker is running
docker info

# Start Docker Desktop
open -a Docker

# Wait 30 seconds, then retry
```

### Issue: "Port 3000 already in use"
```bash
# Find what's using port 3000
lsof -ti:3000

# Kill the process (if safe)
kill -9 $(lsof -ti:3000)

# Or change the port in docker-compose.yml
```

### Issue: "Build fails with out of memory"
```bash
# Increase Docker memory in Docker Desktop:
# Settings → Resources → Memory → Increase to 4GB+
```

### Issue: Health check failing
```bash
# Check app logs for errors
docker compose logs app

# Check if database is ready
docker compose logs postgres

# Manually test health endpoint inside container
docker compose exec app curl http://localhost:3000/api/health
```

### Issue: Database connection fails
```bash
# Verify PostgreSQL is running
docker compose ps postgres

# Check PostgreSQL logs
docker compose logs postgres

# Verify DATABASE_URL format
docker compose exec app printenv DATABASE_URL
```

---

## ✅ Success Criteria

Your local test is successful when:

- [x] Docker image builds without errors (~200MB)
- [x] App container starts and shows "healthy" status
- [x] Health endpoint returns `{"status":"ok"}`
- [x] PostgreSQL database is accessible
- [x] Prisma migrations run successfully
- [x] Homepage loads in browser
- [x] Container survives restart
- [x] No errors in Docker logs

---

## 📊 Performance Benchmarks

**Expected local performance:**
- Build time: 3-5 minutes (first build), <1 minute (cached)
- Container startup: 10-15 seconds
- Health check response: <100ms
- Page load time: <1 second

---

## 🚀 Next Steps

Once local testing passes:

1. **Review test results** - Ensure all checks passed
2. **Set up production environment** - Run `./scripts/setup-production-env.sh`
3. **Configure GitLab CI/CD** - Add variables to GitLab
4. **Deploy to production** - Push to main branch

---

## 📝 Notes

- Local testing uses `docker-compose.yml` (development)
- Production uses `docker-compose.prod.yml` (different config)
- Local environment typically uses SQLite for faster testing
- Production uses PostgreSQL 18

**Remember:** Local success means Docker setup is correct, but you still need to:
- Generate production secrets
- Set up GitLab CI/CD variables
- Configure production server
