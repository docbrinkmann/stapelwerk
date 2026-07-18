import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock xterm
vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn().mockImplementation(() => ({
    open: vi.fn(),
    write: vi.fn(),
    writeln: vi.fn(),
    clear: vi.fn(),
    dispose: vi.fn(),
    onData: vi.fn((callback) => {
      // Store callback for testing
      return { dispose: vi.fn() }
    }),
    onResize: vi.fn(() => ({ dispose: vi.fn() })),
    loadAddon: vi.fn(),
    cols: 80,
    rows: 24,
  })),
}))

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: vi.fn().mockImplementation(() => ({
    fit: vi.fn(),
    dispose: vi.fn(),
  })),
}))

vi.mock('@xterm/addon-web-links', () => ({
  WebLinksAddon: vi.fn().mockImplementation(() => ({
    dispose: vi.fn(),
  })),
}))

import { TerminalPanel } from '@/components/terminal/terminal-panel'

describe('TerminalPanel Component', () => {
  const mockOnData = vi.fn()
  const mockOnResize = vi.fn()
  const mockOnConnect = vi.fn()
  const mockOnDisconnect = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('renders terminal container', () => {
    render(
      <TerminalPanel
        sessionId="test-session"
        onData={mockOnData}
      />
    )
    
    const container = screen.getByTestId('terminal-container')
    expect(container).toBeInTheDocument()
  })

  it('displays connecting state initially', () => {
    render(
      <TerminalPanel
        sessionId="test-session"
        onData={mockOnData}
        isConnecting
      />
    )
    
    expect(screen.getByText(/connecting/i)).toBeInTheDocument()
  })

  it('displays connected state', () => {
    render(
      <TerminalPanel
        sessionId="test-session"
        onData={mockOnData}
        isConnected
      />
    )
    
    expect(screen.getByText(/connected/i)).toBeInTheDocument()
  })

  it('displays disconnected state', () => {
    render(
      <TerminalPanel
        sessionId="test-session"
        onData={mockOnData}
        isConnected={false}
      />
    )
    
    expect(screen.getByText(/disconnected/i)).toBeInTheDocument()
  })

  it('shows reconnect button when disconnected', () => {
    render(
      <TerminalPanel
        sessionId="test-session"
        onData={mockOnData}
        isConnected={false}
        onReconnect={vi.fn()}
      />
    )
    
    const reconnectButton = screen.getByRole('button', { name: /reconnect/i })
    expect(reconnectButton).toBeInTheDocument()
  })

  it('calls onReconnect when reconnect button clicked', () => {
    const onReconnect = vi.fn()
    render(
      <TerminalPanel
        sessionId="test-session"
        onData={mockOnData}
        isConnected={false}
        onReconnect={onReconnect}
      />
    )
    
    const reconnectButton = screen.getByRole('button', { name: /reconnect/i })
    fireEvent.click(reconnectButton)
    
    expect(onReconnect).toHaveBeenCalled()
  })

  it('renders terminal header with session info', () => {
    render(
      <TerminalPanel
        sessionId="test-session-123"
        onData={mockOnData}
        title="Stack Terminal"
      />
    )
    
    expect(screen.getByText(/stack terminal/i)).toBeInTheDocument()
  })

  it('has clear button in toolbar', () => {
    render(
      <TerminalPanel
        sessionId="test-session"
        onData={mockOnData}
        onClear={vi.fn()}
      />
    )
    
    const clearButton = screen.getByRole('button', { name: /clear/i })
    expect(clearButton).toBeInTheDocument()
  })

  it('calls onClear when clear button clicked', () => {
    const onClear = vi.fn()
    render(
      <TerminalPanel
        sessionId="test-session"
        onData={mockOnData}
        onClear={onClear}
      />
    )
    
    const clearButton = screen.getByRole('button', { name: /clear/i })
    fireEvent.click(clearButton)
    
    expect(onClear).toHaveBeenCalled()
  })

  it('applies custom className', () => {
    const { container } = render(
      <TerminalPanel
        sessionId="test-session"
        onData={mockOnData}
        className="custom-terminal"
      />
    )
    
    expect(container.firstChild).toHaveClass('custom-terminal')
  })

  it('handles theme prop', () => {
    render(
      <TerminalPanel
        sessionId="test-session"
        onData={mockOnData}
        theme="dark"
      />
    )
    
    const container = screen.getByTestId('terminal-container')
    expect(container).toBeInTheDocument()
  })

  it('displays error state', () => {
    render(
      <TerminalPanel
        sessionId="test-session"
        onData={mockOnData}
        error="Connection failed"
      />
    )
    
    expect(screen.getByText(/connection failed/i)).toBeInTheDocument()
  })

  it('has fullscreen toggle button', () => {
    render(
      <TerminalPanel
        sessionId="test-session"
        onData={mockOnData}
        allowFullscreen
      />
    )
    
    const fullscreenButton = screen.getByRole('button', { name: /fullscreen/i })
    expect(fullscreenButton).toBeInTheDocument()
  })

  it('renders loading skeleton when initializing', () => {
    render(
      <TerminalPanel
        sessionId="test-session"
        onData={mockOnData}
        isInitializing
      />
    )
    
    expect(screen.getByTestId('terminal-skeleton')).toBeInTheDocument()
  })

  it('supports read-only mode', () => {
    render(
      <TerminalPanel
        sessionId="test-session"
        onData={mockOnData}
        readOnly
      />
    )
    
    expect(screen.getByText(/read-only/i)).toBeInTheDocument()
  })

  it('has proper accessibility attributes', () => {
    render(
      <TerminalPanel
        sessionId="test-session"
        onData={mockOnData}
        ariaLabel="Interactive terminal"
      />
    )
    
    const container = screen.getByTestId('terminal-container')
    expect(container).toHaveAttribute('aria-label', 'Interactive terminal')
  })
})
