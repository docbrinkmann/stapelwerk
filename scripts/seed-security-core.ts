import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function upsertFramework(key: string, name: string, version: string, description?: string) {
  return prisma.framework.upsert({
    where: { key },
    update: { name, version, description },
    create: { key, name, version, description },
  })
}

async function upsertControl(frameworkId: string, controlId: string, title: string, description?: string, category?: string, severity?: string) {
  return prisma.control.upsert({
    where: { frameworkId_controlId: { frameworkId, controlId } },
    update: { title, description, category, severity },
    create: { frameworkId, controlId, title, description, category, severity },
  })
}

const POLICY_TEMPLATES = [
  {
    key: 'p1_min_score',
    name: 'Minimum Security Score',
    version: '1.0.0',
    description: 'Deny if security score is below threshold (default 85)',
    definition: JSON.stringify({ type: 'opa-wasm', wasmPath: 'policies/wasm/p1_min_score.wasm', entrypoint: 'policy/min_score/deny', mode: 'deny' }),
    defaultParameters: JSON.stringify({ threshold_default: 85 })
  },
  {
    key: 'p2_block_critical',
    name: 'Block Critical Vulnerabilities',
    version: '1.0.0',
    description: 'Deny when any CRITICAL vulnerability is present',
    definition: JSON.stringify({ type: 'opa-wasm', wasmPath: 'policies/wasm/p2_block_critical.wasm', entrypoint: 'policy/block_critical/deny', mode: 'deny' }),
    defaultParameters: JSON.stringify({})
  },
  {
    key: 'p3_warn_high',
    name: 'Warn on High Vulnerabilities',
    version: '1.0.0',
    description: 'Warn (but do not deny) on HIGH vulnerabilities',
    definition: JSON.stringify({ type: 'opa-wasm', wasmPath: 'policies/wasm/p3_warn_high.wasm', entrypoint: 'policy/warn_high/warn', mode: 'warn' }),
    defaultParameters: JSON.stringify({})
  },
  {
    key: 'p4_required_frameworks',
    name: 'Required Frameworks Enabled',
    version: '1.0.0',
    description: 'Ensure specific compliance frameworks are enabled for the org',
    definition: JSON.stringify({ type: 'opa-wasm', wasmPath: 'policies/wasm/p4_required_frameworks.wasm', entrypoint: 'policy/required_frameworks/deny', mode: 'deny' }),
    defaultParameters: JSON.stringify({ required: ["soc2", "iso27001"] })
  },
  {
    key: 'p5_exception_approval',
    name: 'Exception Requires Approval',
    version: '1.0.0',
    description: 'Deny unless exception is approved and not expired',
    definition: JSON.stringify({ type: 'opa-wasm', wasmPath: 'policies/wasm/p5_exception_approval.wasm', entrypoint: 'policy/exception_approval/deny', mode: 'deny' }),
    defaultParameters: JSON.stringify({})
  }
]

async function main() {
  console.log('🌱 Seeding security core: frameworks, controls, policy templates ...')

  // Frameworks
  const soc2 = await upsertFramework('soc2', 'SOC 2', '2017', 'System and Organization Controls')
  const iso  = await upsertFramework('iso27001', 'ISO 27001', '2022', 'Information Security Management')
  const hipaa= await upsertFramework('hipaa', 'HIPAA', 'v1', 'Health Insurance Portability and Accountability Act')
  const gdpr = await upsertFramework('gdpr', 'GDPR', '2016', 'General Data Protection Regulation')

  // Minimal starter controls per framework
  await upsertControl(soc2.id, 'CC1.1', 'Control Environment', 'The entity demonstrates a commitment to integrity and ethical values.', 'governance', 'MEDIUM')
  await upsertControl(iso.id, 'A.5.1', 'Information security policies', 'Policies for information security are defined, approved, and communicated.', 'policy', 'MEDIUM')
  await upsertControl(hipaa.id, '164.308(a)(1)', 'Security Management Process', 'Implement policies and procedures to prevent, detect, contain, and correct security violations.', 'security', 'HIGH')
  await upsertControl(gdpr.id, 'Art.32', 'Security of processing', 'Appropriate technical and organisational measures to ensure a level of security appropriate to the risk.', 'security', 'HIGH')

  // Policy Templates
  for (const tpl of POLICY_TEMPLATES) {
    await prisma.policy_templates.upsert({
      where: { key: tpl.key },
      update: { name: tpl.name, version: tpl.version, description: tpl.description, definition: tpl.definition, defaultParameters: tpl.defaultParameters },
      create: { key: tpl.key, name: tpl.name, version: tpl.version, description: tpl.description, definition: tpl.definition, defaultParameters: tpl.defaultParameters },
    })
    console.log(`✅ Policy template upserted: ${tpl.key}`)
  }

  console.log('✅ Security core seed completed')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
}).finally(async () => {
  await prisma.$disconnect()
})
