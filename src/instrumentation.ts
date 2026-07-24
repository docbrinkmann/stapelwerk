import { validateEnv } from '@/lib/env'

export async function register() {
  validateEnv()
  
  // Initialize monitoring on the server
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initializeMonitoring } = await import('@/lib/monitoring')
    initializeMonitoring()
  }

  // Initialize analytics on the server for SSR support
  if (process.env.NEXT_RUNTIME === 'edge' || process.env.NEXT_RUNTIME === 'nodejs') {
    // Server-side analytics initialization if needed
    console.log('Server-side instrumentation initialized')
  }
}