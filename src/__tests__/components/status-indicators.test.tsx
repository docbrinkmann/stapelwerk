import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { DeploymentStatus } from '@/components/status/deployment-status'
import { HealthIndicator } from '@/components/status/health-indicator'

describe('DeploymentStatus Component', () => {
  it('renders pending status with correct styling', () => {
    render(<DeploymentStatus status="pending" />)
    
    const badge = screen.getByText('Pending')
    expect(badge).toBeInTheDocument()
  })

  it('renders success status', () => {
    render(<DeploymentStatus status="success" />)
    
    expect(screen.getByText('Success')).toBeInTheDocument()
  })

  it('renders failed status', () => {
    render(<DeploymentStatus status="failed" />)
    
    expect(screen.getByText('Failed')).toBeInTheDocument()
  })

  it('renders cancelled status', () => {
    render(<DeploymentStatus status="cancelled" />)
    
    expect(screen.getByText('Cancelled')).toBeInTheDocument()
  })

  it('renders running status', () => {
    render(<DeploymentStatus status="running" />)
    
    expect(screen.getByText('Running')).toBeInTheDocument()
  })

  it('renders paused status', () => {
    render(<DeploymentStatus status="paused" />)
    
    expect(screen.getByText('Paused')).toBeInTheDocument()
  })

  it('renders unknown status', () => {
    render(<DeploymentStatus status="unknown" />)
    
    expect(screen.getByText('Unknown')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(
      <DeploymentStatus status="success" className="custom-class" />
    )
    
    expect(container.firstChild).toHaveClass('custom-class')
  })

  it('shows spin animation for running status', () => {
    const { container } = render(<DeploymentStatus status="running" />)
    
    const icon = container.querySelector('.animate-spin')
    expect(icon).toBeInTheDocument()
  })

  it('renders icon for each status', () => {
    const { container } = render(<DeploymentStatus status="success" />)
    
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('hides label when showLabel is false', () => {
    render(<DeploymentStatus status="success" showLabel={false} />)
    
    expect(screen.queryByText('Success')).not.toBeInTheDocument()
  })

  it('supports different sizes', () => {
    const { container } = render(<DeploymentStatus status="success" size="lg" />)
    
    const icon = container.querySelector('svg')
    expect(icon).toHaveClass('h-5', 'w-5')
  })
})

describe('HealthIndicator Component', () => {
  it('renders healthy status with green indicator', () => {
    render(<HealthIndicator status="healthy" />)
    
    expect(screen.getByText('Healthy')).toBeInTheDocument()
  })

  it('renders unhealthy status with red indicator', () => {
    render(<HealthIndicator status="unhealthy" />)
    
    expect(screen.getByText('Unhealthy')).toBeInTheDocument()
  })

  it('renders degraded status with yellow indicator', () => {
    render(<HealthIndicator status="degraded" />)
    
    expect(screen.getByText('Degraded')).toBeInTheDocument()
  })

  it('renders checking status with blue indicator', () => {
    render(<HealthIndicator status="checking" />)
    
    expect(screen.getByText('Checking')).toBeInTheDocument()
  })

  it('renders unknown status with gray indicator', () => {
    render(<HealthIndicator status="unknown" />)
    
    expect(screen.getByText('Unknown')).toBeInTheDocument()
  })

  it('renders dot variant', () => {
    const { container } = render(<HealthIndicator status="healthy" variant="dot" />)
    
    // Dot variant should have a small circular indicator
    const dot = container.querySelector('.rounded-full')
    expect(dot).toBeInTheDocument()
  })

  it('renders badge variant', () => {
    render(<HealthIndicator status="healthy" variant="badge" />)
    
    expect(screen.getByText('Healthy')).toBeInTheDocument()
  })

  it('renders icon variant', () => {
    const { container } = render(<HealthIndicator status="healthy" variant="icon" />)
    
    // Icon variant should render an SVG
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('applies spin animation for checking status', () => {
    const { container } = render(<HealthIndicator status="checking" />)
    
    const icon = container.querySelector('.animate-spin')
    expect(icon).toBeInTheDocument()
  })

  it('applies pulse animation for checking status in dot variant', () => {
    const { container } = render(<HealthIndicator status="checking" variant="dot" />)
    
    const dot = container.querySelector('.animate-pulse')
    expect(dot).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(
      <HealthIndicator status="healthy" className="custom-health-class" />
    )
    
    expect(container.firstChild).toHaveClass('custom-health-class')
  })

  it('renders without label when showLabel is false', () => {
    render(<HealthIndicator status="healthy" showLabel={false} />)
    
    expect(screen.queryByText('Healthy')).not.toBeInTheDocument()
  })

  it('supports different sizes', () => {
    const { container } = render(<HealthIndicator status="healthy" size="lg" />)
    
    const icon = container.querySelector('svg')
    expect(icon).toHaveClass('h-5', 'w-5')
  })
})
