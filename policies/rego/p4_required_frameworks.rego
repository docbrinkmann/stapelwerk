package policy.required_frameworks

default deny = false

required := input.parameters.required

deny {
  some rf in required
  not rf in input.enabled_frameworks
}
