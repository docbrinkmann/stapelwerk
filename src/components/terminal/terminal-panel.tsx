'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Terminal as TerminalIcon,
  X,
  Maximize2,
  Minimize2,
  Copy,
  Trash2,
  RotateCw,
} from 'lucide-react'

interface TerminalPanelProps {
  title?: string
  sessionId?: string
  onClose?: () => void
  className?: string
  wsUrl?: string
  initialCommands?: string[]
  /** Controlled connection state (managed by a terminal provider) */
  isConnecting?: boolean
  isConnected?: boolean
  onReconnect?: () => void
  /** Forward raw terminal input to the session transport */
  onData?: (data: string) => void
  /** External transport mode: exposes write/clear and disables local echo */
  onTerminalReady?: (terminal: { write: (data: string) => void; clear: () => void }) => void
  onClear?: () => void
  theme?: 'dark' | 'light'
  error?: string
  allowFullscreen?: boolean
  isInitializing?: boolean
  readOnly?: boolean
  ariaLabel?: string
}

export function TerminalPanel({
  title = 'Terminal',
  sessionId,
  onClose,
  className,
  wsUrl,
  initialCommands = [],
  isConnecting = false,
  isConnected,
  onReconnect,
  onData,
  onTerminalReady,
  onClear,
  theme = 'dark',
  error,
  allowFullscreen = true,
  isInitializing = false,
  readOnly = false,
  ariaLabel,
}: TerminalPanelProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<any>(null)
  const fitAddonRef = useRef<any>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const [wsConnected, setWsConnected] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Controlled state wins over the internal WebSocket state
  const effectiveConnected = isConnected ?? (wsUrl ? wsConnected : undefined)
  const statusLabel = isConnecting
    ? 'Connecting'
    : effectiveConnected === true
      ? 'Connected'
      : effectiveConnected === false
        ? 'Disconnected'
        : null

  // Initialize terminal
  useEffect(() => {
    let mounted = true

    const initTerminal = async () => {
      if (!terminalRef.current || xtermRef.current) return

      try {
        // Dynamic import for SSR compatibility
        const { Terminal } = await import('@xterm/xterm')
        const { FitAddon } = await import('@xterm/addon-fit')
        const { WebLinksAddon } = await import('@xterm/addon-web-links')

        if (!mounted || !terminalRef.current) return

        const term = new Terminal({
          cursorBlink: !readOnly,
          disableStdin: readOnly,
          fontSize: 14,
          fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
          theme: {
            background: '#1a1b26',
            foreground: '#a9b1d6',
            cursor: '#c0caf5',
            cursorAccent: '#1a1b26',
            selectionBackground: '#33467c',
            black: '#32344a',
            red: '#f7768e',
            green: '#9ece6a',
            yellow: '#e0af68',
            blue: '#7aa2f7',
            magenta: '#ad8ee6',
            cyan: '#449dab',
            white: '#787c99',
            brightBlack: '#444b6a',
            brightRed: '#ff7a93',
            brightGreen: '#b9f27c',
            brightYellow: '#ff9e64',
            brightBlue: '#7da6ff',
            brightMagenta: '#bb9af7',
            brightCyan: '#0db9d7',
            brightWhite: '#acb0d0',
          },
          allowProposedApi: true,
        })

        const fitAddon = new FitAddon()
        const webLinksAddon = new WebLinksAddon()

        term.loadAddon(fitAddon)
        term.loadAddon(webLinksAddon)

        term.open(terminalRef.current)
        fitAddon.fit()

        xtermRef.current = term
        fitAddonRef.current = fitAddon
        setIsLoading(false)

        // Write welcome message
        term.writeln('\x1b[1;34m╭───────────────────────────────────────╮\x1b[0m')
        term.writeln('\x1b[1;34m│\x1b[0m   Welcome to BuildMyStack Terminal   \x1b[1;34m│\x1b[0m')
        term.writeln('\x1b[1;34m╰───────────────────────────────────────╯\x1b[0m')
        term.writeln('')

        for (const cmd of initialCommands) {
          term.writeln(`\x1b[32m$\x1b[0m ${cmd}`)
        }

        const handleResize = () => {
          if (fitAddonRef.current) {
            fitAddonRef.current.fit()
          }
        }
        window.addEventListener('resize', handleResize)

        if (onTerminalReady) {
          // External transport mode: the parent owns the connection and
          // writes output back via the exposed handle; no local echo.
          onTerminalReady({
            write: (data: string) => term.write(data),
            clear: () => term.clear(),
          })
          if (!readOnly) {
            term.onData((data: string) => onData?.(data))
          }
        } else if (wsUrl) {
          connectWebSocket(term)
        } else if (!readOnly) {
          // Local echo mode; still forward raw input to onData for providers
          let currentLine = ''
          term.write('\x1b[32m$\x1b[0m ')

          term.onData((data: string) => {
            onData?.(data)
            if (data === '\r') {
              term.writeln('')
              if (currentLine.trim()) {
                term.writeln(`\x1b[33mCommand: ${currentLine}\x1b[0m`)
                term.writeln('\x1b[90m(WebSocket not connected - local echo mode)\x1b[0m')
              }
              currentLine = ''
              term.write('\x1b[32m$\x1b[0m ')
            } else if (data === '\x7f') {
              if (currentLine.length > 0) {
                currentLine = currentLine.slice(0, -1)
                term.write('\b \b')
              }
            } else {
              currentLine += data
              term.write(data)
            }
          })
        }

        return () => {
          window.removeEventListener('resize', handleResize)
        }
      } catch (err) {
        console.error('Failed to initialize terminal:', err)
        setIsLoading(false)
      }
    }

    initTerminal()

    return () => {
      mounted = false
      if (xtermRef.current) {
        xtermRef.current.dispose()
        xtermRef.current = null
      }
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsUrl, initialCommands, readOnly])

  // Resize on maximize/minimize
  useEffect(() => {
    if (fitAddonRef.current) {
      setTimeout(() => fitAddonRef.current.fit(), 100)
    }
  }, [isMaximized])

  const connectWebSocket = useCallback((term: any) => {
    if (!wsUrl) return

    try {
      const ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        setWsConnected(true)
        term.writeln('\x1b[32m✓ Connected to terminal server\x1b[0m')
        term.write('\x1b[32m$\x1b[0m ')
      }

      ws.onmessage = (event) => {
        term.write(event.data)
      }

      ws.onclose = () => {
        setWsConnected(false)
        term.writeln('\x1b[31m✗ Disconnected from terminal server\x1b[0m')
      }

      ws.onerror = () => {
        term.writeln('\x1b[31m✗ WebSocket error\x1b[0m')
      }

      term.onData((data: string) => {
        onData?.(data)
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data)
        }
      })

      wsRef.current = ws
    } catch (err) {
      term.writeln(`\x1b[31m✗ Failed to connect: ${err}\x1b[0m`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsUrl])

  const handleCopy = useCallback(() => {
    if (xtermRef.current) {
      const selection = xtermRef.current.getSelection?.()
      if (selection) {
        navigator.clipboard.writeText(selection)
      }
    }
  }, [])

  const handleClear = useCallback(() => {
    if (xtermRef.current) {
      xtermRef.current.clear()
      xtermRef.current.write('\x1b[32m$\x1b[0m ')
    }
    onClear?.()
  }, [onClear])

  return (
    <div
      className={cn(
        'flex flex-col rounded-lg overflow-hidden border border-border',
        theme === 'light' ? 'bg-background' : 'bg-[#1a1b26]',
        isMaximized ? 'fixed inset-4 z-50' : 'h-full',
        className
      )}
      role="region"
      aria-label={`Terminal: ${title}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#24283b] border-b border-border">
        <div className="flex items-center gap-2">
          <TerminalIcon className="h-4 w-4 text-success" aria-hidden="true" />
          <span className="text-sm font-medium text-white">{title}</span>
          {statusLabel && (
            <span
              className={cn(
                'inline-flex items-center gap-1.5 text-xs',
                statusLabel === 'Connected' && 'text-success',
                statusLabel === 'Disconnected' && 'text-destructive',
                statusLabel === 'Connecting' && 'text-warning'
              )}
              role="status"
            >
              <span
                className={cn(
                  'h-2 w-2 rounded-full',
                  statusLabel === 'Connected' && 'bg-success',
                  statusLabel === 'Disconnected' && 'bg-destructive',
                  statusLabel === 'Connecting' && 'bg-warning animate-pulse'
                )}
                aria-hidden="true"
              />
              {statusLabel}
            </span>
          )}
          {readOnly && (
            <span className="rounded border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              Read-only
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {effectiveConnected === false && onReconnect && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-2 text-xs text-muted-foreground hover:text-white"
              onClick={onReconnect}
            >
              <RotateCw className="h-3 w-3" aria-hidden="true" />
              Reconnect
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-white"
            onClick={handleCopy}
            aria-label="Copy selection"
          >
            <Copy className="h-3 w-3" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-white"
            onClick={handleClear}
            aria-label="Clear terminal"
          >
            <Trash2 className="h-3 w-3" aria-hidden="true" />
          </Button>
          {allowFullscreen && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-white"
              onClick={() => setIsMaximized(!isMaximized)}
              aria-label={isMaximized ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              {isMaximized ? (
                <Minimize2 className="h-3 w-3" aria-hidden="true" />
              ) : (
                <Maximize2 className="h-3 w-3" aria-hidden="true" />
              )}
            </Button>
          )}
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-white"
              onClick={onClose}
              aria-label="Close terminal"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>

      {/* Error bar */}
      {error && (
        <div className="border-b border-destructive/20 bg-destructive/10 px-3 py-1.5" role="alert">
          <span className="text-xs text-destructive">{error}</span>
        </div>
      )}

      {/* Terminal content */}
      <div className="relative flex-1 p-2 min-h-[300px]">
        {isInitializing ? (
          <div
            data-testid="terminal-skeleton"
            className="h-full w-full animate-pulse rounded bg-muted/20"
            aria-busy="true"
          />
        ) : (
          <>
            <div
              ref={terminalRef}
              data-testid="terminal-container"
              data-session-id={sessionId}
              aria-label={ariaLabel}
              className="h-full w-full"
            />
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                <span className="animate-pulse">Initializing terminal...</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
