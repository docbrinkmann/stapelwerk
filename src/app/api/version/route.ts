import { NextResponse } from 'next/server'
import { validateEnv } from '@/lib/env'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(_request: Request) {
  try {
    const env = validateEnv()
    
    const version = {
      version: process.env.npm_package_version || '0.1.0',
      environment: env.NODE_ENV,
      buildTime: process.env.BUILD_TIME || new Date().toISOString(),
      commitSha: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || 'unknown',
      branch: process.env.VERCEL_GIT_COMMIT_REF || process.env.GITHUB_REF_NAME || 'unknown',
      nodeVersion: process.version,
      timestamp: new Date().toISOString(),
    }

    return NextResponse.json(version, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
        'Content-Type': 'application/json',
      }
    })
    
  } catch (error) {
    console.error('Version check failed:', error)
    
    return NextResponse.json({
      error: 'Version information unavailable',
      timestamp: new Date().toISOString(),
    }, { status: 500 })
  }
}