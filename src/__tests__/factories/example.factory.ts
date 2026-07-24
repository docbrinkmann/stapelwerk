import { Prisma } from '@prisma/client'
import { faker } from '@faker-js/faker'
import { generateSlug } from '../utils/slug-generator'

// Category factory for creating test data
export class CategoryFactory {
  // Create a single category with default or custom data
  static create(overrides: Partial<Prisma.CategoryCreateInput> = {}): Prisma.CategoryCreateInput {
    const name = overrides.name || faker.lorem.words(2)
    return {
      name,
      slug: generateSlug(name),
      description: faker.lorem.sentence(),
      sortOrder: faker.number.int({ min: 1, max: 100 }),
      ...overrides,
    }
  }

  // Create multiple categories
  static createMany(count: number, overrides: Partial<Prisma.CategoryCreateInput> = {}): Prisma.CategoryCreateInput[] {
    return Array.from({ length: count }, () => this.create(overrides))
  }

  // Create category with specific patterns
  static createWithName(name: string): Prisma.CategoryCreateInput {
    return this.create({ name, slug: generateSlug(name) })
  }

  // Create category with random but valid data
  static createValid(): Prisma.CategoryCreateInput {
    const name = faker.company.name()
    return {
      name,
      slug: generateSlug(name),
      description: faker.lorem.sentence(),
      sortOrder: faker.number.int({ min: 1, max: 100 }),
    }
  }

  // Create category with invalid data (for testing validation)
  static createInvalid(): Partial<Prisma.CategoryCreateInput> {
    return {
      // Empty name (assuming name is required)
      name: '',
      slug: '',
    }
  }

  // Create categories for specific test scenarios
  static createForSearch(): Prisma.CategoryCreateInput[] {
    return [
      this.createWithName('Alpha Product'),
      this.createWithName('Beta Service'),
      this.createWithName('Gamma Solution'),
      this.createWithName('Alpha Test'),
      this.createWithName('Other Item'),
    ]
  }

  // Create categories for pagination testing
  static createForPagination(count: number = 25): Prisma.CategoryCreateInput[] {
    return Array.from({ length: count }, (_, index) => 
      this.createWithName(`Category ${index + 1}`)
    )
  }

  // Create categories for sorting tests
  static createForSorting(): Prisma.CategoryCreateInput[] {
    return [
      this.createWithName('Charlie'),
      this.createWithName('Alpha'),
      this.createWithName('Bravo'),
    ]
  }
}

// Base factory class for extending
export abstract class BaseFactory<T> {
  abstract create(overrides?: Partial<T>): T
  
  createMany(count: number, overrides?: Partial<T>): T[] {
    return Array.from({ length: count }, () => this.create(overrides))
  }
}

// Export default
export default CategoryFactory
