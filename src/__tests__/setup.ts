import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { vi, afterEach } from 'vitest'
import React from 'react'
import { TextEncoder, TextDecoder } from 'util'
import { ReadableStream } from 'stream/web'

// Clean up DOM after each test to prevent "multiple elements" errors
afterEach(() => {
  cleanup()
})

// Polyfill missing globals for jsdom environment
// These are required for MSW v2, Next.js 15, and modern web APIs
if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder
}
if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = TextDecoder as any
}
if (typeof global.ReadableStream === 'undefined') {
  global.ReadableStream = ReadableStream as any
}

// Fix Date constructor in jsdom (sometimes broken in test environment)
if (typeof global.Date === 'undefined') {
  global.Date = Date
}

// Ensure clearInterval/setInterval exist globally
if (typeof global.clearInterval === 'undefined') {
  global.clearInterval = clearInterval
}
if (typeof global.setInterval === 'undefined') {
  global.setInterval = setInterval
}
if (typeof global.setTimeout === 'undefined') {
  global.setTimeout = setTimeout
}
if (typeof global.clearTimeout === 'undefined') {
  global.clearTimeout = clearTimeout
}

// Ensure window has all necessary properties for Framer Motion
if (typeof window !== 'undefined') {
  // Polyfill getComputedStyle if needed
  if (!window.getComputedStyle) {
    window.getComputedStyle = (elt: Element) => {
      return {
        getPropertyValue: () => '',
      } as CSSStyleDeclaration
    }
  }
  
  // Ensure scrollIntoView exists
  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = vi.fn()
  }
}

// Mock window.matchMedia for components using prefers-reduced-motion
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  configurable: true,
  value: (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as MediaQueryList),
})

// Mock Prisma client globally for tests to avoid hitting real DB.
// All prisma entry points MUST share ONE in-memory client — separate
// instances meant routers wrote to one database while assertions read
// another. Dynamic imports because vi.mock factories are hoisted.
vi.mock('@/lib/database/prisma', async () => {
  const { getSharedInMemoryClient } = await import('./harness/shared-client')
  return {
    prisma: getSharedInMemoryClient(),
    disconnectPrisma: vi.fn(async () => {}),
    checkDatabaseConnection: vi.fn(async () => true),
  }
})

// Also mock alternative db utils path used in some modules.
// Pass through the real module's pure helpers (validateDatabaseUrl,
// createDatabaseConnection, closeDatabaseConnection, checkDatabaseHealth, …)
// so tests exercising them keep working; only the prisma instance and the
// connection helpers are replaced. Importing the original is safe: its
// `new PrismaClient()` resolves to the in-memory client via the alias/mock.
vi.mock('@/lib/db-utils', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  const { getSharedInMemoryClient } = await import('./harness/shared-client')
  return {
    ...actual,
    prisma: getSharedInMemoryClient(),
    disconnectPrisma: vi.fn(async () => {}),
    checkDatabaseConnection: vi.fn(async () => true),
  }
})

// Mock direct PrismaClient constructor from @prisma/client to use the
// SHARED in-memory client (same instance as the alias proxy, so routers
// and test assertions see the same database)
vi.mock('@prisma/client', async () => {
  // Dynamic import: vi.mock factories are hoisted and must not close over
  // top-level variables
  const { getSharedInMemoryClient } = await import('./harness/shared-client')
  return {
    // Must be a PLAIN function (not vi.fn()): `new PrismaClient()` needs a
    // constructor, and the global mockReset (vitest.config `mockReset: true`)
    // wipes implementations added via .mockImplementation() before each test,
    // which made mid-test constructions return empty objects.
    PrismaClient: function PrismaClient(_options?: any) { return getSharedInMemoryClient() } as any,
    Prisma: {
      Decimal: class Decimal {
        private v: any; constructor(v: any) { this.v = v }
        toNumber() { return Number(this.v) }
        toString() { return String(this.v) }
        valueOf() { return Number(this.v) }
      }
    }
  }
})

// Mock Framer Motion to prevent initialization issues in tests
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>('framer-motion')
  return {
    ...actual,
    motion: new Proxy(actual.motion, {
      get: (target, prop) => {
        if (typeof prop === 'string') {
          return React.forwardRef((props: any, ref) => {
            const Component = prop as keyof JSX.IntrinsicElements
            return React.createElement(Component, { ...props, ref })
          })
        }
        return target[prop as keyof typeof target]
      },
    }),
  }
})

// Ensure window.localStorage/sessionStorage exist for zustand persist in tests
try {
  if (typeof window !== 'undefined' && (!('localStorage' in window) || !window.localStorage)) {
    const LocalMemory = class implements Storage {
      private m = new Map<string, string>()
      get length() { return this.m.size }
      clear(): void { this.m.clear() }
      getItem(key: string): string | null { return this.m.has(key) ? this.m.get(key)! : null }
      key(index: number): string | null { return Array.from(this.m.keys())[index] ?? null }
      removeItem(key: string): void { this.m.delete(key) }
      setItem(key: string, value: string): void { this.m.set(key, String(value)) }
    }
    Object.defineProperty(window, 'localStorage', {
      value: new LocalMemory(),
      configurable: true,
    })
  }
} catch (error) {
  // Ignore SecurityError when jsdom/happy-dom prevents localStorage initialization
  // Tests that need localStorage will use mocked versions
}

try {
  if (typeof window !== 'undefined' && (!('sessionStorage' in window) || !window.sessionStorage)) {
    const SessionMemory = class implements Storage {
      private m = new Map<string, string>()
      get length() { return this.m.size }
      clear(): void { this.m.clear() }
      getItem(key: string): string | null { return this.m.has(key) ? this.m.get(key)! : null }
      key(index: number): string | null { return Array.from(this.m.keys())[index] ?? null }
      removeItem(key: string): void { this.m.delete(key) }
      setItem(key: string, value: string): void { this.m.set(key, String(value)) }
    }
    Object.defineProperty(window, 'sessionStorage', {
      value: new SessionMemory(),
      configurable: true,
    })
  }
} catch (error) {
  // Ignore SecurityError when jsdom/happy-dom prevents sessionStorage initialization
  // Tests that need sessionStorage will use mocked versions
}

// Provide tRPC createCallerFactory shim for tests that import it directly
vi.mock('@trpc/server', async () => {
  const actual = await vi.importActual<any>('@trpc/server')
  return {
    ...actual,
    createCallerFactory: (router: any) => (ctx: any) => router.createCaller(ctx),
  }
})

// Mock zustand persist to avoid storage edge-cases in CI
vi.mock('zustand/middleware', async () => {
  const actual = await vi.importActual<any>('zustand/middleware')
  return {
    ...actual,
    persist: (config: any, _opts: any) => config,
    createJSONStorage: (getStorage: any) => {
      const storage = getStorage?.()
      const memory = {
        getItem: (n: string) => storage?.getItem?.(n) ?? null,
        setItem: (n: string, v: string) => { try { storage?.setItem?.(n, v) } catch {} },
        removeItem: (n: string) => { try { storage?.removeItem?.(n) } catch {} },
      }
      return memory as any
    }
  }
})

// Mock redis client to avoid external dependency during tests
vi.mock('redis', () => {
  const kv = new Map<string, string>()
  const sets = new Map<string, Set<string>>()
  const client = {
    on: vi.fn(),
    connect: vi.fn(async () => {}),
    quit: vi.fn(async () => {}),
    get: vi.fn(async (k: string) => (kv.has(k) ? kv.get(k)! : null)),
    set: vi.fn(async (k: string, v: string) => { kv.set(k, String(v)); return 'OK' }),
    del: vi.fn(async (...keys: string[]) => { let c=0; for (const k of keys) if (kv.delete(k)) c++; return c }),
    expire: vi.fn(async (_k: string, _sec: number) => 1),
    exists: vi.fn(async (k: string) => kv.has(k) ? 1 : 0),
    sAdd: vi.fn(async (k: string, ...members: string[]) => { const s = sets.get(k) || new Set<string>(); let added=0; for (const m of members) { if (!s.has(m)) { s.add(m); added++; } } sets.set(k, s); return added }),
    sMembers: vi.fn(async (k: string) => Array.from((sets.get(k) || new Set()).values())),
    sRem: vi.fn(async (k: string, ...members: string[]) => { const s = sets.get(k) || new Set<string>(); let rem=0; for (const m of members) { if (s.delete(m)) rem++; } sets.set(k, s); return rem }),
  }
  return { createClient: () => client }
})

// Provide a default mocked tRPC client; individual tests can override with vi.mock
vi.mock('@/trpc/client', () => ({
  api: {
    services: {
      list: { query: vi.fn(async (_args?: any) => ({ services: [], total: 0, hasMore: false, nextCursor: null })) },
      get: { query: vi.fn(async (_args?: any) => null) },
    },
    categories: {
      list: { query: vi.fn(async () => ({ categories: [] })) },
    },
  }
}))

// Mock IntersectionObserver for Framer Motion whileInView
class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | null = null
  readonly rootMargin: string = ''
  readonly thresholds: ReadonlyArray<number> = []
  
  constructor(public callback: IntersectionObserverCallback) {
    // Immediately trigger the callback to simulate intersection
    setTimeout(() => {
      this.callback(
        [
          {
            boundingClientRect: {} as DOMRectReadOnly,
            intersectionRatio: 1,
            intersectionRect: {} as DOMRectReadOnly,
            isIntersecting: true,
            rootBounds: null,
            target: document.createElement('div'),
            time: Date.now(),
          },
        ],
        this
      )
    }, 0)
  }
  
  disconnect = vi.fn()
  observe = vi.fn()
  takeRecords = vi.fn(() => [])
  unobserve = vi.fn()
}

global.IntersectionObserver = MockIntersectionObserver as any

// Add minimal chai assertion helper for startsWith used in some tests
import * as chai from 'chai'
;(chai as any).Assertion.addMethod('toStartWith', function (this: any, prefix: string) {
  const obj = this._obj
  this.assert(
    typeof obj === 'string' && obj.startsWith(prefix),
    'expected #{this} to start with #{exp}',
    'expected #{this} to not start with #{exp}',
    prefix
  )
})

// Mock Next.js router for testing
vi.mock('next/router', () => ({
  useRouter() {
    return {
      route: '/',
      pathname: '/',
      query: {},
      asPath: '/',
      push: vi.fn(),
      pop: vi.fn(),
      reload: vi.fn(),
      back: vi.fn(),
      prefetch: vi.fn().mockResolvedValue(undefined),
      beforePopState: vi.fn(),
      events: {
        on: vi.fn(),
        off: vi.fn(),
        emit: vi.fn(),
      },
      isFallback: false,
    }
  },
}))

// Mock Next.js navigation for app directory
vi.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: vi.fn(),
      replace: vi.fn(),
      refresh: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      prefetch: vi.fn(),
    }
  },
  useSearchParams() {
    return new URLSearchParams()
  },
  usePathname() {
    return '/'
  },
  useParams() {
    return {} as Record<string, string>
  },
  notFound: vi.fn(),
  redirect: vi.fn(),
}))

// Export test utilities for E2E tests
export function createTestPrismaClient() {
  // Minimal in-memory data store to satisfy e2e/integration tests without a DB
  const db = {
    categories: [] as any[],
    services: [] as any[],
    service_imports: [] as any[],
  }
  let catId = 1
  let svcId = 1
  let impId = 1

  // Helpers
  const matchContains = (val: string | undefined, sub?: string) => !sub || (val?.toLowerCase().includes(sub.toLowerCase()))

  const categories = {
    async create({ data }: any) {
      const row = { id: catId++, updatedAt: new Date(), ...data }
      db.categories.push(row)
      return row
    },
    async createMany({ data }: any) {
      const arr = Array.isArray(data) ? data : []
      for (const d of arr) await categories.create({ data: d })
      return { count: arr.length }
    },
    async upsert({ where, update, create }: any) {
      const bySlug = where?.slug
      let found = db.categories.find(c => c.slug === bySlug)
      if (found) {
        Object.assign(found, update, { updatedAt: new Date() })
        return found
      }
      return categories.create({ data: create })
    },
    async update({ where, data }: any) {
      const idx = db.categories.findIndex(c => c.id === where?.id)
      if (idx >= 0) {
        db.categories[idx] = { ...db.categories[idx], ...data, updatedAt: new Date() }
        return db.categories[idx]
      }
      throw new Error('Category not found')
    },
    async delete({ where }: any) {
      const idx = db.categories.findIndex(c => c.id === where?.id)
      if (idx >= 0) {
        const [removed] = db.categories.splice(idx, 1)
        return removed
      }
      return null
    },
    async findUnique({ where }: any) {
      if (where?.id) return db.categories.find(c => c.id === where.id) || null
      if (where?.slug) return db.categories.find(c => c.slug === where.slug) || null
      return null
    },
    async findFirst({ where = {} }: any = {}) {
      const list = await categories.findMany({ where })
      return list[0] || null
    },
    async findMany({ where = {}, orderBy = [], take }: any = {}) {
      let list = [...db.categories]
      const or = where.OR as any[] | undefined
      if (or && or.length) {
        list = list.filter(c => or.some(cond => matchContains(c.name, cond.name?.contains) || matchContains(c.description, cond.description?.contains)))
      }
      if (where?.id?.gt) list = list.filter(c => c.id > where.id.gt)
      list.sort((a, b) => {
        // default sort by sortOrder asc then id asc
        const so = (orderBy[0]?.sortOrder === 'desc' ? -1 : 1)
        const io = (orderBy[1]?.id === 'desc' ? -1 : 1)
        return (a.sortOrder - b.sortOrder) * so || (a.id - b.id) * io
      })
      return typeof take === 'number' ? list.slice(0, take) : list
    },
    async groupBy({ by, where = {}, _count }: any) {
      // Minimal support for categories usage (usually not used); return empty
      return []
    },
    async deleteMany(): Promise<{ count: number }> {
      const count = db.categories.length
      db.categories = []
      return { count }
    },
    async count({ where = {} }: any = {}) {
      let list = await categories.findMany({ where })
      return list.length
    },
  }

  const services = {
    async create({ data, include }: any) {
      const row = {
        id: svcId++,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'approved',
        ports: JSON.stringify(data.ports ?? []),
        environmentVariables: JSON.stringify(data.environmentVariables ?? []),
        resourceRequirements: JSON.stringify(data.resourceRequirements ?? {}),
        compatibilityInfo: JSON.stringify(data.compatibilityInfo ?? {}),
        ...data,
      }
      db.services.push(row)
      if (include?.categories) {
        const cat = db.categories.find(c => c.id === row.categoryId)
        return { ...row, categories: cat || null }
      }
      return row
    },
    async createMany({ data }: any) {
      const arr = Array.isArray(data) ? data : []
      for (const d of arr) await services.create({ data: d })
      return { count: arr.length }
    },
    async findUnique({ where, include }: any) {
      let row = null as any
      if (where?.id) row = db.services.find(s => s.id === where.id) || null
      if (where?.slug) row = db.services.find(s => s.slug === where.slug) || null
      if (row && include?.categories) {
        const cat = db.categories.find(c => c.id === row.categoryId)
        return { ...row, categories: cat || null }
      }
      return row
    },
    async findMany({ where = {}, include, orderBy, take }: any = {}) {
      let list = [...db.services]
      if (where?.categoryId) list = list.filter(s => s.categoryId === where.categoryId)
      if (where?.status) list = list.filter(s => s.status === where.status)
      const or = where.OR as any[] | undefined
      if (or && or.length) {
        list = list.filter(s => or.some(cond => matchContains(s.name, cond.name?.contains) || matchContains(s.description, cond.description?.contains)))
      }
      if (where?.id?.lt) list = list.filter(s => s.id < where.id.lt)
      // default order by id desc
      list.sort((a, b) => (orderBy?.id === 'asc' ? a.id - b.id : b.id - a.id))
      list = typeof take === 'number' ? list.slice(0, take) : list
      if (include?.categories) {
        return list.map(s => ({ ...s, categories: db.categories.find(c => c.id === s.categoryId) || null }))
      }
      return list
    },
    async findFirst({ where = {} }: any = {}) {
      const list = await services.findMany({ where })
      return list[0] || null
    },
    async update({ where, data, include }: any) {
      const idx = db.services.findIndex(s => s.id === where?.id)
      if (idx >= 0) {
        db.services[idx] = { ...db.services[idx], ...data, updatedAt: new Date() }
        const row = db.services[idx]
        if (include?.categories) {
          const cat = db.categories.find(c => c.id === row.categoryId)
          return { ...row, categories: cat || null }
        }
        return row
      }
      throw new Error('Service not found')
    },
    async updateMany({ where = {}, data }: any) {
      const list = await services.findMany({ where })
      list.forEach((row: any) => {
        const idx = db.services.findIndex(s => s.id === row.id)
        if (idx >= 0) db.services[idx] = { ...db.services[idx], ...data, updatedAt: new Date() }
      })
      return { count: list.length }
    },
    async delete({ where }: any) {
      const idx = db.services.findIndex(s => s.id === where?.id)
      if (idx >= 0) {
        const [removed] = db.services.splice(idx, 1)
        return removed
      }
      return null
    },
    async deleteMany(): Promise<{ count: number }> {
      const count = db.services.length
      db.services = []
      return { count }
    },
    async groupBy({ by, where = {}, _count }: any) {
      // Minimal support for categories router: by: ['categoryId'], _count: { id: true }
      const list = await services.findMany({ where })
      if (by?.includes('categoryId') && _count?.id) {
        const map = new Map<number, number>()
        for (const s of list) {
          const key = s.categoryId
          map.set(key, (map.get(key) || 0) + 1)
        }
        return Array.from(map.entries()).map(([categoryId, count]) => ({ categoryId, _count: { id: count } }))
      }
      return []
    },
    async count({ where = {} }: any = {}) {
      const list = await services.findMany({ where })
      return list.length
    },
  }

  const service_imports = {
    async create({ data }: any) {
      const row = { id: impId++, createdAt: new Date(), updatedAt: new Date(), extractedMetadata: '{}', ...data }
      db.service_imports.push(row)
      return row
    },
    async findFirst({ where = {} }: any) {
      return (await service_imports.findMany({ where }))[0] || null
    },
    async findUnique({ where, include }: any) {
      const row = db.service_imports.find((i) => i.id === where?.id) || null
      if (!row) return null
      if (include?.services) {
        const svc = db.services.find((s) => s.id === row.serviceId) || null
        const cat = svc ? db.categories.find(c => c.id === (svc as any).categoryId) || null : null
        return { ...row, services: svc ? { ...svc, categories: cat } : null }
      }
      return row
    },
    async findMany({ where = {}, include, orderBy, take }: any = {}) {
      let list = [...db.service_imports]
      if (where?.status) list = list.filter(i => i.status === where.status)
      if (where?.id?.gt) list = list.filter(i => i.id > where.id.gt)
      const or = where.OR as any[] | undefined
      if (or && or.length) {
        list = list.filter(i => or.some(cond => matchContains(i.sourceUrl, cond.sourceUrl?.contains) || matchContains(i.sourceType, cond.sourceType?.contains) || matchContains(i.submittedBy, cond.submittedBy?.contains)))
      }
      if (orderBy) {
        const key = Object.keys(orderBy)[0] as keyof any
        const dir = (orderBy as any)[key]
        list.sort((a: any, b: any) => (dir === 'asc' ? (a[key] > b[key] ? 1 : -1) : (a[key] < b[key] ? 1 : -1)))
      }
      list = typeof take === 'number' ? list.slice(0, take) : list
      if (include?.services) {
        return list.map(i => {
          const svc = db.services.find(s => s.id === i.serviceId) || null
          const cat = svc ? db.categories.find(c => c.id === (svc as any).categoryId) || null : null
          return { ...i, services: svc ? { ...svc, categories: cat } : null }
        })
      }
      return list
    },
    async deleteMany(): Promise<{ count: number }> {
      const count = db.service_imports.length
      db.service_imports = []
      return { count }
    },
    async count({ where = {} }: any = {}) {
      const list = await service_imports.findMany({ where })
      return list.length
    },
  }

  // use_case_templates delegate for template engine tests
  const use_case_templates = {
    async findUnique({ where, include }: any) {
      const row = (db as any).use_case_templates?.find((t: any) => t.id === where?.id) || null
      if (!row) return null
      if (include?.services) {
        const ids = JSON.parse(row.serviceIds || '[]') as number[]
        const list = db.services.filter(s => ids.includes(s.id))
        return { ...row, services: list }
      }
      return row
    },
    async findMany({ where = {}, include, orderBy, take }: any = {}) {
      const list = [ ...((db as any).use_case_templates || []) ]
      // Simplified where handling: filter by isActive/featured/category
      let filtered = list
      if (where?.isActive !== undefined) filtered = filtered.filter((t: any) => t.isActive === where.isActive)
      if (where?.category) filtered = filtered.filter((t: any) => t.category === where.category)
      if (include?.services) {
        return filtered.map((row: any) => {
          const ids = JSON.parse(row.serviceIds || '[]') as number[]
          return { ...row, services: db.services.filter(s => ids.includes(s.id)) }
        })
      }
      return typeof take === 'number' ? filtered.slice(0, take) : filtered
    },
    async create({ data }: any) {
      if (!(db as any).use_case_templates) (db as any).use_case_templates = []
      const row = { ...data }
      ;(db as any).use_case_templates.push(row)
      return row
    },
    async update({ where, data }: any) {
      const list = (db as any).use_case_templates || []
      const idx = list.findIndex((t: any) => t.id === where?.id)
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...data }
        return list[idx]
      }
      throw new Error('Template not found')
    },
  }

  const audit_logs = {
    async create({ data }: any) {
      if (!(db as any).audit_logs) (db as any).audit_logs = []
      (db as any).audit_logs.push({ ...data })
      return data
    },
    async deleteMany(): Promise<{ count: number }> {
      const count = ((db as any).audit_logs || []).length
      (db as any).audit_logs = []
      return { count }
    },
    async findMany(): Promise<any[]> {
      return [ ...(((db as any).audit_logs) || []) ]
    },
  }

  const clientBase: any = {
    // Singular aliases used in some tests
    category: categories,
    service: services,
    serviceImport: service_imports,
    // Plural delegates matching Prisma schema used by routers
    categories,
    services,
    service_imports,
    use_case_templates,
    audit_logs,
    // Required PrismaClient methods
    $connect: vi.fn(async () => {}),
    $disconnect: vi.fn(async () => {}),
    $on: vi.fn(),
    $use: vi.fn(),
    $executeRaw: vi.fn(async () => 0),
    $executeRawUnsafe: vi.fn(async () => 0),
    $queryRaw: vi.fn(async () => []),
    $queryRawUnsafe: vi.fn(async () => []),
    $transaction: vi.fn(async (arg: any, options?: any) => {
      // Support both interactive and batch forms
      if (typeof arg === 'function') {
        return await arg(client)
      }
      if (Array.isArray(arg)) {
        // Execute all promises/functions sequentially
        const results: any[] = []
        for (const item of arg) {
          if (typeof item === 'function') {
            results.push(await item(client))
          } else {
            results.push(await item)
          }
        }
        return results
      }
      return null
    }),
    $extends: vi.fn(),
  }

  // Fallback delegate to prevent undefined errors in tests for unimplemented models
  const fallbackDelegate = {
    create: vi.fn(async (args?: any) => (args?.data ?? {})),
    createMany: vi.fn(async (args?: any) => ({ count: Array.isArray(args?.data) ? args.data.length : 0 })),
    delete: vi.fn(async () => ({})),
    deleteMany: vi.fn(async () => ({ count: 0 })),
    findFirst: vi.fn(async () => null),
    findMany: vi.fn(async () => []),
    findUnique: vi.fn(async () => null),
    update: vi.fn(async (args?: any) => (args?.data ?? {})),
    updateMany: vi.fn(async () => ({ count: 0 })),
    upsert: vi.fn(async (args?: any) => (args?.create ?? {})),
    groupBy: vi.fn(async () => []),
    count: vi.fn(async () => 0),
  }

  const client = new Proxy(clientBase, {
    get(target, prop, receiver) {
      if (prop in target) return Reflect.get(target, prop, receiver)
      // Return a safe fallback delegate for unknown models
      return fallbackDelegate
    }
  })

  return client as any
}
