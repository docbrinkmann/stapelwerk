#!/bin/bash
#
# OWASP ZAP Full Security Scan
#
# This script runs a comprehensive security scan using OWASP ZAP Automation Framework.
# Full scans take 10-30 minutes and include active security testing.
#
# ⚠️  WARNING: Only run full scans in non-production environments!
#     Active scanning can modify application state and may cause issues.
#
# Usage:
#   ./security/run-zap-full.sh
#   ./security/run-zap-full.sh --target http://localhost:3000

set -e

# Configuration
TARGET_URL="${1:-http://host.docker.internal:3000}"
REPORT_DIR="./security/reports"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     OWASP ZAP Full Security Scan                    ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

# Warning banner
echo -e "${RED}⚠️  WARNING: Full Active Scanning Enabled${NC}"
echo -e "${RED}   This scan will modify application state!${NC}"
echo -e "${RED}   Only run in non-production environments!${NC}"
echo ""
read -p "Do you want to continue? (yes/no): " -r
echo ""
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo -e "${YELLOW}Scan cancelled.${NC}"
    exit 0
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}✗ Docker is not running. Please start Docker and try again.${NC}"
    exit 1
fi

# Create reports directory if it doesn't exist
mkdir -p "${REPORT_DIR}"

echo -e "${YELLOW}Target URL:${NC} ${TARGET_URL}"
echo -e "${YELLOW}Report Directory:${NC} ${REPORT_DIR}"
echo -e "${YELLOW}Timestamp:${NC} ${TIMESTAMP}"
echo ""

# Check if application is running
echo -e "${YELLOW}► Checking if application is accessible...${NC}"
if curl -s -f -o /dev/null --max-time 5 "http://localhost:3000/api/health" 2>/dev/null; then
    echo -e "${GREEN}✓ Application is accessible${NC}"
else
    echo -e "${RED}✗ Application is not accessible${NC}"
    echo -e "${YELLOW}  Please ensure the application is running:${NC}"
    echo -e "${YELLOW}    docker compose up -d${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}► Running OWASP ZAP Full Scan with Automation Framework...${NC}"
echo -e "${YELLOW}  This will take 10-30 minutes...${NC}"
echo ""
echo -e "${YELLOW}Scan stages:${NC}"
echo -e "  1. Spider (Discovery)"
echo -e "  2. Passive Scan (Safe Analysis)"
echo -e "  3. Active Scan (Intrusive Testing)"
echo -e "  4. Report Generation"
echo ""

# Export timestamp for report naming
export REPORT_TIMESTAMP="${TIMESTAMP}"

# Run ZAP Automation Framework
docker run --rm \
    -v "$(pwd):/zap/wrk/:rw" \
    -e REPORT_TIMESTAMP="${TIMESTAMP}" \
    -t owasp/zap2docker-stable \
    zap.sh -cmd \
    -autorun /zap/wrk/security/zap-automation.yaml \
    || {
        EXIT_CODE=$?
        echo ""
        echo -e "${RED}═══════════════════════════════════════════════════════${NC}"
        echo -e "${RED}  ZAP Full Scan encountered errors                     ${NC}"
        echo -e "${RED}═══════════════════════════════════════════════════════${NC}"
        echo ""
        echo -e "${RED}✗ Scan exit code: ${EXIT_CODE}${NC}"
        echo ""
        echo -e "${YELLOW}Check the logs above for details.${NC}"
        echo -e "${YELLOW}Partial reports may still be available:${NC}"
        echo -e "  ${REPORT_DIR}/zap-scan-report-${TIMESTAMP}.html"
        echo -e "  ${REPORT_DIR}/zap-scan-report-${TIMESTAMP}.json"
        echo ""

        exit $EXIT_CODE
    }

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     Full Scan Completed Successfully!                ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

# List generated reports
echo -e "${YELLOW}Reports generated:${NC}"
if [ -f "${REPORT_DIR}/zap-scan-report-${TIMESTAMP}.html" ]; then
    echo -e "  HTML: ${REPORT_DIR}/zap-scan-report-${TIMESTAMP}.html"
fi
if [ -f "${REPORT_DIR}/zap-scan-report-${TIMESTAMP}.json" ]; then
    echo -e "  JSON: ${REPORT_DIR}/zap-scan-report-${TIMESTAMP}.json"
fi
if [ -f "${REPORT_DIR}/zap-stats-${TIMESTAMP}.txt" ]; then
    echo -e "  Stats: ${REPORT_DIR}/zap-stats-${TIMESTAMP}.txt"
fi

echo ""
echo -e "${YELLOW}To view the HTML report:${NC}"
echo -e "  open ${REPORT_DIR}/zap-scan-report-${TIMESTAMP}.html"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo -e "  1. Review the security findings in the report"
echo -e "  2. Prioritize fixes based on risk severity (High > Medium > Low)"
echo -e "  3. Update the security verification report"
echo -e "  4. Re-run the scan after fixes to verify resolution"
echo ""
