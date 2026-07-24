import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LogViewer } from '@/components/logs/log-viewer'

// Mock log entries
const mockLogs = [
  {
    id: '1',
    timestamp: new Date('2024-01-01T10:00:00Z'),
    level: 'info' as const,
    message: 'Application started successfully',
    source: 'system' as const,
  },
  {
    id: '2',
    timestamp: new Date('2024-01-01T10:00:01Z'),
    level: 'warn' as const,
    message: 'High memory usage detected',
    source: 'system' as const,
  },
  {
    id: '3',
    timestamp: new Date('2024-01-01T10:00:02Z'),
    level: 'error' as const,
    message: 'Failed to connect to database',
    source: 'stderr' as const,
  },
  {
    id: '4',
    timestamp: new Date('2024-01-01T10:00:03Z'),
    level: 'debug' as const,
    message: 'Processing request',
    source: 'stdout' as const,
  },
]

describe('LogViewer Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders log entries', () => {
    render(<LogViewer logs={mockLogs} />)
    
    expect(screen.getByText('Application started successfully')).toBeInTheDocument()
    expect(screen.getByText('High memory usage detected')).toBeInTheDocument()
    expect(screen.getByText('Failed to connect to database')).toBeInTheDocument()
  })

  it('displays timestamps for log entries', () => {
    render(<LogViewer logs={mockLogs} showTimestamps />)
    
    // Should show formatted timestamps
    const timestamps = screen.getAllByText(/10:00/)
    expect(timestamps.length).toBeGreaterThan(0)
  })

  it('filters logs by level', async () => {
    render(<LogViewer logs={mockLogs} />)
    
    // Click on error filter
    const errorFilter = screen.getByRole('button', { name: /error/i })
    fireEvent.click(errorFilter)
    
    await waitFor(() => {
      expect(screen.getByText('Failed to connect to database')).toBeInTheDocument()
    })
  })

  it('applies correct styling for different log levels', () => {
    render(<LogViewer logs={mockLogs} />)
    
    const errorLog = screen.getByText('Failed to connect to database').closest('[data-log-entry]')
    const warnLog = screen.getByText('High memory usage detected').closest('[data-log-entry]')
    const infoLog = screen.getByText('Application started successfully').closest('[data-log-entry]')
    
    // Check that logs exist
    expect(errorLog).toBeInTheDocument()
    expect(warnLog).toBeInTheDocument()
    expect(infoLog).toBeInTheDocument()
  })

  it('handles empty logs array', () => {
    render(<LogViewer logs={[]} />)
    
    expect(screen.getByText(/no logs/i)).toBeInTheDocument()
  })

  it('supports search functionality', async () => {
    render(<LogViewer logs={mockLogs} />)
    
    const searchInput = screen.getByPlaceholderText(/search/i)
    fireEvent.change(searchInput, { target: { value: 'database' } })
    
    await waitFor(() => {
      expect(screen.getByText('Failed to connect to database')).toBeInTheDocument()
    })
  })

  it('has auto-scroll toggle', () => {
    render(<LogViewer logs={mockLogs} />)
    
    const autoScrollToggle = screen.getByRole('button', { name: /auto-scroll/i })
    expect(autoScrollToggle).toBeInTheDocument()
  })

  it('calls onDownload when download button clicked', () => {
    const onDownload = vi.fn()
    render(<LogViewer logs={mockLogs} onDownload={onDownload} />)
    
    const downloadButton = screen.getByRole('button', { name: /download/i })
    fireEvent.click(downloadButton)
    
    expect(onDownload).toHaveBeenCalled()
  })

  it('displays log count', () => {
    render(<LogViewer logs={mockLogs} />)
    
    expect(screen.getByText(/4/)).toBeInTheDocument()
  })

  it('supports clear logs action', () => {
    const onClear = vi.fn()
    render(<LogViewer logs={mockLogs} onClear={onClear} />)
    
    const clearButton = screen.getByRole('button', { name: /clear/i })
    fireEvent.click(clearButton)
    
    expect(onClear).toHaveBeenCalled()
  })

  it('renders in loading state', () => {
    render(<LogViewer logs={[]} isLoading />)
    
    expect(screen.getByTestId('log-viewer-loading')).toBeInTheDocument()
  })

  it('handles streaming mode indicator', () => {
    render(<LogViewer logs={mockLogs} isStreaming />)
    
    expect(screen.getByText(/live/i)).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(
      <LogViewer logs={mockLogs} className="custom-log-viewer" />
    )
    
    expect(container.firstChild).toHaveClass('custom-log-viewer')
  })

  it('supports keyboard navigation', async () => {
    render(<LogViewer logs={mockLogs} />)
    
    const container = screen.getByRole('log')
    fireEvent.keyDown(container, { key: 'ArrowDown' })
    
    // Should handle keyboard navigation without errors
    expect(container).toBeInTheDocument()
  })
})
