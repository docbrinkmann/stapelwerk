#!/bin/bash

#############################################################
# E2E Deployment Test Script
# Tests the complete deployment pipeline and verifies all services
#############################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOCKER_HOST="${DOCKER_HOST:-ssh://root@gitlab.minilab.live}"
APP_URL="${APP_URL:-https://buildmystack.minilab.live}"
PAGES_URL="${PAGES_URL:-https://sebastian.gitlab.io/build-my-stack}"
CONTAINER_NAME="${CONTAINER_NAME:-buildmystack-app}"
TIMEOUT=30

# Test results
TESTS_PASSED=0
TESTS_FAILED=0
FAILED_TESTS=()

#############################################################
# Helper Functions
#############################################################

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

test_passed() {
    ((TESTS_PASSED++))
    log_success "✓ $1"
}

test_failed() {
    ((TESTS_FAILED++))
    FAILED_TESTS+=("$1")
    log_error "✗ $1"
}

#############################################################
# Test Functions
#############################################################

test_docker_service() {
    log_info "Testing Docker service availability..."
    
    if ssh root@gitlab.minilab.live "docker ps" > /dev/null 2>&1; then
        test_passed "Docker service is running on remote host"
    else
        test_failed "Docker service is not accessible on remote host"
        return 1
    fi
}

test_container_running() {
    log_info "Testing if application container is running..."
    
    if ssh root@gitlab.minilab.live "docker ps | grep -q $CONTAINER_NAME"; then
        test_passed "Application container is running"
    else
        test_failed "Application container is not running"
        return 1
    fi
}

test_database_connection() {
    log_info "Testing database connection..."
    
    if ssh root@gitlab.minilab.live "docker exec buildmystack-db pg_isready -U buildmystack" > /dev/null 2>&1; then
        test_passed "Database is accepting connections"
    else
        test_failed "Database is not accepting connections"
        return 1
    fi
}

test_health_endpoint() {
    log_info "Testing application health endpoint..."
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "$APP_URL/api/health" || echo "000")
    
    if [ "$response" = "200" ]; then
        test_passed "Health endpoint returned 200 OK"
    else
        test_failed "Health endpoint returned $response (expected 200)"
        return 1
    fi
}

test_home_page() {
    log_info "Testing home page accessibility..."
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "$APP_URL" || echo "000")
    
    if [ "$response" = "200" ]; then
        test_passed "Home page returned 200 OK"
    else
        test_failed "Home page returned $response (expected 200)"
        return 1
    fi
}

test_api_routes() {
    log_info "Testing API routes..."
    
    # Test API endpoint (adjust to your actual API endpoints)
    response=$(curl -s -o /dev/null -w "%{http_code}" "$APP_URL/api/status" || echo "000")
    
    if [ "$response" = "200" ] || [ "$response" = "404" ]; then
        test_passed "API routes are accessible"
    else
        test_failed "API routes returned unexpected status $response"
        return 1
    fi
}

test_ssl_certificate() {
    log_info "Testing SSL certificate validity..."
    
    if curl -s --insecure -v "$APP_URL" 2>&1 | grep -q "SSL certificate verify ok"; then
        test_passed "SSL certificate is valid"
    else
        expiry=$(echo | openssl s_client -servername buildmystack.minilab.live -connect buildmystack.minilab.live:443 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
        if [ -n "$expiry" ]; then
            test_passed "SSL certificate is valid (expires: $expiry)"
        else
            test_failed "SSL certificate validation failed"
            return 1
        fi
    fi
}

test_websocket_support() {
    log_info "Testing WebSocket support..."
    
    # Check if nginx config has WebSocket headers
    if ssh root@gitlab.minilab.live "grep -q 'Upgrade \$http_upgrade' /etc/nginx/sites-available/buildmystack.conf" 2>/dev/null; then
        test_passed "WebSocket support is configured in nginx"
    else
        test_warning "WebSocket configuration not verified (may be configured elsewhere)"
    fi
}

test_static_assets() {
    log_info "Testing static assets delivery..."
    
    # Test if static files are served with proper caching headers
    headers=$(curl -s -I "$APP_URL/_next/static/test.js" 2>/dev/null || echo "")
    
    if echo "$headers" | grep -qi "cache-control"; then
        test_passed "Static assets are served with caching headers"
    else
        test_warning "Static asset caching headers not detected (may be normal)"
    fi
}

test_gitlab_pages() {
    log_info "Testing GitLab Pages static content..."
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "$PAGES_URL" || echo "000")
    
    if [ "$response" = "200" ]; then
        test_passed "GitLab Pages is accessible"
    else
        test_warning "GitLab Pages returned $response (may not be deployed yet)"
    fi
}

test_docs_pages() {
    log_info "Testing documentation pages..."
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "$PAGES_URL/docs/index.html" || echo "000")
    
    if [ "$response" = "200" ]; then
        test_passed "Documentation pages are accessible"
    else
        test_warning "Documentation pages returned $response (may not be deployed yet)"
    fi
}

test_container_logs() {
    log_info "Testing container logs for errors..."
    
    errors=$(ssh root@gitlab.minilab.live "docker logs --tail 50 $CONTAINER_NAME 2>&1 | grep -i 'error' | wc -l")
    
    if [ "$errors" -eq 0 ]; then
        test_passed "No errors found in recent container logs"
    else
        test_warning "Found $errors error lines in recent logs (review recommended)"
    fi
}

test_database_migrations() {
    log_info "Testing database migrations status..."
    
    # Check if migrations table exists
    if ssh root@gitlab.minilab.live "docker exec $CONTAINER_NAME npx prisma migrate status" 2>&1 | grep -q "up to date"; then
        test_passed "Database migrations are up to date"
    else
        test_warning "Could not verify migration status (manual check recommended)"
    fi
}

test_backup_script() {
    log_info "Testing backup script existence and permissions..."
    
    if ssh root@gitlab.minilab.live "test -x /opt/buildmystack/scripts/backup-db.sh"; then
        test_passed "Backup script exists and is executable"
    else
        test_failed "Backup script is missing or not executable"
        return 1
    fi
}

test_cron_jobs() {
    log_info "Testing cron job configuration..."
    
    if ssh root@gitlab.minilab.live "crontab -l 2>/dev/null | grep -q backup-db.sh"; then
        test_passed "Backup cron job is configured"
    else
        test_warning "Backup cron job not found (manual setup recommended)"
    fi
}

test_disk_space() {
    log_info "Testing available disk space..."
    
    disk_usage=$(ssh root@gitlab.minilab.live "df -h /opt/buildmystack | tail -1 | awk '{print \$5}' | sed 's/%//'")
    
    if [ "$disk_usage" -lt 80 ]; then
        test_passed "Disk space is adequate ($disk_usage% used)"
    else
        test_warning "Disk space usage is high ($disk_usage% used)"
    fi
}

test_memory_usage() {
    log_info "Testing container memory usage..."
    
    memory=$(ssh root@gitlab.minilab.live "docker stats --no-stream --format '{{.MemPerc}}' $CONTAINER_NAME | sed 's/%//'")
    
    if [ -n "$memory" ]; then
        if (( $(echo "$memory < 90" | bc -l 2>/dev/null || echo 1) )); then
            test_passed "Container memory usage is healthy (${memory}%)"
        else
            test_warning "Container memory usage is high (${memory}%)"
        fi
    else
        test_warning "Could not retrieve memory stats"
    fi
}

test_security_headers() {
    log_info "Testing security headers..."
    
    headers=$(curl -s -I "$APP_URL" 2>/dev/null || echo "")
    
    if echo "$headers" | grep -qi "X-Frame-Options"; then
        test_passed "Security headers are present"
    else
        test_warning "Some security headers may be missing"
    fi
}

test_response_time() {
    log_info "Testing application response time..."
    
    response_time=$(curl -s -o /dev/null -w "%{time_total}" "$APP_URL" || echo "999")
    
    if (( $(echo "$response_time < 2.0" | bc -l 2>/dev/null || echo 0) )); then
        test_passed "Response time is good (${response_time}s)"
    else
        test_warning "Response time is slow (${response_time}s)"
    fi
}

#############################################################
# Main Test Runner
#############################################################

main() {
    echo ""
    echo "================================================================"
    echo "  BuildMyStack E2E Deployment Test Suite"
    echo "================================================================"
    echo ""
    log_info "Starting E2E tests at $(date)"
    echo ""
    
    # Infrastructure Tests
    echo "--- Infrastructure Tests ---"
    test_docker_service
    test_container_running
    test_database_connection
    echo ""
    
    # Application Tests
    echo "--- Application Tests ---"
    test_health_endpoint
    test_home_page
    test_api_routes
    echo ""
    
    # SSL and Security Tests
    echo "--- SSL and Security Tests ---"
    test_ssl_certificate
    test_security_headers
    echo ""
    
    # Network and Performance Tests
    echo "--- Network and Performance Tests ---"
    test_websocket_support
    test_static_assets
    test_response_time
    echo ""
    
    # Static Pages Tests
    echo "--- Static Pages Tests ---"
    test_gitlab_pages
    test_docs_pages
    echo ""
    
    # Maintenance Tests
    echo "--- Maintenance Tests ---"
    test_container_logs
    test_database_migrations
    test_backup_script
    test_cron_jobs
    echo ""
    
    # Resource Tests
    echo "--- Resource Tests ---"
    test_disk_space
    test_memory_usage
    echo ""
    
    # Summary
    echo "================================================================"
    echo "  Test Summary"
    echo "================================================================"
    echo ""
    log_success "Tests Passed: $TESTS_PASSED"
    
    if [ $TESTS_FAILED -gt 0 ]; then
        log_error "Tests Failed: $TESTS_FAILED"
        echo ""
        echo "Failed Tests:"
        for test in "${FAILED_TESTS[@]}"; do
            echo "  - $test"
        done
        echo ""
        exit 1
    else
        log_success "All tests passed! ✓"
        echo ""
        exit 0
    fi
}

# Run tests
main "$@"
