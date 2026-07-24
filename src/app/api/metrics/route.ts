import { getMetricsText } from '@/lib/metrics'

export const dynamic = 'force-static'

export async function GET() {
  const body = await getMetricsText()
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
