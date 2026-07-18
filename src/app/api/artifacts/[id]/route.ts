import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import { prisma } from '@/lib/db-utils'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const artifact = await prisma.deployment_artifacts.findUnique({ where: { id } })
  if (!artifact || !artifact.location) {
    return NextResponse.json({ error: 'Artifact not found' }, { status: 404 })
  }

  try {
    const content = fs.readFileSync(path.resolve(artifact.location), 'utf8')
    return new NextResponse(content, {
      headers: {
        'Content-Type': 'application/yaml; charset=utf-8',
        'Content-Disposition': `attachment; filename="${path.basename(artifact.location)}"`,
      },
    })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to read artifact' }, { status: 500 })
  }
}
