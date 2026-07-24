'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { trpc } from '@/trpc/react-client'
import { Card, CardContent } from '@/components/ui/card'
import { LogViewer, type LogEntry, type LogLevel } from '@/components/logs/log-viewer'
import { useT } from '@/lib/i18n/client'

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:3001'

export default function StackLogsPage() {
  const t = useT()
  const params = useParams()
  const stackId = params.stackId as string
  const { data: session } = useSession()
  const userId = (session?.user as any)?.id as string | undefined

  const [liveLogs, setLiveLogs] = useState<LogEntry[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)

  // Persisted logs from the database (deployment history)
  const logsQuery = trpc.logs.list.useQuery(
    { stackId, limit: 200 },
    { enabled: !!stackId, staleTime: 30 * 1000, retry: false }
  )

  // Live stream over the WebSocket server
  useEffect(() => {
    if (!userId || !stackId) return

    const ws = new WebSocket(`${WS_BASE}/ws?userId=${encodeURIComponent(userId)}`)
    wsRef.current = ws

    ws.onopen = () => {
      setIsStreaming(true)
      ws.send(JSON.stringify({
        type: 'subscribe',
        payload: { channel: 'logs', stackId },
        timestamp: Date.now(),
      }))
    }

    ws.onmessage = event => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === 'logs' && Array.isArray(msg.payload?.entries)) {
          const entries: LogEntry[] = msg.payload.entries.map((e: any) => ({
            id: e.id ?? crypto.randomUUID(),
            timestamp: new Date(e.timestamp),
            level: (e.level ?? 'info') as LogLevel,
            message: e.message ?? '',
            source: e.source,
            metadata: e.metadata ?? undefined,
          }))
          setLiveLogs(prev => [...prev, ...entries].slice(-1000))
        }
      } catch {
        // ignore malformed frames
      }
    }

    ws.onclose = () => setIsStreaming(false)
    ws.onerror = () => setIsStreaming(false)

    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [userId, stackId])

  // Merge persisted (oldest-first) and live logs
  const logs: LogEntry[] = useMemo(() => {
    const persisted = (logsQuery.data?.logs ?? [])
      .map((l: any): LogEntry => ({
        id: l.id,
        timestamp: new Date(l.timestamp),
        level: l.level as LogLevel,
        message: l.message,
        source: l.source ?? undefined,
        metadata: (l.metadata as Record<string, unknown> | null) ?? undefined,
      }))
      .reverse()
    const seen = new Set(persisted.map((l: LogEntry) => l.id))
    return [...persisted, ...liveLogs.filter(l => !seen.has(l.id))]
  }, [logsQuery.data, liveLogs])

  const handleClear = useCallback(() => setLiveLogs([]), [])

  return (
    <div className="flex h-full flex-col space-y-6">
      <div>
        <h2 className="text-xl font-semibold">{t('ops.tabLogs')}</h2>
        <p className="text-muted-foreground">
          {t('ops.logsSubtitle')}
        </p>
      </div>

      <Card className="flex-1 overflow-hidden">
        <CardContent className="h-[560px] p-0">
          <LogViewer
            logs={logs}
            isLoading={logsQuery.isLoading}
            isStreaming={isStreaming}
            onClear={handleClear}
          />
        </CardContent>
      </Card>
    </div>
  )
}
