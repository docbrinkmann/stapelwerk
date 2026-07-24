'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Search,
  ArrowDown,
  Pause,
  Play,
  Trash2,
  Download,
} from 'lucide-react'
import { useT } from '@/lib/i18n/client'
import type { MessageKey } from '@/lib/i18n/messages'

export type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'trace'

export interface LogEntry {
  id: string
  timestamp: Date
  level: LogLevel
  message: string
  source?: string
  metadata?: Record<string, unknown>
}

interface LogViewerProps {
  logs: LogEntry[]
  maxLines?: number
  autoScroll?: boolean
  showTimestamps?: boolean
  isStreaming?: boolean
  isLoading?: boolean
  onClear?: () => void
  onDownload?: () => void
  className?: string
}

const levelConfig: Record<LogLevel, {
  labelKey: MessageKey
  className: string
  badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline'
}> = {
  info: {
    labelKey: 'ops.logLevelInfo',
    className: 'text-info',
    badgeVariant: 'default',
  },
  warn: {
    labelKey: 'ops.logLevelWarn',
    className: 'text-warning',
    badgeVariant: 'secondary',
  },
  error: {
    labelKey: 'ops.logLevelError',
    className: 'text-destructive',
    badgeVariant: 'destructive',
  },
  debug: {
    labelKey: 'ops.logLevelDebug',
    className: 'text-muted-foreground',
    badgeVariant: 'outline',
  },
  trace: {
    labelKey: 'ops.logLevelTrace',
    className: 'text-muted-foreground',
    badgeVariant: 'outline',
  },
}

function LogEntryRow({ entry, showTimestamp }: { entry: LogEntry; showTimestamp: boolean }) {
  const t = useT()
  const config = levelConfig[entry.level] || levelConfig.info
  // UTC keeps log times consistent with server-side logs and deterministic in tests
  const time = entry.timestamp.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
    timeZone: 'UTC',
  })

  return (
    <div
      data-log-entry={entry.level}
      className="flex items-start gap-2 py-0.5 font-mono text-xs hover:bg-muted/50 px-2"
    >
      {showTimestamp && (
        <span className="text-muted-foreground shrink-0">{time}</span>
      )}
      <Badge
        variant={config.badgeVariant}
        className={cn('text-[10px] px-1 py-0 shrink-0', config.className)}
      >
        {t(config.labelKey)}
      </Badge>
      {entry.source && (
        <span className="text-muted-foreground shrink-0">[{entry.source}]</span>
      )}
      <span className="text-foreground break-all">{entry.message}</span>
    </div>
  )
}

export function LogViewer({
  logs,
  maxLines = 1000,
  autoScroll: initialAutoScroll = true,
  showTimestamps = true,
  isStreaming = false,
  isLoading = false,
  onClear,
  onDownload,
  className,
}: LogViewerProps) {
  const t = useT()
  const [searchQuery, setSearchQuery] = useState('')
  const [autoScroll, setAutoScroll] = useState(initialAutoScroll)
  const [isPaused, setIsPaused] = useState(false)
  const [enabledLevels, setEnabledLevels] = useState<Set<LogLevel>>(
    new Set(['info', 'warn', 'error', 'debug', 'trace'])
  )
  const containerRef = useRef<HTMLDivElement>(null)
  const wasAtBottomRef = useRef(true)

  // Filter logs based on search and level filters
  const filteredLogs = logs
    .filter(log => enabledLevels.has(log.level))
    .filter(log => {
      if (!searchQuery) return true
      const query = searchQuery.toLowerCase()
      return (
        log.message.toLowerCase().includes(query) ||
        log.source?.toLowerCase().includes(query)
      )
    })
    .slice(-maxLines)

  // Auto-scroll effect
  useEffect(() => {
    if (autoScroll && !isPaused && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [filteredLogs, autoScroll, isPaused])

  // Track scroll position to detect if user scrolled up
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50
    wasAtBottomRef.current = isAtBottom

    // Auto-disable auto-scroll when user scrolls up
    if (!isAtBottom && autoScroll) {
      setAutoScroll(false)
    }
  }, [autoScroll])

  const toggleAutoScroll = () => {
    setAutoScroll(prev => {
      const next = !prev
      if (next && containerRef.current) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight
      }
      return next
    })
  }

  const toggleLevel = (level: LogLevel) => {
    setEnabledLevels(prev => {
      const allLevels = Object.keys(levelConfig) as LogLevel[]
      // From "everything visible", clicking a level focuses on just that level
      if (prev.size === allLevels.length) return new Set([level])
      const next = new Set(prev)
      if (next.has(level)) {
        next.delete(level)
        // Deselecting the last level resets to all instead of an empty view
        if (next.size === 0) return new Set(allLevels)
      } else {
        next.add(level)
      }
      return next
    })
  }

  const downloadLogs = () => {
    if (onDownload) {
      onDownload()
      return
    }
    const content = filteredLogs
      .map(log => {
        const time = log.timestamp.toISOString()
        const source = log.source ? `[${log.source}] ` : ''
        return `${time} ${log.level.toUpperCase()} ${source}${log.message}`
      })
      .join('\n')

    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `logs-${new Date().toISOString()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div
      className={cn('flex flex-col h-full', className)}
      role="region"
      aria-label={t('ops.logViewer')}
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 p-2 border-b bg-muted/30" role="toolbar" aria-label={t('ops.logViewerControls')}>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('ops.searchLogs')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>

        {/* Level filter chips */}
        <div className="flex items-center gap-1" role="group" aria-label={t('ops.filterByLevel')}>
          {(Object.keys(levelConfig) as LogLevel[]).map(level => {
            const enabled = enabledLevels.has(level)
            return (
              <Button
                key={level}
                variant="outline"
                size="sm"
                className={cn(
                  'h-8 px-2 text-[11px] font-mono',
                  enabled ? levelConfig[level].className : 'opacity-40'
                )}
                aria-pressed={enabled}
                onClick={() => toggleLevel(level)}
              >
                {t(levelConfig[level].labelKey)}
              </Button>
            )
          })}
        </div>

        <Button
          variant="outline"
          size="sm"
          className="h-8"
          onClick={() => setIsPaused(!isPaused)}
          aria-label={isPaused ? t('ops.resumeStreaming') : t('ops.pauseStreaming')}
          aria-pressed={isPaused}
        >
          {isPaused ? (
            <Play className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Pause className="h-4 w-4" aria-hidden="true" />
          )}
        </Button>

        <Button
          variant="outline"
          size="sm"
          className={cn('h-8', !autoScroll && 'opacity-60')}
          onClick={toggleAutoScroll}
          aria-label={t('ops.autoScroll')}
          aria-pressed={autoScroll}
        >
          <ArrowDown className="h-4 w-4" aria-hidden="true" />
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="h-8"
          onClick={downloadLogs}
          aria-label={t('ops.downloadLogs')}
        >
          <Download className="h-4 w-4" aria-hidden="true" />
        </Button>

        {onClear && (
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={onClear}
            aria-label={t('ops.clearLogs')}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}

        <span className="ml-auto flex items-center gap-2">
          {isStreaming && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              {t('ops.live')}
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {t('ops.logsCount', { count: filteredLogs.length })}
          </span>
        </span>
      </div>

      {/* Log entries */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-auto bg-background/50"
        role="log"
        aria-live="polite"
        aria-label={t('ops.logOutput')}
      >
        {isLoading ? (
          <div
            data-testid="log-viewer-loading"
            className="space-y-1.5 p-3"
            aria-busy="true"
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-3.5 animate-pulse rounded bg-muted" style={{ width: `${55 + ((i * 17) % 40)}%` }} />
            ))}
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            {t('ops.noLogsToDisplay')}
          </div>
        ) : (
          <div className="py-1">
            {filteredLogs.map(entry => (
              <LogEntryRow key={entry.id} entry={entry} showTimestamp={showTimestamps} />
            ))}
          </div>
        )}
      </div>

      {/* Status bar */}
      {isPaused && (
        <div className="px-2 py-1 bg-warning/10 border-t border-warning/20">
          <span className="text-xs text-warning-foreground">
            {t('ops.streamingPaused')}
          </span>
        </div>
      )}
    </div>
  )
}
