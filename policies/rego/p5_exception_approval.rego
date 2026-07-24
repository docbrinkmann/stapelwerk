package policy.exception_approval

default deny = false

deny {
  input.exception.requested
  not input.exception.approved
}
