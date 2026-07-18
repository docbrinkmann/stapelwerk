import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({ log: ['error'] })

async function test() {
  try {
    const category = await prisma.category.findFirst({ where: { slug: 'databases' } })
    console.log('✅ Category found:', category?.id)
    
    const service = await prisma.service.create({
      data: {
        name: 'Test MySQL',
        slug: 'test-mysql-' + Date.now(),
        description: 'MySQL test service',
        dockerImage: 'mysql:8.0',
        version: '8.0',
        categoryId: category!.id,
        ports: JSON.stringify([{ containerPort: 3306 }]),
        environmentVariables: JSON.stringify([]),
        resourceRequirements: JSON.stringify({ minCpu: 0.25, minMemory: 256 }),
        compatibilityInfo: JSON.stringify({ operatingSystems: ['linux'] }),
        status: 'approved',
      }
    })
    console.log('✅ Service created successfully:', service.name, 'ID:', service.id)
    
    // Count total services
    const count = await prisma.service.count()
    console.log('📊 Total services now:', count)
  } catch (e: any) {
    console.error('❌ Error:', e.message)
    if (e.meta) console.error('Meta:', e.meta)
  } finally {
    await prisma.$disconnect()
  }
}

test()
