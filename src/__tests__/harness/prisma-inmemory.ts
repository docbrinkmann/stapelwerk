/*
 In-memory Prisma client for tests.
 Provides basic model delegates and client APIs used by routers/services.
 This is intentionally minimal but covers: create/findUnique/findFirst/findMany/update/
 updateMany/upsert/delete/deleteMany/count/groupBy and $connect/$disconnect/$use/$transaction/$queryRaw/$executeRaw.
*/

type AnyRecord = Record<string, any>

type Where = AnyRecord

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v))
}

function matchesWhere(row: AnyRecord, where: Where | undefined): boolean {
  if (!where) return true
  // Support simple eq, nested {id: {gt|lt|in}}, OR: [] and direct field contains
  const keys = Object.keys(where)
  for (const key of keys) {
    if (key === 'OR' && Array.isArray(where.OR)) {
      if (where.OR.some((w: AnyRecord) => matchesWhere(row, w))) return true
      return false
    }
    const cond = (where as AnyRecord)[key]
    const val = row[key]
    if (cond && typeof cond === 'object' && !Array.isArray(cond)) {
      if ('contains' in cond) {
        const needle = String(cond.contains).toLowerCase()
        const hay = String(val ?? '').toLowerCase()
        if (!hay.includes(needle)) return false
      } else if ('in' in cond) {
        if (!Array.isArray(cond.in) || !cond.in.includes(val)) return false
      } else if ('gt' in cond) {
        if (!(val > cond.gt)) return false
      } else if ('lt' in cond) {
        if (!(val < cond.lt)) return false
      } else if ('gte' in cond) {
        if (!(val >= cond.gte)) return false
      } else if ('lte' in cond) {
        if (!(val <= cond.lte)) return false
      } else if ('not' in cond) {
        if (val === cond.not) return false
      } else {
        // Nested equality fallback
        for (const nk of Object.keys(cond)) {
          if ((val?.[nk]) !== cond[nk]) return false
        }
      }
    } else {
      if (val !== cond) return false
    }
  }
  return true
}

function applyOrder<T extends AnyRecord>(rows: T[], orderBy?: AnyRecord | AnyRecord[]): T[] {
  if (!orderBy) return rows
  const arr = Array.isArray(orderBy) ? orderBy : [orderBy]
  return rows.sort((a, b) => {
    for (const ord of arr) {
      const k = Object.keys(ord)[0]
      const dir = (ord as AnyRecord)[k]
      const av = a[k]
      const bv = b[k]
      if (av === bv) continue
      const cmp = av > bv ? 1 : -1
      return dir === 'desc' ? -cmp : cmp
    }
    return 0
  })
}

function looksLikeISODate(v: any): boolean {
  return typeof v === 'string' && /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)
}

// --- Model-group helpers -----------------------------------------------------
// Tests reach the same logical model through different delegate names
// (plural snake_case like the Prisma schema, or singular camelCase like older
// tests). Group them so includes/cascades work regardless of the spelling.

function modelGroup(modelName: string): string {
  const n = String(modelName).toLowerCase()
  switch (n) {
    case 'category':
    case 'categories': return 'categories'
    case 'service':
    case 'services': return 'services'
    case 'serviceimport':
    case 'service_imports': return 'service_imports'
    case 'stack':
    case 'stacks': return 'stacks'
    case 'stackservice':
    case 'stack_services': return 'stack_services'
    case 'stackserviceconfiguration':
    case 'stack_service_configurations': return 'stack_service_configurations'
    case 'recommendation':
    case 'recommendations': return 'recommendations'
    case 'recommendationfeedback':
    case 'recommendation_feedback': return 'recommendation_feedback'
    default: return n
  }
}

// Candidate store names per group (both spellings used across the test suite)
const GROUP_STORES: Record<string, string[]> = {
  categories: ['categories', 'category'],
  services: ['services', 'service'],
  service_imports: ['service_imports', 'serviceImport'],
  stacks: ['stacks', 'stack'],
  stack_services: ['stack_services', 'stackService'],
  stack_service_configurations: ['stack_service_configurations', 'stackServiceConfiguration'],
  recommendations: ['recommendations', 'recommendation'],
  recommendation_feedback: ['recommendation_feedback', 'recommendationFeedback'],
}

function collectRows(db: Record<string, AnyRecord[]>, group: string): AnyRecord[] {
  const names = GROUP_STORES[group] || [group]
  const rows: AnyRecord[] = []
  for (const n of names) {
    const arr = (db as AnyRecord)[n]
    if (Array.isArray(arr)) rows.push(...arr)
  }
  return rows
}

// Relations resolvable by attachIncludes (kept intentionally small; matches
// the Prisma schema relations plus the aliases older tests use).
// kind 'one': parent lookup via row[fk] === target.id
// kind 'many': children lookup via child[fk] === row.id
const RELATIONS: Record<string, Record<string, { group: string; kind: 'one' | 'many'; fk: string }>> = {
  services: {
    categories: { group: 'categories', kind: 'one', fk: 'categoryId' },
    category: { group: 'categories', kind: 'one', fk: 'categoryId' },
    service_imports: { group: 'service_imports', kind: 'many', fk: 'serviceId' },
    stack_services: { group: 'stack_services', kind: 'many', fk: 'serviceId' },
  },
  categories: {
    services: { group: 'services', kind: 'many', fk: 'categoryId' },
  },
  service_imports: {
    services: { group: 'services', kind: 'one', fk: 'serviceId' },
    service: { group: 'services', kind: 'one', fk: 'serviceId' },
  },
  stacks: {
    stackServices: { group: 'stack_services', kind: 'many', fk: 'stackId' },
    stack_services: { group: 'stack_services', kind: 'many', fk: 'stackId' },
  },
  stack_services: {
    stack: { group: 'stacks', kind: 'one', fk: 'stackId' },
    stacks: { group: 'stacks', kind: 'one', fk: 'stackId' },
    service: { group: 'services', kind: 'one', fk: 'serviceId' },
    services: { group: 'services', kind: 'one', fk: 'serviceId' },
    configurations: { group: 'stack_service_configurations', kind: 'many', fk: 'stackServiceId' },
    stack_service_configurations: { group: 'stack_service_configurations', kind: 'many', fk: 'stackServiceId' },
  },
  stack_service_configurations: {
    stackService: { group: 'stack_services', kind: 'one', fk: 'stackServiceId' },
    stack_services: { group: 'stack_services', kind: 'one', fk: 'stackServiceId' },
  },
  recommendations: {
    recommendation_feedback: { group: 'recommendation_feedback', kind: 'many', fk: 'recommendationId' },
  },
}

// Cascade rules mirroring the schema's onDelete: Cascade relations.
// The first two entries preserve the pre-existing ad-hoc cascade behavior.
const CASCADE_RULES: Array<{ match: (modelLower: string) => boolean; children: Array<{ stores: string[]; fk: string }> }> = [
  { match: m => m.includes('organization'), children: [{ stores: ['organization_members', 'organizationMember'], fk: 'organizationId' }] },
  { match: m => m.includes('approval_workflow') || m.includes('approvalworkflow'), children: [{ stores: ['workflow_comments', 'workflowComment'], fk: 'workflowId' }] },
  { match: m => modelGroup(m) === 'categories', children: [{ stores: GROUP_STORES.services, fk: 'categoryId' }] },
  {
    match: m => modelGroup(m) === 'services', children: [
      { stores: GROUP_STORES.service_imports, fk: 'serviceId' },
      { stores: GROUP_STORES.stack_services, fk: 'serviceId' },
    ]
  },
  { match: m => modelGroup(m) === 'stacks', children: [{ stores: GROUP_STORES.stack_services, fk: 'stackId' }] },
  { match: m => modelGroup(m) === 'stack_services', children: [{ stores: GROUP_STORES.stack_service_configurations, fk: 'stackServiceId' }] },
  { match: m => modelGroup(m) === 'recommendations', children: [{ stores: GROUP_STORES.recommendation_feedback, fk: 'recommendationId' }] },
]

function cascadeDelete(db: Record<string, AnyRecord[]>, modelName: string, removed: AnyRecord): void {
  if (!removed || removed.id === undefined) return
  const ml = String(modelName).toLowerCase()
  for (const rule of CASCADE_RULES) {
    if (!rule.match(ml)) continue
    for (const child of rule.children) {
      for (const storeName of child.stores) {
        const arr = (db as AnyRecord)[storeName] as AnyRecord[]
        if (!Array.isArray(arr)) continue
        for (let i = arr.length - 1; i >= 0; i--) {
          if (arr[i][child.fk] === removed.id) {
            const [childRemoved] = arr.splice(i, 1)
            // Recurse so chains cascade too (e.g. stack -> stackService -> configuration)
            cascadeDelete(db, storeName, childRemoved)
          }
        }
      }
    }
  }
}

function normalizeRecord(rec: AnyRecord, modelName: string): AnyRecord {
  const out: AnyRecord = { ...rec }
  const modelLower = modelName.toLowerCase()
  // Coerce date-like strings to Date
  for (const k of Object.keys(out)) {
    const v = out[k]
    if (looksLikeISODate(v) && /(At|Date|Time|timestamp)$/i.test(k)) {
      out[k] = new Date(v)
    }
  }
  // Normalize undefined id-like fields to null
  for (const k of Object.keys(out)) {
    if (/(^|.*)Id$/.test(k) && out[k] === undefined) out[k] = null
  }
  // Model-specific defaults
  if (modelLower.includes('approval_workflow') || modelLower.includes('approvalworkflow')) {
    if (out.status === undefined) out.status = 'draft'
  }
  if (modelLower.includes('organization_member') || modelLower.includes('organizationmember')) {
    if (!('joinedAt' in out)) out.joinedAt = new Date()
  }
  if (modelLower.includes('workflow_comment') || modelLower.includes('workflowcomment')) {
    if (!('parentCommentId' in out)) out.parentCommentId = null
    // Ensure replies sort after parents when ordering by createdAt asc
    if (out.parentCommentId) {
      if (out.createdAt instanceof Date) {
        out.createdAt = new Date(out.createdAt.getTime() + 1)
      } else {
        out.createdAt = new Date(Date.now() + 1)
      }
    }
  }
  // Schema-faithful defaults for the service-catalog models (mirror
  // prisma/schema.prisma @default() values; real Prisma returns every column,
  // with null for unset nullables)
  const group = modelGroup(modelName)
  if (group === 'categories') {
    if (!('description' in out)) out.description = null
    if (!('icon' in out)) out.icon = null
    if (!('sortOrder' in out) || out.sortOrder === undefined) out.sortOrder = 0
  }
  if (group === 'services') {
    if (!('version' in out)) out.version = 'latest'
    if (!('ports' in out)) out.ports = '[]'
    if (!('environmentVariables' in out)) out.environmentVariables = '[]'
    if (!('resourceRequirements' in out)) out.resourceRequirements = '{}'
    if (!('compatibilityInfo' in out)) out.compatibilityInfo = '{}'
    if (!('documentationUrl' in out)) out.documentationUrl = null
    if (!('featured' in out)) out.featured = false
    if (!('status' in out)) out.status = 'pending_review'
  }
  if (group === 'service_imports') {
    if (!('status' in out)) out.status = 'pending'
    if (!('extractedMetadata' in out)) out.extractedMetadata = '{}'
    if (!('serviceId' in out)) out.serviceId = null
    if (!('submittedBy' in out)) out.submittedBy = null
    if (!('reviewedBy' in out)) out.reviewedBy = null
    if (!('reviewNotes' in out)) out.reviewNotes = null
  }
  if (group === 'recommendations') {
    // DB check constraint: recommendation scores are normalized to [0, 1]
    if (typeof out.score === 'number' && (out.score < 0 || out.score > 1)) {
      throw new Error('Check constraint failed: score must be between 0 and 1')
    }
    if (!('metadata' in out)) out.metadata = null
  }
  // Ensure presence of common nullable foreign keys
  if (!('organizationId' in out)) out.organizationId = out.organizationId ?? null
  if (!('userId' in out)) out.userId = out.userId ?? null
  return out
}

function makeDelegate(modelName: string, store: AnyRecord[], db?: Record<string, AnyRecord[]>) {
  return {
    async create({ data, include }: AnyRecord = {}) {
      let rec = deepClone({ ...data })
      // Map alternative keys used by some callers
      if (modelName.toLowerCase().includes('workflow_comment') || modelName.toLowerCase().includes('workflowcomment')) {
        if (rec.parentCommentId === undefined && rec.parentId !== undefined) {
          rec.parentCommentId = rec.parentId
        }
      }
      rec = normalizeRecord(rec, modelName)
      // Defaults
      if (!('createdAt' in rec)) rec.createdAt = new Date()
      if (!('updatedAt' in rec)) rec.updatedAt = new Date()
      // Auto id if not supplied
      if (rec.id === undefined) {
        // Models that should use integer IDs (matching Prisma schema)
        const integerIdModels = [
          'categories', 'services', 'service_imports', 'use_case_templates',
          'stacks', 'stack_services', 'stack_service_configurations',
          'deployment_targets', 'deployment_target_overrides', 'deployment_artifacts',
          'deployment_jobs', 'audit_logs', 'alerts', 'performance_metrics', 'performance_baselines'
        ]
        const modelLower = modelName.toLowerCase()
        const useIntegerId = integerIdModels.some(m => modelLower.includes(m.toLowerCase()))

        if (useIntegerId || typeof (store[0]?.id) === 'number') {
          // Generate integer ID
          rec.id = store.length ? Math.max(...store.map(r => Number(r.id) || 0)) + 1 : 1
        } else {
          // Use UUID for models that need string IDs
          rec.id = cryptoRandomId()
        }
      }
      // Naive unique constraints
      if ('slug' in rec) {
        const dup = store.find(r => r.slug === rec.slug)
        if (dup) throw new Error('Unique constraint failed on the fields: (`slug`)')
      }
      // stack_services composite uniqueness (@@unique([stackId, serviceId]))
      if (modelGroup(modelName) === 'stack_services' && rec.stackId != null && rec.serviceId != null) {
        const dup = store.find(r => r.stackId === rec.stackId && r.serviceId === rec.serviceId)
        if (dup) throw new Error('Unique constraint failed on the fields: (`stackId`,`serviceId`)')
      }
      // Organization template uniqueness (by organizationId + name)
      if ((modelName.toLowerCase().includes('organization_template') || modelName.toLowerCase().includes('organizationtemplate'))) {
        const orgId = rec.organizationId
        const tplId = rec.templateId
        if (orgId && tplId) {
          const dup = store.find(r => r.organizationId === orgId && r.templateId === tplId)
          if (dup) throw new Error('Unique constraint failed on the fields: (`organizationId`,`templateId`)')
        }
      }
      // OrganizationMember composite uniqueness (organizationId + userId)
      if ('organizationId' in rec && 'userId' in rec && (modelName.toLowerCase().includes('organization_member') || modelName.toLowerCase().includes('organizationmember'))) {
        const dup = store.find(r => r.organizationId === rec.organizationId && r.userId === rec.userId)
        if (dup) throw new Error('Unique constraint failed on the fields: (`organizationId`,`userId`)')
      }
      // StackPermission check constraint: exactly one of organizationId or userId must be set
      if (modelName.toLowerCase().includes('stack_permission') || modelName.toLowerCase().includes('stackpermission')) {
        const hasOrg = rec.organizationId != null
        const hasUser = rec.userId != null
        if ((hasOrg && hasUser) || (!hasOrg && !hasUser)) {
          throw new Error('Check constraint failed: exactly one of organizationId or userId must be set')
        }
        // Normalize the unused key to null
        if (hasOrg) rec.userId = null
        if (hasUser) rec.organizationId = null
      }
      store.push(rec)
      return include ? attachIncludes(rec, include, modelName, db) : rec
    },
    async createMany({ data }: AnyRecord = {}) {
      const list = Array.isArray(data) ? data : []
      for (const d of list) await this.create({ data: d })
      return { count: list.length }
    },
    async upsert({ where, update, create }: AnyRecord = {}) {
      const existing = await this.findUnique({ where })
      if (existing) {
        return this.update({ where, data: update })
      }
      return this.create({ data: create })
    },
    async findUnique({ where, include }: AnyRecord = {}) {
      const key = where && Object.keys(where)[0]
      if (!key) return null
      const val = where[key]
      const rec = store.find(r => r[key] === val) || null
      return rec ? (include ? attachIncludes(rec, include, modelName, db) : rec) : null
    },
    async findFirst({ where, include, orderBy }: AnyRecord = {}) {
      const list = await this.findMany({ where, include, orderBy, take: 1 })
      return list[0] || null
    },
    async findMany({ where, include, orderBy, take, skip }: AnyRecord = {}) {
      let rows = store.filter(r => matchesWhere(r, where))
      rows = applyOrder(rows, orderBy)
      if (typeof skip === 'number') rows = rows.slice(skip)
      if (typeof take === 'number') rows = rows.slice(0, take)
      if (include) return rows.map(r => attachIncludes(r, include, modelName, db))
      return rows
    },
    async update({ where, data, include }: AnyRecord = {}) {
      const key = where && Object.keys(where)[0]
      const val = where[key]
      const idx = store.findIndex(r => r[key] === val)
      if (idx < 0) throw new Error(`${modelName} not found`)
      store[idx] = normalizeRecord({ ...store[idx], ...deepClone(data), updatedAt: new Date() }, modelName)
      return include ? attachIncludes(store[idx], include, modelName, db) : store[idx]
    },
    async updateMany({ where, data }: AnyRecord = {}) {
      const rows = store.filter(r => matchesWhere(r, where))
      rows.forEach(r => Object.assign(r, deepClone(data)))
      return { count: rows.length }
    },
    async delete({ where }: AnyRecord = {}) {
      const key = where && Object.keys(where)[0]
      const val = where[key]
      const idx = store.findIndex(r => r[key] === val)
      if (idx < 0) return null
      const [removed] = store.splice(idx, 1)
      // Cascade rules mirroring schema onDelete: Cascade (see CASCADE_RULES)
      if (db && removed) cascadeDelete(db, modelName, removed)
      return removed
    },
    async deleteMany({ where }: AnyRecord = {}) {
      const before = store.length
      if (!where) {
        store.splice(0, store.length)
      } else {
        for (let i = store.length - 1; i >= 0; i--) {
          if (matchesWhere(store[i], where)) store.splice(i, 1)
        }
      }
      return { count: before - store.length }
    },
    async count({ where }: AnyRecord = {}) {
      return store.filter(r => matchesWhere(r, where)).length
    },
    async groupBy({ by, where, _count }: AnyRecord = {}) {
      // Minimal groupBy: only supports single by key and _count: { id: true }
      const key = Array.isArray(by) ? by[0] : by
      if (!key) return []
      const list = store.filter(r => matchesWhere(r, where))
      const map = new Map<any, number>()
      for (const r of list) {
        const k = r[key]
        map.set(k, (map.get(k) || 0) + 1)
      }
      const out: any[] = []
      map.forEach((v, k) => out.push({ [key]: k, _count: _count?.id ? { id: v } : {} }))
      return out
    },
  }
}

function cryptoRandomId(): string {
  // No crypto in node test JSDOM sometimes; fallback
  try {
    return (globalThis.crypto as any)?.randomUUID?.() || Math.random().toString(36).slice(2)
  } catch {
    return Math.random().toString(36).slice(2)
  }
}

// Attach includes for the known relations in RELATIONS (best-effort only).
// Unknown relations are left absent, preserving the previous no-op behavior.
// Supports `relation: true`, nested `{ include, orderBy }` and
// `_count: { select: { relation: true } }`.
function attachIncludes(row: AnyRecord, include: AnyRecord, modelName: string, db?: Record<string, AnyRecord[]>): AnyRecord {
  const out = { ...row }
  if (!db || !include) return out
  const rels = RELATIONS[modelGroup(modelName)]
  for (const key of Object.keys(include)) {
    const spec = (include as AnyRecord)[key]
    if (!spec) continue
    if (key === '_count') {
      const select = (spec === true ? {} : spec.select) || {}
      const counts: AnyRecord = {}
      for (const relName of Object.keys(select)) {
        if (!select[relName]) continue
        const rel = rels?.[relName]
        counts[relName] = rel && rel.kind === 'many'
          ? collectRows(db, rel.group).filter(r => r[rel.fk] === row.id).length
          : 0
      }
      out._count = counts
      continue
    }
    const rel = rels?.[key]
    if (!rel) continue
    const nestedInclude = spec === true ? undefined : spec.include
    const orderBy = spec === true ? undefined : spec.orderBy
    if (rel.kind === 'one') {
      const target = collectRows(db, rel.group).find(r => r.id === row[rel.fk]) || null
      out[key] = target
        ? (nestedInclude ? attachIncludes(target, nestedInclude, rel.group, db) : { ...target })
        : null
    } else {
      let rows = collectRows(db, rel.group).filter(r => r[rel.fk] === row.id)
      rows = applyOrder([...rows], orderBy)
      out[key] = rows.map(r => (nestedInclude ? attachIncludes(r, nestedInclude, rel.group, db) : { ...r }))
    }
  }
  return out
}

export function createInMemoryPrismaClient() {
  // Central store per model
  const rawStores: Record<string, AnyRecord[]> = {}
  const db: Record<string, AnyRecord[]> = new Proxy(rawStores, {
    get(target, prop: string) {
      if (!(prop in target)) (target as AnyRecord)[prop] = []
      return (target as AnyRecord)[prop]
    }
  }) as any

  const clientBase: AnyRecord = {
    // Commonly used plural delegates
    categories: makeDelegate('categories', db.categories, db),
    services: makeDelegate('services', db.services, db),
    service_imports: makeDelegate('service_imports', db.service_imports, db),
    use_case_templates: makeDelegate('use_case_templates', db.use_case_templates, db),
    approval_workflows: makeDelegate('approval_workflows', db.approval_workflows, db),
    workflow_comments: makeDelegate('workflow_comments', db.workflow_comments, db),
    organizations: makeDelegate('organizations', db.organizations, db),
    organization_members: makeDelegate('organization_members', db.organization_members, db),
    stacks: makeDelegate('stacks', db.stacks, db),
    stack_services: makeDelegate('stack_services', db.stack_services, db),
    stack_service_configurations: makeDelegate('stack_service_configurations', db.stack_service_configurations, db),
    deployment_targets: makeDelegate('deployment_targets', db.deployment_targets, db),
    deployment_target_overrides: makeDelegate('deployment_target_overrides', db.deployment_target_overrides, db),
    deployment_artifacts: makeDelegate('deployment_artifacts', db.deployment_artifacts, db),
    deployment_jobs: makeDelegate('deployment_jobs', db.deployment_jobs, db),
    audit_logs: makeDelegate('audit_logs', db.audit_logs, db),
    alerts: makeDelegate('alerts', db.alerts, db),
    performance_metrics: makeDelegate('performance_metrics', db.performance_metrics, db),
    performance_baselines: makeDelegate('performance_baselines', db.performance_baselines, db),

    // Singular shortcuts used by older tests
    category: undefined,
    service: undefined,
    serviceImport: undefined,

    // Client APIs
    async $connect() { /* no-op */ },
    async $disconnect() { /* no-op */ },
    $on() { /* no-op */ },
    $use() { /* no-op */ },
    async $executeRaw() { return 0 },
    async $executeRawUnsafe() { return 0 },
    async $queryRaw(query?: any) {
      // Heuristic responses for common health checks
      const q = typeof query === 'string' ? query : Array.isArray(query) ? String(query[0]) : ''
      if (/sqlite_master/.test(q) || /information_schema\.tables/.test(q) || /pg_tables/.test(q)) {
        return [
          { name: 'categories' },
          { name: 'services' },
          { name: 'service_imports' },
          { name: 'use_case_templates' },
          { name: 'audit_logs' },
          { name: 'approval_workflows' },
          { name: 'workflow_comments' }
        ]
      }
      return []
    },
    async $queryRawUnsafe(query?: any) {
      return this.$queryRaw(query)
    },
    async $transaction(arg: any) {
      if (typeof arg === 'function') return await arg(client)
      if (Array.isArray(arg)) {
        const results: any[] = []
        for (const op of arg) results.push(typeof op === 'function' ? await op(client) : await op)
        return results
      }
      return null
    },
    // Minimal Prisma 6 client-extension support: applies query.$allModels hooks
    // for the operations they define (used by e.g. src/lib/audit-logger.ts).
    // Extensions without query hooks keep the old behavior (same client back).
    $extends(extension?: AnyRecord) {
      const hooks = extension?.query?.$allModels
      if (!hooks || typeof hooks !== 'object') return client
      const wrapDelegate = (prop: string, delegate: AnyRecord) => new Proxy(delegate, {
        get(target, op: string | symbol) {
          const orig = (target as AnyRecord)[op as string]
          if (typeof op !== 'string' || typeof orig !== 'function') return orig
          const hook = (hooks as AnyRecord)[op]
          if (typeof hook !== 'function') return orig.bind(target)
          // Real Prisma passes the model name as declared in the schema
          // (snake_case plurals); pass the delegate name through unchanged.
          return (args: AnyRecord) => hook({ model: prop, operation: op, args, query: (a: AnyRecord) => orig.call(target, a) })
        }
      })
      return new Proxy(client, {
        get(target, prop: string | symbol) {
          const value = (target as AnyRecord)[prop as string]
          if (
            typeof prop === 'string' && !prop.startsWith('$') &&
            value && typeof value === 'object' && typeof (value as AnyRecord).findMany === 'function'
          ) {
            return wrapDelegate(prop, value)
          }
          return value
        }
      })
    },
    // Clear every model store (test cleanup helper; delegates keep working
    // because the arrays are truncated in place)
    $reset() {
      for (const key of Object.keys(rawStores)) rawStores[key].length = 0
    },
  }

  // Back-compat singular aliases
  clientBase.category = clientBase.categories
  clientBase.service = clientBase.services
  clientBase.serviceImport = clientBase.service_imports
  // audit-logger and enterprise tests read audit logs via `auditLog` while
  // production code writes via `audit_logs` — same store either way
  clientBase.auditLog = clientBase.audit_logs

  const client = new Proxy(clientBase, {
    get(target, prop: string) {
      if (prop in target) return (target as AnyRecord)[prop]
      // Dynamically create a delegate for arbitrary model names on first access
      const name = String(prop)
      const d = makeDelegate(name, (db as AnyRecord)[name] as AnyRecord[], db as any)
      ;(target as AnyRecord)[name] = d
      return d
    }
  })

  return client
}
