import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function test() {
  try {
    // Clean database
    await prisma.service.deleteMany()
    await prisma.category.deleteMany()

    // Create a category
    const category = await prisma.category.create({
      data: {
        name: 'Test Category',
        slug: 'test-category',
        description: 'Test',
        sortOrder: 1
      }
    })

    console.log('Category created:')
    console.log('  ID:', category.id)
    console.log('  ID type:', typeof category.id)
    console.log('  Is integer?:', Number.isInteger(category.id))
    console.log('  Full object:', JSON.stringify(category, null, 2))
  } catch (error) {
    console.error('Error:', error.message)
    console.error('Stack:', error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

test()
