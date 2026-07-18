#!/bin/bash
#
# OWASP ZAP Baseline Security Scan
#
# This script runs a quick baseline security scan using OWASP ZAP.
# Baseline scans are fast (1-2 minutes) and suitable for CI/CD pipelines.
#
# Usage:
#   ./security/run-zap-baseline.sh
#   ./security/run-zap-baseline.sh --target http://localhost:3000
#   ./security/run-zap-baseline.sh --generate-report

set -e

# Configuration
TARGET_URL="${1:-http://host.docker.internal:3000}"
REPORT_DIR="./security/reports"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="zap-baseline-${TIMESTAMP}.html"
JSON_REPORT="zap-baseline-${TIMESTAMP}.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     OWASP ZAP Baseline Security Scan                ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}✗ Docker is not running. Please start Docker and try again.${NC}"
    exit 1
fi

# Create reports directory if it doesn't exist
mkdir -p "${REPORT_DIR}"

echo -e "${YELLOW}Target URL:${NC} ${TARGET_URL}"
echo -e "${YELLOW}Report Directory:${NC} ${REPORT_DIR}"
echo ""

# Check if application is running
echo -e "${YELLOW}► Checking if application is accessible...${NC}"
if curl -s -f -o /dev/null --max-time 5 "${TARGET_URL}/api/health" 2>/dev/null || \
   curl -s -f -o /dev/null --max-time 5 "http://localhost:3000/api/health" 2>/dev/null; then
    echo -e "${GREEN}✓ Application is accessible${NC}"
else
    echo -e "${RED}✗ Application is not accessible at ${TARGET_URL}${NC}"
    echo -e "${YELLOW}  Please ensure the application is running:${NC}"
    echo -e "${YELLOW}    docker compose up -d${NC}"
    echo -e "${YELLOW}  or${NC}"
    echo -e "${YELLOW}    npm run dev${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}► Running OWASP ZAP Baseline Scan...${NC}"
echo -e "${YELLOW}  This will take 1-2 minutes...${NC}"
echo ""

# Run ZAP Baseline Scan
docker run --rm \
    -v "$(pwd):/zap/wrk/:rw" \
    -t owasp/zap2docker-stable \
    zap-baseline.py \
    -t "${TARGET_URL}" \
    -c /zap/wrk/security/zap-baseline.conf \
    -r "${REPORT_FILE}" \
    -J "${JSON_REPORT}" \
    -I \
    || {
        EXIT_CODE=$?
        echo ""
        echo -e "${YELLOW}═══════════════════════════════════════════════════════${NC}"
        echo -e "${YELLOW}  ZAP Baseline Scan completed with warnings/failures  ${NC}"
        echo -e "${YELLOW}═══════════════════════════════════════════════════════${NC}"

        # ZAP exit codes:
        # 0: Success
        # 1: At least 1 WARN
        # 2: At least 1 FAIL
        # 3: Any other failure

        if [ $EXIT_CODE -eq 1 ]; then
            echo -e "${YELLOW}⚠ Scan found warnings but no failures${NC}"
        elif [ $EXIT_CODE -eq 2 ]; then
            echo -e "${RED}✗ Scan found security failures${NC}"
        else
            echo -e "${RED}✗ Scan encountered an error${NC}"
        fi

        echo ""
        echo -e "${YELLOW}Review the detailed report:${NC}"
        echo -e "  ${REPORT_DIR}/${REPORT_FILE}"
        echo -e "  ${REPORT_DIR}/${JSON_REPORT}"
        echo ""

        exit $EXIT_CODE
    }

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     Baseline Scan Completed Successfully!           ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}✓ No critical security issues found${NC}"
echo ""
echo -e "${YELLOW}Reports generated:${NC}"
echo -e "  HTML: ${REPORT_DIR}/${REPORT_FILE}"
echo -e "  JSON: ${REPORT_DIR}/${JSON_REPORT}"
echo ""
echo -e "${YELLOW}To view the HTML report:${NC}"
echo -e "  open ${REPORT_DIR}/${REPORT_FILE}"
echo ""
