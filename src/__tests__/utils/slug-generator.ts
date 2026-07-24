/**
 * Utility function to generate URL-safe slugs from names
 * For use in test files
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, '') // Remove leading and trailing hyphens
}

// Generate test data with slugs
export function createCategoryData(name: string, description?: string | null, icon?: string | null, sortOrder?: number) {
  return {
    name,
    slug: generateSlug(name),
    description: description ?? undefined,
    icon: icon ?? undefined,
    sortOrder
  }
}

export function createServiceData(name: string, description: string, dockerImage: string, categoryId: number, additionalData?: any) {
  return {
    name,
    slug: generateSlug(name),
    description,
    dockerImage,
    categoryId,
    ...additionalData
  }
}