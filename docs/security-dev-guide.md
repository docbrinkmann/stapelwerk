# Security Developer Guide (Initial)

- Policy authoring: write Rego in policies/rego; compile with npm run build:opa:wasm; set PolicyTemplate.definition to {type:'opa-wasm', wasmPath, entrypoint, mode}.
- Bundle management: opa loader caches policies; replace wasmPath to upgrade.
- Data model: see prisma/schema.prisma for policies, templates, exceptions, findings, evidence, exports, remediation runs.
- CI usage: .github/workflows/opa.yml compiles and tests; policy-check.yml enforces gates.
