# Security Testing Guide

Comprehensive security testing documentation for the Build My Stack application using OWASP ZAP and automated security validation.

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [OWASP ZAP Scanning](#owasp-zap-scanning)
4. [CI/CD Integration](#cicd-integration)
5. [Security Test Suite](#security-test-suite)
6. [Manual Security Testing](#manual-security-testing)
7. [Troubleshooting](#troubleshooting)

---

## Overview

This directory contains security testing configurations and scripts for automated vulnerability scanning using OWASP ZAP (Zed Attack Proxy).

**Security Testing Components:**
- ✅ OWASP ZAP Baseline Scans (CI/CD friendly, 1-2 minutes)
- ✅ OWASP ZAP Full Scans (Comprehensive testing, 10-30 minutes)
- ✅ Automated security test suite
- ✅ CI/CD workflow integrations
- ✅ Security verification reports

**What We Test:**
- 🔒 CSRF Protection
- 🔒 XSS (Cross-Site Scripting) Prevention
- 🔒 SQL Injection Protection
- 🔒 Security Headers (CSP, HSTS, X-Frame-Options, etc.)
- 🔒 Rate Limiting
- 🔒 Input Validation & Sanitization
- 🔒 Authentication & Authorization
- 🔒 OWASP Top 10 Vulnerabilities

---

## Quick Start

### Prerequisites

- Docker installed and running
- Application running on http://localhost:3000
- Bash shell (macOS, Linux, WSL, or Git Bash on Windows)

### Run Baseline Scan (Recommended for CI/CD)

```bash
# Make scripts executable
chmod +x security/*.sh

# Run baseline scan (fast, non-intrusive)
./security/run-zap-baseline.sh

# View results
open security/reports/zap-baseline-*.html
```

### Run Full Scan (Comprehensive Testing)

```bash
# ⚠️  Only run in non-production environments!
./security/run-zap-full.sh

# View results
open security/reports/zap-scan-report-*.html
```

---

## OWASP ZAP Scanning

### Baseline Scan

**Purpose:** Fast security check suitable for pull requests and continuous integration.

**Characteristics:**
- ⏱️ Duration: 1-2 minutes
- 🚫 Non-intrusive: No active attacks, only passive scanning
- ✅ Safe for production: Read-only analysis
- 📊 Reports: HTML + JSON formats

**What it checks:**
- Security headers (CSP, HSTS, X-Frame-Options, etc.)
- Cookie security (HttpOnly, Secure, SameSite)
- Information disclosure
- Sensitive data in URLs
- Common misconfigurations
- Vulnerable JavaScript libraries

**Usage:**

```bash
# Basic usage
./security/run-zap-baseline.sh

# Custom target URL
./security/run-zap-baseline.sh http://localhost:3000

# Docker command (manual)
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t http://host.docker.internal:3000 \
  -c /zap/wrk/security/zap-baseline.conf \
  -r zap-baseline-report.html
```

**Exit Codes:**
- `0`: No warnings or failures
- `1`: Warnings found (non-critical)
- `2`: Failures found (requires attention)
- `3`: Scan error occurred

### Full Scan (Active Scanning)

**Purpose:** Comprehensive security testing with active vulnerability probing.

**Characteristics:**
- ⏱️ Duration: 10-30 minutes
- ⚠️ Intrusive: Sends attack payloads and modifies application state
- 🚫 Non-production only: Can cause data corruption
- 📊 Reports: HTML + JSON + Stats

**What it checks:**
- All baseline checks
- **SQL Injection** (all database entry points)
- **XSS** (reflected, stored, DOM-based)
- **CSRF** (cross-site request forgery)
- **Path Traversal** (directory access)
- **Command Injection** (OS command execution)
- **XXE** (XML external entity)
- **Security misconfigurations**
- **Authentication bypass**
- **Session management flaws**

**Usage:**

```bash
# ⚠️  WARNING: Only run in development/test environments!
./security/run-zap-full.sh

# Docker command (manual)
docker run -v $(pwd):/zap/wrk/:rw -e REPORT_TIMESTAMP=$(date +%Y%m%d_%H%M%S) \
  -t owasp/zap2docker-stable \
  zap.sh -cmd -autorun /zap/wrk/security/zap-automation.yaml
```

**Configuration:** Edit `security/zap-automation.yaml` to customize scan behavior.

---

## CI/CD Integration

### GitHub Actions Workflow

Create `.github/workflows/security-scan.yml`:

```yaml
name: Security Scan

on:
  pull_request:
    branches: [main, develop]
  schedule:
    - cron: '0 2 * * 1' # Weekly on Mondays at 2 AM

jobs:
  zap-baseline:
    name: OWASP ZAP Baseline Scan
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Start application
        run: |
          docker compose up -d
          sleep 30
          curl --retry 10 --retry-connrefused http://localhost:3000/api/health

      - name: Run ZAP Baseline Scan
        run: |
          chmod +x security/run-zap-baseline.sh
          ./security/run-zap-baseline.sh

      - name: Upload ZAP Reports
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: zap-scan-reports
          path: security/reports/

      - name: Shutdown application
        if: always()
        run: docker compose down
```

### GitLab CI/CD Pipeline

Add to `.gitlab-ci.yml`:

```yaml
security:zap-baseline:
  stage: test
  image: docker:latest
  services:
    - docker:dind
  script:
    - apk add --no-cache bash curl
    - docker compose up -d
    - sleep 30
    - curl --retry 10 --retry-connrefused http://localhost:3000/api/health
    - chmod +x security/run-zap-baseline.sh
    - ./security/run-zap-baseline.sh
  artifacts:
    when: always
    paths:
      - security/reports/
    expire_in: 1 week
  allow_failure: true
  only:
    - merge_requests
    - main
```

### Jenkins Pipeline

```groovy
pipeline {
    agent any

    stages {
        stage('Start Application') {
            steps {
                sh 'docker compose up -d'
                sh 'sleep 30'
                sh 'curl --retry 10 --retry-connrefused http://localhost:3000/api/health'
            }
        }

        stage('ZAP Baseline Scan') {
            steps {
                sh 'chmod +x security/run-zap-baseline.sh'
                sh './security/run-zap-baseline.sh || true'
            }
        }

        stage('Publish Reports') {
            steps {
                publishHTML([
                    allowMissing: false,
                    alwaysLinkToLastBuild: true,
                    keepAll: true,
                    reportDir: 'security/reports',
                    reportFiles: 'zap-baseline-*.html',
                    reportName: 'ZAP Security Report'
                ])
            }
        }
    }

    post {
        always {
            sh 'docker compose down'
        }
    }
}
```

---

## Security Test Suite

### Running Security Unit Tests

```bash
# Run all security tests
npm run test:security

# Run specific test files
npm test src/__tests__/security/csrf.test.ts
npm test src/__tests__/security/xss.test.ts
npm test src/__tests__/security/sql-injection.test.ts

# Run with coverage
npm run test:security:coverage

# Watch mode for development
npm run test:security:watch
```

### Test Categories

**1. CSRF Protection Tests** (`src/__tests__/security/csrf.test.ts`)
- ✅ Origin header validation
- ✅ Referer header validation
- ✅ Safe methods bypass (GET, HEAD, OPTIONS)
- ✅ Cross-origin request rejection

**2. XSS Protection Tests** (`src/__tests__/security/xss.test.ts`)
- ✅ HTML sanitization utility
- ✅ React auto-escaping behavior
- ✅ dangerouslySetInnerHTML usage audit
- ✅ CSP header validation

**3. SQL Injection Tests** (`src/__tests__/security/sql-injection.test.ts`)
- ✅ Prisma query parameterization
- ✅ Raw query template literal validation
- ✅ Input validation before database operations

**4. Security Headers Tests** (`src/__tests__/security/headers.test.ts`)
- ✅ CSP header presence and directives
- ✅ HSTS header with proper max-age
- ✅ X-Frame-Options, X-Content-Type-Options
- ✅ Permissions-Policy restrictions

**5. Rate Limiting Tests** (`src/__tests__/security/rate-limiting.test.ts`)
- ✅ Rate limit enforcement per IP
- ✅ Rate limit headers in responses
- ✅ Different limits for different routes
- ✅ Redis-based distributed limiting

---

## Manual Security Testing

### CSRF Testing

```bash
# Test CSRF protection with wrong origin
curl -X POST http://localhost:3000/api/services \
  -H "Content-Type: application/json" \
  -H "Origin: https://evil.com" \
  -d '{"name": "test"}'

# Expected: 403 CSRF protection: Origin mismatch
```

### Security Headers Testing

```bash
# Check all security headers
curl -I http://localhost:3000/

# Expected headers:
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
# X-XSS-Protection: 1; mode=block
# Strict-Transport-Security: max-age=31536000; includeSubDomains
# Content-Security-Policy: [comprehensive directives]
```

### Rate Limiting Testing

```bash
# Test rate limiting (100 requests to API endpoint)
for i in {1..100}; do
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/services
done

# Expected: 200s initially, then 429 after limit exceeded
```

### SQL Injection Testing (Safe - Prisma Protected)

```bash
# Test SQL injection in query parameter (should be safe)
curl "http://localhost:3000/api/services?search='; DROP TABLE services; --"

# Expected: Safe handling, no SQL injection possible with Prisma
```

---

## Report Interpretation

### Understanding ZAP Reports

**Risk Levels:**

| Level | Color | Action Required |
|-------|-------|-----------------|
| **High** | 🔴 Red | Fix immediately before production |
| **Medium** | 🟡 Yellow | Fix within 1 week |
| **Low** | 🟢 Green | Fix when convenient |
| **Informational** | ℹ️ Blue | Review and document |

**Common Findings:**

1. **CSP Header Issues**
   - `'unsafe-inline'` in script-src → Recommendation: Use nonces
   - `'unsafe-eval'` in script-src → Recommendation: Remove if possible

2. **Cookie Flags**
   - Missing `HttpOnly` → XSS can steal cookies
   - Missing `Secure` → Transmitted over HTTP
   - Missing `SameSite` → CSRF vulnerability

3. **Information Disclosure**
   - Server version headers → Remove in production
   - Debug error messages → Generic errors only
   - Directory listings → Disable

4. **Missing Security Headers**
   - No `X-Content-Type-Options` → MIME sniffing attacks
   - No `X-Frame-Options` → Clickjacking
   - No `Referrer-Policy` → Privacy leaks

### False Positives

Common false positives you can ignore:

- **Base64 in Next.js build IDs** - Expected for versioning
- **Timestamp in URLs** - Expected for cache busting
- **Missing headers on `_next/` paths** - Static assets, acceptable
- **SRI on development builds** - Enable for production only

---

## Troubleshooting

### Application Not Accessible

```bash
# Check if application is running
docker compose ps

# Check application health
curl http://localhost:3000/api/health

# Start application if not running
docker compose up -d

# Wait for application to be ready
sleep 30 && curl --retry 10 http://localhost:3000/api/health
```

### Docker Issues

```bash
# Check Docker status
docker info

# Restart Docker if needed
# macOS: Docker Desktop → Restart
# Linux: sudo systemctl restart docker

# Clean up Docker resources
docker system prune -a
```

### ZAP Scan Hangs

```bash
# Kill hanging scan
docker ps | grep zap
docker kill <container_id>

# Reduce scan duration in zap-automation.yaml
# Edit maxDuration values for spider and scan jobs

# Use baseline scan instead for faster results
./security/run-zap-baseline.sh
```

### Permission Denied Errors

```bash
# Make scripts executable
chmod +x security/*.sh

# Fix report directory permissions
chmod -R 755 security/reports/

# Run with sudo if necessary (not recommended)
sudo ./security/run-zap-baseline.sh
```

### High Memory Usage

ZAP can use significant memory for large applications:

```bash
# Limit ZAP memory in docker run
docker run -m 2g -t owasp/zap2docker-stable ...

# Reduce scan scope in zap-automation.yaml
# - Decrease maxDepth in spider config
# - Reduce maxDuration
# - Limit maxChildren
```

---

## Security Resources

### Official Documentation

- [OWASP ZAP](https://www.zaproxy.org/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security](https://nextjs.org/docs/app/building-your-application/routing/middleware#security)
- [Prisma Security](https://www.prisma.io/docs/concepts/components/prisma-client/raw-database-access)

### Security Best Practices

- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)
- [SANS Secure Coding](https://www.sans.org/secure-coding/)
- [CWE Top 25](https://cwe.mitre.org/top25/)

### Tools & Extensions

- [ZAP HUD](https://www.zaproxy.org/docs/desktop/addons/hud/) - Heads Up Display
- [Mozilla Observatory](https://observatory.mozilla.org/) - Online security scanner
- [Security Headers](https://securityheaders.com/) - Header checker

---

## Contributing

When adding new security tests or configurations:

1. **Document thoroughly** - Explain what each test validates
2. **Follow patterns** - Use existing test structure
3. **Test locally** - Run full test suite before committing
4. **Update reports** - Regenerate security verification report
5. **Update docs** - Keep this README current

---

**Last Updated:** 2025-11-10
**Maintained By:** Build My Stack Security Team
**Questions?** Create an issue or reach out to the security team.
