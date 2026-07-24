/**
 * Helpers to bridge gaps between production Prisma queries and the in-memory
 * Prisma harness (src/__tests__/harness/prisma-inmemory.ts):
 *
 * - The harness does not understand composite unique keys such as
 *   `where: { organizationId_userId: { ... } }` (findUnique matches the first
 *   where key by strict equality). Production organization code relies on it.
 * - The harness never attaches `include` relations (attachIncludes is a no-op),
 *   but some production code reads `membership.organizations` from includes.
 *
 * These patches wrap the shared delegate instances (one per test file) with
 * plain functions, so they are unaffected by vitest's global mockReset.
 */

type AnyArgs = Record<string, any>

export function patchOrganizationMembersDelegate(prisma: any): void {
  const delegate = prisma.organization_members
  if (delegate.__testCompositePatched) return
  delegate.__testCompositePatched = true

  const origFindUnique = delegate.findUnique.bind(delegate)
  const origFindFirst = delegate.findFirst.bind(delegate)
  const origFindMany = delegate.findMany.bind(delegate)
  const origUpdate = delegate.update.bind(delegate)
  const origDelete = delegate.delete.bind(delegate)

  async function resolveWhere(where: AnyArgs | undefined): Promise<AnyArgs | undefined> {
    if (where?.organizationId_userId) {
      const { organizationId, userId } = where.organizationId_userId
      const row = await origFindFirst({ where: { organizationId, userId } })
      return { id: row ? row.id : '__no_such_row__' }
    }
    return where
  }

  async function attachOrganization(row: AnyArgs | null, include: AnyArgs | undefined): Promise<AnyArgs | null> {
    if (!row || !include?.organizations) return row
    const org = await prisma.organizations.findUnique({ where: { id: row.organizationId } })
    return { ...row, organizations: org ?? null }
  }

  delegate.findUnique = async function (args: AnyArgs = {}) {
    const where = await resolveWhere(args.where)
    const row = await origFindUnique({ ...args, where, include: undefined })
    return attachOrganization(row, args.include)
  }

  delegate.findFirst = async function (args: AnyArgs = {}) {
    const row = await origFindFirst({ ...args, include: undefined })
    return attachOrganization(row, args.include)
  }

  delegate.findMany = async function (args: AnyArgs = {}) {
    const rows = await origFindMany({ ...args, include: undefined })
    if (!args.include?.organizations) return rows
    return Promise.all(rows.map((row: AnyArgs) => attachOrganization(row, args.include)))
  }

  delegate.update = async function (args: AnyArgs = {}) {
    const where = await resolveWhere(args.where)
    return origUpdate({ ...args, where })
  }

  delegate.delete = async function (args: AnyArgs = {}) {
    const where = await resolveWhere(args.where)
    return origDelete({ ...args, where })
  }
}

/**
 * The harness enforces no unique constraints beyond `slug`; tests that assert
 * unique-token rejection can install this guard on a delegate.
 */
export function enforceUniqueField(delegate: any, field: string): void {
  const flag = `__testUnique_${field}`
  if (delegate[flag]) return
  delegate[flag] = true

  const origCreate = delegate.create.bind(delegate)
  delegate.create = async function (args: AnyArgs = {}) {
    const value = args?.data?.[field]
    if (value !== undefined) {
      const dup = await delegate.findFirst({ where: { [field]: value } })
      if (dup) {
        throw new Error(`Unique constraint failed on the fields: (\`${field}\`)`)
      }
    }
    return origCreate(args)
  }
}
