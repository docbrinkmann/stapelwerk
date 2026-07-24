import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const SECURITY_FLAGS = [
  {
    key: 'compliance_engine',
    name: 'Compliance Engine',
    description: 'Enable compliance framework engine (SOC2, ISO27001, HIPAA, GDPR)',
    type: 'boolean',
    defaultValue: 'false',
    enabled: false,
    environments: JSON.stringify(['development']),
    rolloutPercentage: 0,
    tags: JSON.stringify(['security','compliance'])
  },
  {
    key: 'policy_engine',
    name: 'Policy Engine (OPA/Rego)',
    description: 'Enable OPA/Rego policy engine and templates',
    type: 'boolean',
    defaultValue: 'false',
    enabled: false,
    environments: JSON.stringify(['development']),
    rolloutPercentage: 0,
    tags: JSON.stringify(['security','policy'])
  },
  {
    key: 'remediation',
    name: 'Automated Remediation',
    description: 'Enable automated remediation workflows (dry-run/test-first)',
    type: 'boolean',
    defaultValue: 'false',
    enabled: false,
    environments: JSON.stringify(['development']),
    rolloutPercentage: 0,
    tags: JSON.stringify(['security','remediation'])
  },
  {
    key: 'dast',
    name: 'DAST',
    description: 'Enable OWASP ZAP-like DAST baseline scanning',
    type: 'boolean',
    defaultValue: 'false',
    enabled: false,
    environments: JSON.stringify(['development']),
    rolloutPercentage: 0,
    tags: JSON.stringify(['security','dast'])
  },
  {
    key: 'home_user_mode',
    name: 'Home User Mode',
    description: 'Enable simplified security defaults for home users',
    type: 'boolean',
    defaultValue: 'false',
    enabled: false,
    environments: JSON.stringify(['development']),
    rolloutPercentage: 0,
    tags: JSON.stringify(['security','home'])
  }
]

async function main() {
  console.log('🌱 Seeding security feature flags...')

  for (const flag of SECURITY_FLAGS) {
    await prisma.featureFlag.upsert({
      where: { key: flag.key },
      update: {
        name: flag.name,
        description: flag.description,
        type: flag.type,
        defaultValue: flag.defaultValue,
        enabled: flag.enabled,
        environments: flag.environments,
        rolloutPercentage: flag.rolloutPercentage,
        tags: flag.tags,
      },
      create: flag,
    })
    console.log(`✅ Upserted flag: ${flag.key}`)
  }

  console.log('✅ Security feature flags seed complete')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
}).finally(async () => {
  await prisma.$disconnect()
})
