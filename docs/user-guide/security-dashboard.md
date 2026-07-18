# Security Dashboard User Guide

The Security Dashboard provides comprehensive visibility into your application's security posture, including vulnerability scanning, metrics tracking, and actionable recommendations.

## Overview

The Security Dashboard is your central hub for:
- Monitoring vulnerability counts across all severity levels
- Tracking security score trends over time
- Managing security scans (container, Dockerfile, Kubernetes)
- Receiving automated recommendations for remediation

## Dashboard Summary

### Understanding the Summary Panel

The summary panel displays key metrics at a glance:

| Metric | Description |
|--------|-------------|
| **Total Vulnerabilities** | Combined count of all detected vulnerabilities |
| **Critical** | Vulnerabilities requiring immediate attention (CVSS 9.0-10.0) |
| **High** | Serious vulnerabilities to address promptly (CVSS 7.0-8.9) |
| **Medium** | Moderate risk vulnerabilities (CVSS 4.0-6.9) |
| **Low** | Minor issues for backlog prioritization (CVSS 0.1-3.9) |
| **Security Score** | Overall score from 0-10 (10 = perfect) |
| **Active Scans** | Number of currently running scans |

### Security Score Calculation

The security score is calculated based on vulnerability severity:

```
Base Score: 10.0 (perfect)
Deductions:
  - Critical: -1.0 point each
  - High: -0.5 points each
  - Medium: -0.2 points each
  - Low: -0.1 points each

Additional scaling for >50 total vulnerabilities
```

**Score Interpretation:**
- **9.0-10.0**: Excellent security posture
- **7.0-8.9**: Good, minor improvements needed
- **5.0-6.9**: Fair, action recommended
- **3.0-4.9**: Poor, immediate action required
- **0.0-2.9**: Critical, security emergency

## Managing Scans

### Starting a New Scan

1. Navigate to **Security Dashboard** → **New Scan**
2. Select scan type:
   - **Container**: Scan Docker images for vulnerabilities
   - **Dockerfile**: Analyze Dockerfiles for security issues
   - **Kubernetes**: Scan K8s manifests for misconfigurations
3. Enter the target:
   - Container: `image:tag` (e.g., `nginx:latest`)
   - Dockerfile: Path to Dockerfile
   - Kubernetes: Path to manifest file
4. Click **Start Scan**

### Scan Status

| Status | Description |
|--------|-------------|
| `pending` | Scan queued, waiting to start |
| `running` | Scan in progress |
| `completed` | Scan finished successfully |
| `failed` | Scan encountered an error |

### Viewing Scan Results

1. Click on any scan in the **Recent Scans** table
2. Review vulnerability details:
   - Severity level and CVSS score
   - Affected package name and version
   - Fixed version (if available)
   - CVE references for more information

## Vulnerability Management

### Filtering Vulnerabilities

Use filters to focus on specific vulnerabilities:

- **By Severity**: Filter to Critical, High, Medium, or Low
- **By Package**: Search by package name
- **By Scan**: View vulnerabilities from a specific scan

### Vulnerability Details

Each vulnerability entry includes:

| Field | Description |
|-------|-------------|
| **Vulnerability ID** | CVE identifier (e.g., CVE-2024-1234) |
| **Severity** | CRITICAL, HIGH, MEDIUM, or LOW |
| **Title** | Brief description of the vulnerability |
| **Package Name** | Affected software package |
| **Installed Version** | Currently deployed version |
| **Fixed Version** | Version that patches the vulnerability |
| **CVSS Score** | Common Vulnerability Scoring System rating |
| **References** | Links to detailed CVE information |

### Remediation Workflow

1. **Prioritize Critical/High**: Address these first
2. **Check Fixed Version**: Upgrade to the patched version
3. **Test Upgrades**: Validate in staging environment
4. **Re-scan**: Verify vulnerability is resolved
5. **Document**: Track remediation in your issue tracker

## Security Metrics

### Accessing Metrics

Navigate to **Security Dashboard** → **Metrics** to view:

- **Scan Statistics**
  - Total number of scans performed
  - Average vulnerabilities per scan
  - Maximum/minimum vulnerability counts

- **Vulnerability Distribution**
  - Pie chart showing severity breakdown
  - Total count across all severities

- **Risk Level Assessment**
  - Automated risk classification
  - Based on vulnerability counts and patterns

### Risk Level Definitions

| Level | Criteria | Recommended Action |
|-------|----------|-------------------|
| **LOW** | No critical, few high/medium | Maintain practices |
| **MEDIUM** | Some high or many medium | Schedule remediation |
| **HIGH** | Critical present or many high | Prioritize fixes |
| **CRITICAL** | Multiple critical vulnerabilities | Immediate action required |

## Trend Analysis

### Viewing Trends

The dashboard tracks historical data:

1. **Vulnerability History**: 30-day trend of vulnerability counts
2. **Security Score History**: Score progression over time
3. **Scan Frequency**: How often scans are performed

### Interpreting Trends

**Positive Trends:**
- Declining total vulnerability count
- Improving security score
- Fewer critical/high findings over time

**Warning Signs:**
- Rising vulnerability counts
- Declining security score
- Increase in critical vulnerabilities

## Automated Recommendations

The system provides context-aware recommendations:

### Example Recommendations

```
"Immediate attention required for critical vulnerabilities"
→ You have >5 critical vulnerabilities

"Address critical and high-severity vulnerabilities"
→ You have critical or >10 high vulnerabilities

"Review and remediate high and medium-severity issues"
→ You have high or >20 medium vulnerabilities

"Consider implementing additional security controls"
→ Security score is below 7.0

"Start regular security scanning"
→ No scans have been performed
```

## Best Practices

### Regular Scanning

1. **Schedule automated scans**: Daily or on every deployment
2. **Scan all artifacts**: Containers, Dockerfiles, K8s manifests
3. **Monitor trends**: Watch for pattern changes

### Vulnerability Response

1. **Set SLAs by severity**:
   - Critical: 24 hours
   - High: 7 days
   - Medium: 30 days
   - Low: 90 days

2. **Establish escalation paths**:
   - Security team owns Critical
   - DevOps triages High
   - Development handles Medium/Low

3. **Document exceptions**:
   - False positives
   - Accepted risks
   - Compensating controls

### Integration Points

- **CI/CD Pipeline**: Add scans as gate checks
- **Alerting**: Configure notifications for new critical findings
- **Issue Tracking**: Auto-create tickets for vulnerabilities
- **GitOps**: Scan before deployments

## Troubleshooting

### Common Issues

**Scan fails to start:**
- Verify target is accessible
- Check Trivy service is running
- Ensure sufficient permissions

**No vulnerabilities shown:**
- Confirm scans have completed
- Check database connectivity
- Verify Trivy database is updated

**Score not updating:**
- Allow time for aggregation
- Check trend data calculation
- Review scan completion status

### Getting Help

- Check `docs/troubleshooting.md` for common issues
- Review logs in application console
- Contact security team for urgent issues

## Related Documentation

- [Export Wizard Guide](./export-wizard.md) - Export security configurations
- [Import Manager Guide](./import-manager.md) - Import security policies
- [GitOps Workflow Guide](./gitops-workflow.md) - Automated security deployments
- [Development Setup](../development/setup.md) - Local environment configuration
