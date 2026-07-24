package policy.warn_high

default warn = false

warn {
  some f in input.findings
  f.severity == "HIGH"
}
