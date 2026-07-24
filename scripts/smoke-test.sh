#!/bin/bash

#############################################################
# Smoke Test Script
# Quick verification that the deployment is operational
# Run this after every deployment for fast feedback
#############################################################

set -e

# Configuration
APP_URL="${APP_URL:-https://stapelwerk.minilab.live}"
TIMEOUT=10

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🔥 Running smoke tests for Stapelwerk..."
echo ""

# Test 1: Health Endpoint
echo -n "Testing health endpoint... "
if curl -sf --max-time $TIMEOUT "$APP_URL/api/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    echo "Health endpoint failed!"
    exit 1
fi

# Test 2: Home Page
echo -n "Testing home page... "
response=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "$APP_URL" 2>/dev/null || echo "000")
if [ "$response" = "200" ]; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC} (Status: $response)"
    exit 1
fi

# Test 3: SSL Certificate
echo -n "Testing SSL certificate... "
if echo | openssl s_client -servername stapelwerk.minilab.live -connect stapelwerk.minilab.live:443 2>/dev/null | grep -q "Verify return code: 0"; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${YELLOW}⚠${NC} (Warning: Certificate verification issue)"
fi

# Test 4: Response Time
echo -n "Testing response time... "
response_time=$(curl -s -o /dev/null -w "%{time_total}" --max-time $TIMEOUT "$APP_URL" 2>/dev/null || echo "999")
if (( $(echo "$response_time < 3.0" | bc -l 2>/dev/null || echo 0) )); then
    echo -e "${GREEN}✓${NC} (${response_time}s)"
else
    echo -e "${YELLOW}⚠${NC} (${response_time}s - slower than expected)"
fi

echo ""
echo -e "${GREEN}✓ All smoke tests passed!${NC}"
echo ""
exit 0
