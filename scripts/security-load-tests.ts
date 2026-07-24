#!/usr/bin/env tsx
import { PrismaClient } from '@prisma/client'
import { scheduleScan } from '@/server/services/scanner/trivy'
import { ComplianceEngine } from '@/server/services/compliance-engine'

const prisma = new PrismaClient()

async function main() {
  const concurrency = Number(process.env.SECURITY_CONCURRENCY || '50')
  const t0 = Date.now()

  // Queue concurrent scans (stubbed if trivy not installed)
  const ids = await Promise.all(Array.from({ length: concurrency }).map((_, i) => scheduleScan(`perf-target-${i}`, 'image')))

  // Wait for all scans to reach completed/failed
  const deadline = Date.now() + 60_000 // 60s timeout
  while (true) {
    const scans = await prisma.vulnerabilityScan.findMany({ where: { id: { in: ids } }, select: { status: true } })
    const done = scans.length === ids.length && scans.every(s => s.status === 'completed' || s.status === 'failed')
    if (done) break
    if (Date.now() > deadline) {
      console.error('Timeout waiting for scans to finish')
      process.exit(1)
    }
    await new Promise(r => setTimeout(r, 200))
  }

  const t1 = Date.now()
  const totalMs = t1 - t0
  console.log(`Concurrent scans: ${concurrency}, total time: ${totalMs}ms`)

  // SLA: aim for < 30s for batch placeholder (stub fast path should be <<)
  if (totalMs > 30_000) {
    console.error(`SLA breach: concurrent scan batch took ${totalMs}ms (>30000ms)`) 
    process.exit(1)
  }

  // Compliance summary perf (<10s)
  const c0 = Date.now()
  await ComplianceEngine.getSummary({ stackId: 'perf-stack' })
  const c1 = Date.now()
  const compMs = c1 - c0
  console.log(`Compliance summary time: ${compMs}ms`)
  if (compMs > 10_000) {
    console.error(`SLA breach: compliance summary took ${compMs}ms (>10000ms)`) 
    process.exit(1)
  }

  console.log('Security perf checks passed')
}

main().catch((e) => { console.error(e); process.exit(2) })
