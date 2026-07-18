#!/bin/bash

echo "========================================="
echo "Final Validation - All Checks"
echo "========================================="
echo ""

# Track results
PASS=0
FAIL=0

# Function to run check
run_check() {
    local name="$1"
    local command="$2"
    
    echo "Running: $name"
    if eval "$command" > /dev/null 2>&1; then
        echo "✓ PASS: $name"
        ((PASS++))
    else
        echo "✗ FAIL: $name"
        ((FAIL++))
    fi
    echo ""
}

# 1. Code Quality
echo "=== Code Quality ==="
run_check "TypeScript Check" "npm run type-check"
run_check "Linting" "npm run lint"
run_check "Unit Tests" "npm run test:unit"
run_check "Integration Tests" "npm run test:integration"

# 2. E2E Tests
echo "=== E2E Tests ==="
run_check "Modal Tests" "npx playwright test e2e-tests/manual-verification.spec.ts"
run_check "Workflow Tests" "npx playwright test e2e-tests/user-workflows.spec.ts"

# 3. Performance
echo "=== Performance ==="
run_check "Load Testing" "npm run perf:load"
run_check "Lighthouse Audit" "npm run perf:lighthouse"

# 4. Security
echo "=== Security ==="
run_check "Security Headers" "./security/check-headers.sh"
run_check "SQL Injection Tests" "npx playwright test security/sql-injection-tests.spec.ts"
run_check "XSS Tests" "npx playwright test security/xss-tests.spec.ts"

# 5. Accessibility
echo "=== Accessibility ==="
run_check "Accessibility Tests" "npx playwright test e2e-tests/accessibility-audit.spec.ts"
run_check "Pa11y Audit" "./accessibility/audit.sh"

# 6. Cross-Browser
echo "=== Cross-Browser ==="
run_check "Chrome Tests" "npx playwright test --project=chromium"
run_check "Firefox Tests" "npx playwright test --project=firefox"
run_check "Safari Tests" "npx playwright test --project=webkit"

# Summary
echo "========================================="
echo "VALIDATION SUMMARY"
echo "========================================="
echo "PASSED: $PASS"
echo "FAILED: $FAIL"
echo ""

if [ $FAIL -eq 0 ]; then
    echo "🎉 ALL CHECKS PASSED - READY FOR PRODUCTION"
    exit 0
else
    echo "⚠️  SOME CHECKS FAILED - REVIEW REQUIRED"
    exit 1
fi
