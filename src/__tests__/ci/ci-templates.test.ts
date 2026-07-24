import { describe, it, expect } from 'vitest'
import { renderCiApplyTemplate } from '@/lib/deploy/ci'

describe('CI Templates - renderCiApplyTemplate', () => {
  it('renders include and variables with kubeconfig mode', () => {
    const yaml = renderCiApplyTemplate({ manifestPath: 'out/manifest.yaml', useAgent: false })
    expect(yaml).toContain("include:")
    expect(yaml).toContain(".gitlab/ci/templates/k8s-apply.yml")
    expect(yaml).toContain("MANIFEST_PATH: \"out/manifest.yaml\"")
    expect(yaml).toContain("k8s_apply:")
  })

  it('renders agent context line when useAgent=true', () => {
    const yaml = renderCiApplyTemplate({ manifestPath: 'out.yaml', useAgent: true, kubeContext: 'gitlab-agent:group/project:agent' })
    expect(yaml).toContain('export KUBE_CONTEXT=')
  })
})
