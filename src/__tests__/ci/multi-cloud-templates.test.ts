import { describe, it, expect } from 'vitest'
import { renderMultiCloudPipelineTemplate } from '@/lib/deploy/ci'

function normalize(yaml: string) {
  return yaml.replace(/\s+/g, ' ')
}

describe('CI Templates - Multi-Cloud Pipeline Renderer', () => {
  it('renders EKS pipeline with policy gate, generate, and apply jobs', () => {
    const yaml = renderMultiCloudPipelineTemplate({ cloud: 'EKS', useAgent: false, terraformEmitSkeleton: false, manifestPath: 'out/eks/manifest.yaml' })
    const y = normalize(yaml)
    expect(y).toContain('include:')
    expect(y).toContain('.gitlab/ci/templates/k8s-apply.yml')
    expect(y).toContain('.gitlab/ci/templates/policy-gate.yml')
    expect(y).toContain('variables:')
    expect(y).toContain('CLOUD: "EKS"')
    expect(y).toContain('validate:policy')
    expect(y).toContain('npm run ci:policy-check')
    expect(y).toContain('generate:cloud')
    expect(y).toContain('artifacts:')
    expect(y).toContain('apply:eks')
    expect(y).toContain('needs: [generate:cloud]')
    expect(y).toContain('MANIFEST_PATH: "out/eks/manifest.yaml"')
  })

  it('renders GKE pipeline and includes Terraform emit job when flag is true', () => {
    const yaml = renderMultiCloudPipelineTemplate({ cloud: 'GKE', useAgent: true, kubeContext: 'gitlab-agent:group/proj:agent', terraformEmitSkeleton: true })
    const y = normalize(yaml)
    expect(y).toContain('CLOUD: "GKE"')
    expect(y).toContain('export KUBE_CONTEXT=')
    expect(y).toContain('emit:terraform')
    expect(y).toContain("if: '$TF_EMIT_SKELETON == \"true\"'")
  })

  it('renders AKS pipeline with correct apply job name', () => {
    const yaml = renderMultiCloudPipelineTemplate({ cloud: 'AKS', useAgent: false, terraformEmitSkeleton: false })
    expect(yaml).toContain('apply:aks')
  })
})
