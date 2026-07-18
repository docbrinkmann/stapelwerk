package policy.block_critical

default deny = false

deny {
  some f in input.findings
  f.severity == "CRITICAL"
}
