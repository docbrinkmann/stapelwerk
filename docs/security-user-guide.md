# Security Features — User Guide (Initial)

- Policies: Manage via /api/security/policy and templates; OPA WASM supported (see policies/README.md).
- Exceptions: Create via /api/security/exceptions; approvals tracked in PolicyException.
- Exports: Trigger via /api/security/exports (PDF/JSON/CSV/SARIF). View on Org Security Dashboard.
- Remediation: Plan and run via /api/security/remediation/plan and /run.
- Scanning: Schedule Trivy scans via /api/security/scan.
- DAST: Baseline run via /api/security/dast/run.
- Home User Mode: enable with HOME_USER_MODE=true to enforce baseline policies.
