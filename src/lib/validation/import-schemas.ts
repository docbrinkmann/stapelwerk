import { z } from 'zod'
import { PaginationSchema } from './service-catalog-schemas'
import { sanitizeString } from '../sanitization'

// Import source types
export const ImportSourceType = {
  DOCKER_HUB: 'docker_hub',
  GITHUB: 'github',
  MANUAL: 'manual'
} as const

// Import statuses
export const ImportStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  APPROVED: 'approved',
  REJECTED: 'rejected'
} as const

// Schema for creating a new import
export const ImportCreateSchema = z.object({
  sourceUrl: z.string().min(1, { message: 'Source URL is required' }),
  sourceType: z.nativeEnum(ImportSourceType),
  categoryId: z.coerce.number().int().positive({ message: 'Valid category ID is required' }),
  submittedBy: z.string()
    .transform(sanitizeString) // Strip injected markup from submitter identifiers
    .pipe(z.string().min(1, { message: 'Submitter is required' }))
})

// Schema for listing imports with filtering
export const ImportListSchema = PaginationSchema.extend({
  status: z.nativeEnum(ImportStatus).optional(),
  sourceType: z.nativeEnum(ImportSourceType).optional(),
  search: z.string().optional(),
  submittedBy: z.string().optional()
})

// Schema for getting import by ID
export const ImportGetSchema = z.object({
  id: z.coerce.number().int().positive()
})

// Schema for approving an import
export const ImportApproveSchema = z.object({
  id: z.coerce.number().int().positive(),
  reviewedBy: z.string().min(1, { message: 'Reviewer is required' }),
  reviewNotes: z.string().optional()
})

// Schema for rejecting an import
export const ImportRejectSchema = z.object({
  id: z.coerce.number().int().positive(),
  reviewedBy: z.string().min(1, { message: 'Reviewer is required' }),
  reviewNotes: z.string().min(1, { message: 'Review notes are required for rejection' })
})

// Schema for deleting an import
export const ImportDeleteSchema = z.object({
  id: z.coerce.number().int().positive()
})

// Schema for bulk operations
export const ImportBulkActionSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(50), // Limit to 50 items
  action: z.enum(['approve', 'reject', 'delete']),
  reviewedBy: z.string().min(1),
  reviewNotes: z.string().optional()
})