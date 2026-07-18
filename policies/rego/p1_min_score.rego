package policy.min_score

default deny = false

threshold := input.parameters.threshold_default

deny {
  input.security_score < threshold
}
