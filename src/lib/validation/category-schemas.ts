import { z } from 'zod'
import { PaginationSchema } from './service-catalog-schemas'
import { sanitizeString } from '../sanitization'

// Common slug validation regex - only lowercase letters, numbers, and hyphens
const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

// Base schema for category data
export const CategorySchema = z.object({
  name: z.string()
    .transform(sanitizeString) // Sanitize before validation
    .pipe(
      z.string()
        .min(2, { message: 'Category name must be at least 2 characters' })
        .max(100, { message: 'Category name cannot exceed 100 characters' })
    ),
  slug: z.string()
    .regex(slugRegex, { message: 'Slug must contain only lowercase letters, numbers, and hyphens' }),
  description: z.string()
    .transform(sanitizeString) // Sanitize descriptions
    .pipe(
      z.string()
        .min(10, { message: 'Description must be at least 10 characters' })
        .max(1000, { message: 'Description cannot exceed 1000 characters' })
    )
    .nullable()
    .optional(),
  icon: z.string().nullable().optional(),
  sortOrder: z.number().int().default(0)
})

// Schema for creating a new category
export const CategoryCreateSchema = CategorySchema

// Schema for updating an existing category
export const CategoryUpdateSchema = CategorySchema.omit({ slug: true })
  .partial()
  .extend({
    id: z.number().int().positive()
  })

// Schema for getting a category by ID
export const CategoryGetByIdSchema = z.object({
  id: z.number().int().positive()
})

// Schema for getting a category by slug
export const CategoryGetBySlugSchema = z.object({
  slug: z.string().regex(slugRegex, { message: 'Invalid slug format' })
})

// Schema for listing categories with pagination, searching, and filtering
export const CategoryListSchema = PaginationSchema.extend({
  search: z.string().optional(),
  withServiceCount: z.boolean().default(true)
})

// Schema for deleting a category
export const CategoryDeleteSchema = z.object({
  id: z.number().int().positive()
})

// Schema for category service listing
export const CategoryServicesSchema = PaginationSchema.extend({
  categoryId: z.number().int().positive(),
  status: z.string().optional(),
  search: z.string().optional()
})