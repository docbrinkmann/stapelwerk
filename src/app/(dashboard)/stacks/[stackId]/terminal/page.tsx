'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TerminalPanel } from '@/components/terminal'
import { trpc } from '@/trpc/react-client'
import { Info } from 'lucide-react'
import '@xterm/xterm/css/xterm.css'

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:3001'

export default function StackTerminalPage() {
  const params = useParams()
  const stackId = params.stackId as string
  const { data: session } = useSession()
  const userId = (session?.user as any)?.id as string | undefined

  // Services the user can exec into (deployed compose containers).
  const stackQuery = trpc.stacks.get.useQuery({ id: stackId }, { enabled: !!stackId })
  const services = useMemo(() => {
    const rows = (stackQuery.data?.stack_services ?? []) as Array<{
      services?: { name: string; slug: string } | null
    }>
    return rows
      .map((ss) => ss.services)
      .filter((s): s is { name: string; slug: string } => !!s?.slug)
  }, [stackQuery.data])
  const [serviceSlug, setServiceSlug] = useState<string | undefined>()
  // Default to the first service once loaded.
  useEffect(() => {
    if (!serviceSlug && services[0]?.slug) setServiceSlug(services[0].slug)
  }, [services, serviceSlug])

  const wsRef = useRef<WebSocket | null>(null)
  const termRef = useRef<{ write: (d: string) => void; clear: () => void } | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  // Transcript buffer: xterm instances are re-created on remounts (React
  // StrictMode double-mount in dev) — replaying keeps output visible.
  const transcriptRef = useRef('')
  const [isConnecting, setIsConnecting] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | undefined>()

  const connect = useCallback(() => {
    if (!userId || !termRef.current) return
    if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) return

    setIsConnecting(true)
    setError(undefined)
    const ws = new WebSocket(`${WS_BASE}/ws?userId=${encodeURIComponent(userId)}`)
    wsRef.current = ws

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'terminal',
        payload: { action: 'create', stackId, serviceSlug, cols: 80, rows: 24 },
        timestamp: Date.now(),
      }))
    }

    ws.onmessage = event => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === 'terminal') {
          if (msg.payload?.action === 'create' && msg.payload.sessionId) {
            sessionIdRef.current = msg.payload.sessionId
            setIsConnecting(false)
            setIsConnected(true)
          } else if (msg.payload?.action === 'output' && typeof msg.payload.data === 'string') {
            transcriptRef.current = (transcriptRef.current + msg.payload.data).slice(-100_000)
            termRef.current?.write(msg.payload.data)
          }
        } else if (msg.type === 'error') {
          setError(msg.payload?.message ?? 'Terminal error')
        }
      } catch {
        // ignore malformed frames
      }
    }

    ws.onclose = () => {
      setIsConnecting(false)
      setIsConnected(false)
      sessionIdRef.current = null
      wsRef.current = null
    }

    ws.onerror = () => {
      setIsConnecting(false)
      setError('Could not reach the terminal server. Is `npm run ws:dev` running?')
    }
  }, [stackId, userId, serviceSlug])

  // Reconnect into the chosen service's container when the selection changes.
  const reconnectTo = useCallback((slug: string) => {
    setServiceSlug(slug)
    wsRef.current?.close()
    wsRef.current = null
    termRef.current?.clear()
    transcriptRef.current = ''
  }, [])

  useEffect(() => {
    return () => {
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [])

  const handleReady = useCallback((terminal: { write: (d: string) => void; clear: () => void }) => {
    termRef.current = terminal
    if (transcriptRef.current) terminal.write(transcriptRef.current)
    connect()
  }, [connect])

  // (Re)connect once the session becomes available (terminal may be ready earlier)
  useEffect(() => {
    if (userId && termRef.current && !wsRef.current) connect()
  }, [userId, connect])

  const handleData = useCallback((data: string) => {
    const ws = wsRef.current
    if (ws?.readyState === WebSocket.OPEN && sessionIdRef.current) {
      ws.send(JSON.stringify({
        type: 'terminal',
        payload: { action: 'input', sessionId: sessionIdRef.current, data },
        timestamp: Date.now(),
      }))
    }
  }, [])

  return (
    <div className="space-y-6 h-full">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Terminal</h2>
          <p className="text-muted-foreground">
            Access shell terminal for your stack services
          </p>
        </div>
        {services.length > 0 && (
          <div className="space-y-1.5">
            <Label htmlFor="term-service" className="text-xs text-muted-foreground">
              Service
            </Label>
            <Select value={serviceSlug} onValueChange={reconnectTo}>
              <SelectTrigger id="term-service" className="w-56">
                <SelectValue placeholder="Select a service" />
              </SelectTrigger>
              <SelectContent>
                {services.map((s) => (
                  <SelectItem key={s.slug} value={s.slug}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="h-[500px]">
        <TerminalPanel
          title={`Terminal - Stack ${stackId.slice(0, 8)}`}
          sessionId={sessionIdRef.current ?? undefined}
          isConnecting={isConnecting}
          isConnected={isConnected}
          onReconnect={connect}
          onTerminalReady={handleReady}
          onData={handleData}
          error={error}
        />
      </div>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Info className="h-4 w-4" />
            Terminal Info
          </CardTitle>
        </CardHeader>
        <CardContent className="py-3">
          <p className="text-sm text-muted-foreground">
            Connected through the BuildMyStack WebSocket server. When the stack
            is deployed on this server, the session runs a real shell inside the
            selected service&apos;s container; otherwise it falls back to a safe
            echo mode. You can only reach containers of your own stacks.
          </p>
          <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
            <li>• <strong>Ctrl+C</strong> - Interrupt current process</li>
            <li>• <strong>Ctrl+L</strong> - Clear screen</li>
            <li>• <strong>Tab</strong> - Auto-complete (when connected)</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
