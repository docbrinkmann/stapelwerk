import { z } from 'zod'

export const CiApplyTemplateInput = z.object({
  manifestPath: z.string().default('manifest.yaml'),
  useAgent: z.boolean().default(false),
  kubeContext: z.string().optional(),
})

export type CiApplyTemplateInput = z.infer<typeof CiApplyTemplateInput>

export function renderCiApplyTemplate(input: CiApplyTemplateInput) {
  const ctxLine = input.useAgent && input.kubeContext
    ? `# Using agent context\n      - export KUBE_CONTEXT=\"${input.kubeContext}\"\n`
    : `# Using KUBECONFIG_B64 (set in CI Variables)\n`
  return `include:\n  - local: \".gitlab/ci/templates/k8s-apply.yml\"\n\nvariables:\n  MANIFEST_PATH: \"${input.manifestPath}\"\n  DRY_RUN: \"client\"\n\nk8s_apply:\n  stage: deploy\n  extends: .k8s_apply_base\n  before_script:\n    - echo 'Preparing apply'\n${ctxLine}`
}

// Multi-Cloud pipeline renderer for EKS/GKE/AKS with policy gating and optional Terraform emit
export const MultiCloudInput = z.object({
  cloud: z.enum(['EKS', 'GKE', 'AKS']),
  manifestPath: z.string().default('out/manifest.yaml'),
  useAgent: z.boolean().default(false),
  kubeContext: z.string().optional(),
  terraformEmitSkeleton: z.boolean().default(false),
})

export type MultiCloudInput = z.infer<typeof MultiCloudInput>

export function renderMultiCloudPipelineTemplate(input: MultiCloudInput) {
  const ctxLine = input.useAgent && input.kubeContext
    ? `      - export KUBE_CONTEXT=\"${input.kubeContext}\"\n`
    : ''
  const tfJob = input.terraformEmitSkeleton
    ? `emit:terraform:\n  stage: validate\n  image: node:18-alpine\n  script:\n    - echo 'Emitting Terraform skeleton for ${input.cloud}'\n    - mkdir -p out/${input.cloud.toLowerCase()}/terraform\n    - echo '# terraform skeleton' > out/${input.cloud.toLowerCase()}/terraform/README.md\n  rules:\n    - if: '$TF_EMIT_SKELETON == \"true\"'\n  artifacts:\n    paths:\n      - out/${input.cloud.toLowerCase()}/terraform\n`
    : ''

  const manifestRel = `out/${input.cloud.toLowerCase()}/manifest.yaml`

  return `include:\n  - local: \".gitlab/ci/templates/k8s-apply.yml\"\n  - local: \".gitlab/ci/templates/policy-gate.yml\"\n  - local: \".gitlab/ci/templates/multi-cloud.yml\"\n\nvariables:\n  CLOUD: \"${input.cloud}\"\n  MANIFEST_PATH: \"${manifestRel}\"\n  DRY_RUN: \"client\"\n\nvalidate:policy:\n  stage: validate\n  extends: .policy_gate_base\n  script:\n    - npm run ci:policy-check\n  artifacts:\n    when: always\n    paths:\n      - policy-report.json\n\ngenerate:cloud:\n  stage: generate\n  image: node:18-alpine\n  script:\n    - echo "Generating artifacts for ${input.cloud}"\n    - mkdir -p out/${input.cloud.toLowerCase()}\n    - node -e \"require('fs').writeFileSync('${manifestRel}', 'apiVersion: v1\\nkind: ConfigMap\\nmetadata: {name: sample}\\n')\"\n  artifacts:\n    paths:\n      - ${manifestRel}\n  needs: [validate:policy]\n\napply:${input.cloud.toLowerCase()}:\n  stage: deploy\n  extends: .k8s_apply_base\n  before_script:\n    - echo 'Preparing apply for ${input.cloud}'\n${ctxLine}  needs: [generate:cloud]\n  rules:\n    - if: '$CI_PIPELINE_SOURCE == \"merge_request_event\"'\n${tfJob}`
}
