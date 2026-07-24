import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/trpc/react-client', () => ({
  trpc: {
    monitoring: {
      getSystemHealth: {
        useQuery: () => ({
          data: { healthScore: 92, status: 'healthy', metrics: { totalStacks: 3, activeStacks: 1, totalServices: 7, activeAlerts: 0 } },
          isLoading: false,
          error: null,
        }),
      },
    },
    analytics: {
      getDeploymentStats: {
        useQuery: () => ({
          data: { total: 5, running: 1, completed: 3, failed: 1, pending: 0 },
          isLoading: false,
          error: null,
        }),
      },
    },
  },
}))

import { MonitoringPanel } from '../monitoring-panel'
import { AnalyticsPanel } from '../analytics-panel'

describe('MonitoringPanel', () => {
  it('shows real system health instead of a coming-soon placeholder', () => {
    render(<MonitoringPanel />)
    expect(screen.getByText('92', { exact: false })).toBeInTheDocument()
    expect(screen.getByText(/healthy/i)).toBeInTheDocument()
    expect(screen.getByText('Services')).toBeInTheDocument()
    expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument()
  })
})

describe('AnalyticsPanel', () => {
  it('shows real deployment stats instead of a coming-soon placeholder', () => {
    render(<AnalyticsPanel />)
    expect(screen.getByText('Total Deployments')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument()
  })
})
