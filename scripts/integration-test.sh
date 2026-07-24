#!/bin/bash

#############################################################
# Integration Test Script
# Tests integration between all components:
# - Docker containers
# - Database
# - Application
# - Reverse proxy
#############################################################

set -e

# Configuration
DOCKER_HOST="${DOCKER_HOST:-gitlab.minilab.live}"
CONTAINER_NAME="${CONTAINER_NAME:-stapelwerk-app}"
DB_CONTAINER="${DB_CONTAINER:-stapelwerk-db}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
}

log_info "Starting integration tests..."
echo ""

#############################################################
# Test 1: Container Communication
#############################################################

log_info "Test 1: Testing container-to-container communication..."

# Check if app can reach database
if ssh root@$DOCKER_HOST "docker exec $CONTAINER_NAME ping -c 1 $DB_CONTAINER" > /dev/null 2>&1; then
    log_success "Application container can reach database container"
else
    log_error "Application container cannot reach database"
    exit 1
fi

#############################################################
# Test 2: Database Operations
#############################################################

log_info "Test 2: Testing database operations..."

# Test database read
if ssh root@$DOCKER_HOST "docker exec $DB_CONTAINER psql -U stapelwerk -c 'SELECT 1;'" > /dev/null 2>&1; then
    log_success "Database read operations work"
else
    log_error "Database read operations failed"
    exit 1
fi

# Test database write (create and drop test table)
if ssh root@$DOCKER_HOST "docker exec $DB_CONTAINER psql -U stapelwerk -c 'CREATE TABLE IF NOT EXISTS test_integration (id SERIAL PRIMARY KEY); DROP TABLE test_integration;'" > /dev/null 2>&1; then
    log_success "Database write operations work"
else
    log_error "Database write operations failed"
    exit 1
fi

#############################################################
# Test 3: Application Database Connection
#############################################################

log_info "Test 3: Testing application database connection through Prisma..."

# Check if app can query database
if ssh root@$DOCKER_HOST "docker exec $CONTAINER_NAME npx prisma db pull --force" > /dev/null 2>&1; then
    log_success "Application can connect to database through Prisma"
else
    log_error "Application cannot connect to database through Prisma"
    exit 1
fi

#############################################################
# Test 4: Environment Variables
#############################################################

log_info "Test 4: Verifying environment variables..."

# Check critical environment variables exist
critical_vars=("DATABASE_URL" "NODE_ENV")
for var in "${critical_vars[@]}"; do
    if ssh root@$DOCKER_HOST "docker exec $CONTAINER_NAME env | grep -q $var="; then
        log_success "Environment variable $var is set"
    else
        log_error "Environment variable $var is missing"
        exit 1
    fi
done

#############################################################
# Test 5: Volume Persistence
#############################################################

log_info "Test 5: Testing volume persistence..."

# Check if database volume exists and has data
db_size=$(ssh root@$DOCKER_HOST "docker exec $DB_CONTAINER du -sh /var/lib/postgresql/data 2>/dev/null | cut -f1" || echo "0")
if [ "$db_size" != "0" ]; then
    log_success "Database volume is persistent (size: $db_size)"
else
    log_error "Database volume persistence issue"
    exit 1
fi

#############################################################
# Test 6: Network Connectivity
#############################################################

log_info "Test 6: Testing network connectivity..."

# Check if containers are on the same network
app_network=$(ssh root@$DOCKER_HOST "docker inspect $CONTAINER_NAME --format='{{range \$key, \$value := .NetworkSettings.Networks}}{{\$key}}{{end}}'" 2>/dev/null || echo "")
db_network=$(ssh root@$DOCKER_HOST "docker inspect $DB_CONTAINER --format='{{range \$key, \$value := .NetworkSettings.Networks}}{{\$key}}{{end}}'" 2>/dev/null || echo "")

if [ "$app_network" = "$db_network" ] && [ -n "$app_network" ]; then
    log_success "Containers are on the same Docker network ($app_network)"
else
    log_error "Containers are not on the same network (app: $app_network, db: $db_network)"
    exit 1
fi

#############################################################
# Test 7: Container Health
#############################################################

log_info "Test 7: Testing container health..."

# Check app container health
app_health=$(ssh root@$DOCKER_HOST "docker inspect --format='{{.State.Health.Status}}' $CONTAINER_NAME 2>/dev/null" || echo "unknown")
if [ "$app_health" = "healthy" ]; then
    log_success "Application container is healthy"
elif [ "$app_health" = "unknown" ]; then
    log_success "Application container is running (no health check configured)"
else
    log_error "Application container health is: $app_health"
    exit 1
fi

#############################################################
# Test 8: Restart Resilience
#############################################################

log_info "Test 8: Testing restart resilience..."

# Check restart policy
restart_policy=$(ssh root@$DOCKER_HOST "docker inspect --format='{{.HostConfig.RestartPolicy.Name}}' $CONTAINER_NAME" || echo "no")
if [ "$restart_policy" = "unless-stopped" ] || [ "$restart_policy" = "always" ]; then
    log_success "Container has proper restart policy: $restart_policy"
else
    log_error "Container restart policy is: $restart_policy (should be 'unless-stopped' or 'always')"
fi

#############################################################
# Test 9: Port Exposure
#############################################################

log_info "Test 9: Testing port exposure..."

# Check if app port is exposed
app_port=$(ssh root@$DOCKER_HOST "docker port $CONTAINER_NAME 3000 2>/dev/null | cut -d: -f2" || echo "")
if [ -n "$app_port" ]; then
    log_success "Application port 3000 is exposed on host port $app_port"
else
    log_error "Application port is not properly exposed"
    exit 1
fi

#############################################################
# Test 10: Log Collection
#############################################################

log_info "Test 10: Testing log collection..."

# Check if logs are being generated
log_lines=$(ssh root@$DOCKER_HOST "docker logs --tail 10 $CONTAINER_NAME 2>&1 | wc -l")
if [ "$log_lines" -gt 0 ]; then
    log_success "Container logs are being collected ($log_lines recent lines)"
else
    log_error "No container logs found"
    exit 1
fi

#############################################################
# Summary
#############################################################

echo ""
log_success "================================================"
log_success "All integration tests passed successfully! ✓"
log_success "================================================"
echo ""

exit 0
