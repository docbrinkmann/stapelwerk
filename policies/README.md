# OPA Policies

This directory contains Rego policies used by the Policy Engine.

- policies/rego: source Rego files
- policies/wasm: compiled WASM bundles (generated)

Build prerequisites:
- Install the OPA CLI: https://www.openpolicyagent.org/docs/latest/#running-opa

Compile all policies to WASM:
- npm run build:opa:wasm

Compile a single policy:
- npm run build:opa:wasm -- p3_warn_high.rego

After compilation, you can update PolicyTemplate.definition to JSON like:
{"type":"opa-wasm","wasmPath":"policies/wasm/p3_warn_high.wasm","entrypoint":"policy/warn_high/warn","mode":"warn"}
