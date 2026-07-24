/**
 * Test-local AuditLogger stub.
 *
 * The enterprise test suites were written against an `AuditLogger` class from
 * '@/lib/audit/audit-logger', which does not exist in the codebase (production
 * code types the injected audit logger as `any` and only calls `.log(entry)`).
 * This stub implements that minimal contract and persists entries to the
 * in-memory `auditLog` model so tests can query them via `prisma.auditLog`.
 *
 * Do NOT move this into src/lib — it exists only to satisfy tests.
 */

import type { PrismaClient } from '@prisma/client'

export interface AuditLogEntry {
  action: string
  userId?: string
  organizationId?: string
  actorId?: string
  sessionId?: string
  metadata?: Record<string, unknown>
  timestamp?: Date
}

export class AuditLogger {
  constructor(private readonly prisma: PrismaClient) {}

  async log(entry: AuditLogEntry): Promise<Record<string, unknown>> {
    const client = this.prisma as unknown as {
      auditLog: { create: (args: { data: Record<string, unknown> }) => Promise<Record<string, unknown>> }
    }
    return client.auditLog.create({
      data: {
        id: (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)) as string,
        action: entry.action,
        userId: entry.userId ?? null,
        organizationId: entry.organizationId ?? null,
        actorId: entry.actorId ?? null,
        sessionId: entry.sessionId ?? null,
        metadata: entry.metadata ?? {},
        timestamp: entry.timestamp ?? new Date(),
      },
    })
  }
}
