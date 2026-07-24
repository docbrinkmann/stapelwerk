#!/bin/bash
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

BASE_URL="${BASE_URL:-http://localhost:3000}"
PASSED=0
FAILED=0
WARNINGS=0

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Stapelwerk Development Environment Validation     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Function to check service
check_service() {
    local name=$1
    local url=$2
    local expected_status=${3:-200}
    
    echo -n "Checking $name... "
    
    if response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null); then
        if [ "$response" -eq "$expected_status" ]; then
            echo -e "${GREEN}✓ PASS${NC} (HTTP $response)"
            ((PASSED++))
            return 0
        else
            echo -e "${RED}✗ FAIL${NC} (HTTP $response, expected $expected_status)"
            ((FAILED++))
            return 1
        fi
    else
        echo -e "${RED}✗ FAIL${NC} (Connection failed)"
        ((FAILED++))
        return 1
    fi
}

# Function to check Docker container
check_container() {
    local name=$1
    local expected_status="Up"
    
    echo -n "Checking container $name... "
    
    if docker ps --format '{{.Names}} {{.Status}}' | grep -q "$name.*$expected_status"; then
        echo -e "${GREEN}✓ PASS${NC}"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (not running or unhealthy)"
        ((FAILED++))
        return 1
    fi
}

echo -e "${YELLOW}═══ Phase 1: Docker Container Health ═══${NC}"
echo ""
check_container "stapelwerk-app"
check_container "stapelwerk-postgres"
check_container "stapelwerk-redis"
echo ""

echo -e "${YELLOW}═══ Phase 2: Application Endpoints ═══${NC}"
echo ""
check_service "Health Endpoint" "$BASE_URL/api/health" 200
check_service "Metrics Endpoint" "$BASE_URL/api/metrics" 200
check_service "Home Page" "$BASE_URL/" 200
echo ""

echo -e "${YELLOW}═══ Phase 3: Database Connectivity ═══${NC}"
echo ""
echo -n "Checking PostgreSQL connection... "
if docker exec stapelwerk-postgres pg_isready -U postgres >/dev/null 2>&1; then
    echo -e "${GREEN}✓ PASS${NC}"
    ((PASSED++))
else
    echo -e "${RED}✗ FAIL${NC}"
    ((FAILED++))
fi

echo -n "Checking database version... "
VERSION=$(docker exec stapelwerk-postgres psql -U postgres -t -c "SELECT version();" 2>/dev/null | head -1)
if echo "$VERSION" | grep -q "PostgreSQL 18"; then
    echo -e "${GREEN}✓ PASS${NC} (PostgreSQL 18.0)"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠ WARNING${NC} (Version: $VERSION)"
    ((WARNINGS++))
fi
echo ""

echo -e "${YELLOW}═══ Phase 4: Metrics & Monitoring ═══${NC}"
echo ""
echo -n "Checking Prometheus metrics format... "
if curl -s "$BASE_URL/api/metrics" | head -5 | grep -q "# HELP"; then
    echo -e "${GREEN}✓ PASS${NC}"
    ((PASSED++))
else
    echo -e "${RED}✗ FAIL${NC}"
    ((FAILED++))
fi

echo -n "Checking custom metrics... "
if curl -s "$BASE_URL/api/metrics" | grep -q "http_requests_total"; then
    echo -e "${GREEN}✓ PASS${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠ WARNING${NC} (custom metrics not found)"
    ((WARNINGS++))
fi
echo ""

echo -e "${YELLOW}═══ Phase 5: Health Check Components ═══${NC}"
echo ""
HEALTH=$(curl -s "$BASE_URL/api/health")

echo -n "Checking overall health status... "
if echo "$HEALTH" | jq -e '.status == "healthy"' >/dev/null 2>&1; then
    echo -e "${GREEN}✓ PASS${NC}"
    ((PASSED++))
else
    echo -e "${RED}✗ FAIL${NC}"
    ((FAILED++))
fi

echo -n "Checking database component... "
if echo "$HEALTH" | jq -e '.components.database.status == "healthy"' >/dev/null 2>&1; then
    echo -e "${GREEN}✓ PASS${NC}"
    ((PASSED++))
else
    echo -e "${RED}✗ FAIL${NC}"
    ((FAILED++))
fi

echo -n "Checking performance monitoring... "
if echo "$HEALTH" | jq -e '.components.performance.status == "healthy"' >/dev/null 2>&1; then
    echo -e "${GREEN}✓ PASS${NC}"
    ((PASSED++))
else
    echo -e "${RED}✗ FAIL${NC}"
    ((FAILED++))
fi

echo -n "Checking alerting system... "
if echo "$HEALTH" | jq -e '.components.alerting.status == "healthy"' >/dev/null 2>&1; then
    echo -e "${GREEN}✓ PASS${NC}"
    ((PASSED++))
else
    echo -e "${RED}✗ FAIL${NC}"
    ((FAILED++))
fi
echo ""

echo -e "${YELLOW}═══ Phase 6: Database Seeding ═══${NC}"
echo ""
echo -n "Checking service count... "
SERVICE_COUNT=$(echo "$HEALTH" | jq -r '.components.recommendations.details.serviceCount // 0' 2>/dev/null)
if [ "$SERVICE_COUNT" -ge 4 ]; then
    echo -e "${GREEN}✓ PASS${NC} ($SERVICE_COUNT services)"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠ WARNING${NC} ($SERVICE_COUNT services, expected 50+)"
    ((WARNINGS++))
fi
echo ""

# Summary
echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                  Validation Summary                    ║${NC}"
echo -e "${BLUE}╠════════════════════════════════════════════════════════╣${NC}"
echo -e "${BLUE}║${NC} ${GREEN}Passed:${NC}   $PASSED checks                                   ${BLUE}║${NC}"
echo -e "${BLUE}║${NC} ${RED}Failed:${NC}   $FAILED checks                                   ${BLUE}║${NC}"
echo -e "${BLUE}║${NC} ${YELLOW}Warnings:${NC} $WARNINGS checks                                 ${BLUE}║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ Development environment validation PASSED${NC}"
    if [ $WARNINGS -gt 0 ]; then
        echo -e "${YELLOW}⚠ Note: $WARNINGS warnings detected (non-critical)${NC}"
    fi
    exit 0
else
    echo -e "${RED}✗ Development environment validation FAILED${NC}"
    echo -e "${RED}  Please address the $FAILED failed checks above${NC}"
    exit 1
fi
