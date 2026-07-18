import { getSharedInMemoryClient } from './shared-client'

export { getSharedInMemoryClient }

class PrismaClientProxy {
  constructor(_options?: any) {
    return getSharedInMemoryClient()
  }
}

export const PrismaClient = PrismaClientProxy as unknown as {
  new (options?: any): any
}

export const Prisma = {
  Decimal: class Decimal {
    private v: any
    constructor(v: any) { this.v = v }
    toNumber() { return Number(this.v) }
    toString() { return String(this.v) }
    valueOf() { return Number(this.v) }
  }
} as const
