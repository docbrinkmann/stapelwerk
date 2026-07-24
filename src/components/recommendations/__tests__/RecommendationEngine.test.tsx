import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock the tRPC client the component actually imports (@/utils/trpc)
vi.mock('@/utils/trpc', () => ({
  api: {},
  trpc: {
    templates: {
      getRecommendations: {
        useQuery: vi.fn(),
      },
      getPopular: {
        useQuery: vi.fn(),
      },
    },
    recommendations: {
      getForServices: {
        useQuery: vi.fn(),
      },
    },
    // Imperative utils used by the one-click optimization apply.
    useUtils: () => ({
      services: {
        getBySlug: {
          fetch: vi.fn().mockResolvedValue({ id: 42, name: 'Prometheus', slug: 'prometheus' }),
        },
      },
    }),
  },
}));

// Mock the stack-builder store hook
vi.mock('@/stores/stack-builder', () => ({
  useStackServices: vi.fn(),
}));

// Mock the analytics hook (fires tracking side effects otherwise)
vi.mock('@/lib/analytics/recommendation-analytics', () => ({
  useRecommendationAnalytics: () => ({
    trackRecommendationViewed: vi.fn(),
    trackRecommendationClicked: vi.fn(),
    trackTemplateApplied: vi.fn(),
    trackServiceAdded: vi.fn(),
    trackFeedback: vi.fn(),
    trackSearch: vi.fn(),
    trackFilter: vi.fn(),
    trackOptimization: vi.fn(),
    updateContext: vi.fn(),
    getSummary: vi.fn(),
    setEnabled: vi.fn(),
  }),
}));

// Mock UI components
vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => <div className={className} data-testid="card">{children}</div>,
  CardContent: ({ children, className }: any) => <div className={className} data-testid="card-content">{children}</div>,
  CardDescription: ({ children, className }: any) => <div className={className} data-testid="card-description">{children}</div>,
  CardHeader: ({ children, className }: any) => <div className={className} data-testid="card-header">{children}</div>,
  CardTitle: ({ children, className }: any) => <h3 className={className} data-testid="card-title">{children}</h3>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant, className }: any) => (
    <span className={`badge ${className} variant-${variant}`} data-testid="badge">
      {children}
    </span>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, variant, size, className, ...props }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${className} variant-${variant} size-${size}`}
      data-testid="button"
      {...props}
    >
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, className }: any) => (
    <div className={className} data-testid="scroll-area">
      {children}
    </div>
  ),
}));

vi.mock('lucide-react', () => ({
  Lightbulb: () => <div data-testid="lightbulb-icon" />,
  TrendingUp: () => <div data-testid="trending-up-icon" />,
  Users: () => <div data-testid="users-icon" />,
  Star: () => <div data-testid="star-icon" />,
  ChevronRight: () => <div data-testid="chevron-right-icon" />,
  Zap: () => <div data-testid="zap-icon" />,
  Target: () => <div data-testid="target-icon" />,
  Clock: () => <div data-testid="clock-icon" />,
  AlertTriangle: () => <div data-testid="alert-triangle-icon" />,
  CheckCircle: () => <div data-testid="check-circle-icon" />,
}));

import { RecommendationEngine } from '../RecommendationEngine';
import { trpc } from '@/utils/trpc';
import { useStackServices } from '@/stores/stack-builder';

const mockUseStackServices = vi.mocked(useStackServices);
const mockGetRecommendations = vi.mocked((trpc as any).templates.getRecommendations.useQuery);
const mockGetPopular = vi.mocked((trpc as any).templates.getPopular.useQuery);
const mockGetForServices = vi.mocked((trpc as any).recommendations.getForServices.useQuery);

// Stack entries follow the stack-builder shape: { service: { name, category: { slug } } }
const stackService = (id: string, name: string, categorySlug: string) => ({
  id,
  service: { id, name, category: { slug: categorySlug } },
});

const emptyStack = { services: [] };

const databaseStack = {
  services: [
    // Real seeded category slugs — the optimization heuristics match on these.
    stackService('1', 'PostgreSQL', 'databases'),
    stackService('2', 'Nginx', 'web-servers'),
  ],
};

// Server-shaped recommendations (recommendations.getForServices output).
const pgAdminService = {
  id: 3, name: 'PgAdmin', slug: 'pgadmin',
  description: 'Web-based PostgreSQL administration tool',
  categories: { name: 'Database Tools' },
};
const serviceRecs = [
  { serviceId: 3, score: 0.9, rationale: 'Manages your PostgreSQL database', category: 'complementary', service: pgAdminService },
];

// Recommendations come back as an array of { template, score, reason, ... }
const mockRecommendationsData = [
  {
    template: {
      id: 'template-1',
      name: 'Database Management Stack',
      description: 'Complete database management with admin tools',
      category: 'Database',
      usageCount: 1500,
      metadata: { rating: 4.8 },
    },
    score: 0.9,
    reason: 'Perfect match for your PostgreSQL setup',
    matchingServices: ['PostgreSQL', 'PgAdmin'],
    newServices: ['Grafana'],
  },
  {
    template: {
      id: 'template-2',
      name: 'Web Application Stack',
      description: 'Full web application with caching and monitoring',
      category: 'Web',
      usageCount: 2200,
      metadata: { rating: 4.6 },
    },
    score: 0.75,
    reason: 'Complements your web server setup',
    matchingServices: ['Nginx', 'Redis'],
    newServices: ['PM2', 'Grafana'],
  },
];

describe('RecommendationEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockGetRecommendations.mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    mockGetPopular.mockReturnValue({
      data: null,
      isLoading: false,
    } as any);

    mockGetForServices.mockReturnValue({
      data: [],
      isLoading: false,
    } as any);
  });

  describe('Empty Stack State', () => {
    beforeEach(() => {
      mockUseStackServices.mockReturnValue(emptyStack as any);
    });

    it('shows a guided start with popular templates', () => {
      mockGetPopular.mockReturnValue({
        data: [{ id: 'tpl-media', name: 'Media Server', description: 'Jellyfin + *arr' }],
        isLoading: false,
      } as any);
      const onTemplateSelect = vi.fn();
      render(<RecommendationEngine onTemplateSelect={onTemplateSelect} />);

      expect(screen.getByText('Start your stack')).toBeInTheDocument();
      const starter = screen.getByText('Media Server');
      expect(starter).toBeInTheDocument();
      fireEvent.click(starter);
      expect(onTemplateSelect).toHaveBeenCalledWith('tpl-media');
    });

    it('falls back to a hint (with target icon) when there are no popular templates', () => {
      mockGetPopular.mockReturnValue({ data: [], isLoading: false } as any);
      render(<RecommendationEngine />);

      expect(screen.getByText('Start your stack')).toBeInTheDocument();
      expect(screen.getByText(/Add a service to get compatibility-based recommendations/i)).toBeInTheDocument();
      expect(screen.getByTestId('target-icon')).toBeInTheDocument();
    });
  });

  describe('With Stack Services', () => {
    beforeEach(() => {
      mockUseStackServices.mockReturnValue(databaseStack as any);
    });

    it('renders recommendation tabs when stack has services', () => {
      render(<RecommendationEngine />);

      expect(screen.getByText('Recommendations')).toBeInTheDocument();
      expect(screen.getByText('Templates')).toBeInTheDocument();
      expect(screen.getByText('Services')).toBeInTheDocument();
      expect(screen.getByText('Optimize')).toBeInTheDocument();
    });

    it('shows loading state when fetching recommendations', () => {
      mockGetRecommendations.mockReturnValue({
        data: null,
        isLoading: true,
        isError: false,
        error: null,
        refetch: vi.fn(),
      } as any);

      render(<RecommendationEngine />);

      expect(screen.getByText('Finding recommendations...')).toBeInTheDocument();
    });

    it('displays template recommendations when available', () => {
      mockGetRecommendations.mockReturnValue({
        data: mockRecommendationsData,
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      } as any);

      render(<RecommendationEngine />);

      expect(screen.getByText('Database Management Stack')).toBeInTheDocument();
      expect(screen.getByText('Complete database management with admin tools')).toBeInTheDocument();
      expect(screen.getByText('Perfect match for your PostgreSQL setup')).toBeInTheDocument();
      expect(screen.getByText('90% match')).toBeInTheDocument();
      expect(screen.getByText('1,500 downloads')).toBeInTheDocument();
    });

    it('displays service recommendations in Services tab', async () => {
      mockGetForServices.mockReturnValue({ data: serviceRecs, isLoading: false } as any);
      const user = userEvent.setup({ delay: null });
      render(<RecommendationEngine />);

      const servicesTab = screen.getByText('Services');
      await user.click(servicesTab);

      expect(screen.getByText('PgAdmin')).toBeInTheDocument();
      expect(screen.getByText('Web-based PostgreSQL administration tool')).toBeInTheDocument();
      expect(screen.getByText('Manages your PostgreSQL database')).toBeInTheDocument();
    });

    it('shows optimization suggestions in Optimize tab', async () => {
      const user = userEvent.setup({ delay: null });
      render(<RecommendationEngine />);

      const optimizeTab = screen.getByText('Optimize');
      await user.click(optimizeTab);

      expect(screen.getByText('Stack Analysis')).toBeInTheDocument();
      expect(screen.getByText('Add monitoring')).toBeInTheDocument();
      expect(screen.getByText('Nothing in this stack watches health or metrics yet.')).toBeInTheDocument();
      // Suggestions are applicable: concrete one-click add buttons.
      expect(screen.getByTestId('apply-optimization-prometheus')).toBeInTheDocument();
      expect(screen.getByTestId('apply-optimization-grafana')).toBeInTheDocument();
    });

    it('handles template selection callback', async () => {
      const onTemplateSelectMock = vi.fn();
      mockGetRecommendations.mockReturnValue({
        data: mockRecommendationsData,
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      } as any);

      const user = userEvent.setup({ delay: null });
      render(<RecommendationEngine onTemplateSelect={onTemplateSelectMock} />);

      const applyButton = screen.getAllByText('Apply')[0];
      await user.click(applyButton);

      expect(onTemplateSelectMock).toHaveBeenCalledWith('template-1');
    });

    it('handles service recommendation callback with the full service', async () => {
      mockUseStackServices.mockReturnValue(databaseStack as any);
      mockGetForServices.mockReturnValue({ data: serviceRecs, isLoading: false } as any);
      const onServiceRecommendMock = vi.fn();
      const user = userEvent.setup({ delay: null });
      render(<RecommendationEngine onServiceRecommend={onServiceRecommendMock} />);

      const servicesTab = screen.getByText('Services');
      await user.click(servicesTab);

      const addServiceButton = screen.getAllByText('Add Service')[0];
      await user.click(addServiceButton);

      expect(onServiceRecommendMock).toHaveBeenCalledWith(pgAdminService);
    });
  });

  describe('Service Recommendations Logic', () => {
    beforeEach(() => {
      mockUseStackServices.mockReturnValue(databaseStack as any);
    });

    it('renders the server-scored recommendations with their rationale', () => {
      mockGetForServices.mockReturnValue({ data: serviceRecs, isLoading: false } as any);
      render(<RecommendationEngine />);

      fireEvent.click(screen.getByText('Services'));

      expect(screen.getByText('PgAdmin')).toBeInTheDocument();
      expect(screen.getByText('90% fit')).toBeInTheDocument();
      expect(screen.getByText('Manages your PostgreSQL database')).toBeInTheDocument();
    });

    it('shows the complete message when the server returns no recommendations', () => {
      mockGetForServices.mockReturnValue({ data: [], isLoading: false } as any);
      render(<RecommendationEngine />);

      fireEvent.click(screen.getByText('Services'));

      expect(screen.getByText('Your stack looks complete!')).toBeInTheDocument();
      expect(screen.getByText('No immediate service recommendations')).toBeInTheDocument();
    });
  });

  describe('Optimization Analysis', () => {
    it('suggests monitoring for stacks without monitoring', () => {
      mockUseStackServices.mockReturnValue(databaseStack as any);
      render(<RecommendationEngine />);

      fireEvent.click(screen.getByText('Optimize'));

      expect(screen.getByText('Add monitoring')).toBeInTheDocument();
      // databaseStack yields two high-priority suggestions (monitoring + security).
      expect(screen.getAllByText('high').length).toBeGreaterThan(0);
      expect(screen.getByText('See problems before your services go down.')).toBeInTheDocument();
    });

    it('applies a suggestion with one click — the fetched service reaches the builder', async () => {
      mockUseStackServices.mockReturnValue(databaseStack as any);
      const onServiceRecommend = vi.fn();
      const user = userEvent.setup({ delay: null });
      render(<RecommendationEngine onServiceRecommend={onServiceRecommend} />);

      fireEvent.click(screen.getByText('Optimize'));
      await user.click(screen.getByTestId('apply-optimization-prometheus'));

      await waitFor(() =>
        expect(onServiceRecommend).toHaveBeenCalledWith(
          expect.objectContaining({ slug: 'prometheus' }),
        ),
      );
    });

    it('suggests security for database stacks by CATEGORY (name.includes never matched)', () => {
      mockUseStackServices.mockReturnValue({
        // The old heuristic looked for name.includes('database') — "PostgreSQL"
        // never matched. The category is what identifies a database.
        services: [stackService('1', 'PostgreSQL', 'databases')],
      } as any);

      render(<RecommendationEngine />);

      fireEvent.click(screen.getByText('Optimize'));

      expect(screen.getByText('Protect your database')).toBeInTheDocument();
      expect(screen.getByText('The stack has a database but no security service.')).toBeInTheDocument();
      expect(screen.getByTestId('apply-optimization-crowdsec')).toBeInTheDocument();
    });

    it('suggests a reverse proxy for large stacks without web-servers', () => {
      mockUseStackServices.mockReturnValue({
        services: Array.from({ length: 6 }, (_, i) =>
          stackService(String(i + 1), `Service ${i}`, 'media')
        ),
      } as any);

      render(<RecommendationEngine />);

      fireEvent.click(screen.getByText('Optimize'));

      expect(screen.getByText('Add a reverse proxy')).toBeInTheDocument();
      expect(screen.getByText('medium')).toBeInTheDocument();
      expect(screen.getByTestId('apply-optimization-caddy')).toBeInTheDocument();
    });

    it('shows well optimized message when no optimizations needed', () => {
      mockUseStackServices.mockReturnValue({
        services: [
          stackService('1', 'PostgreSQL', 'database'),
          stackService('2', 'Grafana', 'monitoring'),
        ],
      } as any);

      render(<RecommendationEngine />);

      fireEvent.click(screen.getByText('Optimize'));

      expect(screen.getByText('Your stack is well optimized!')).toBeInTheDocument();
      expect(screen.getByText('No immediate optimizations needed')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('displays fallback state when API fails', () => {
      mockUseStackServices.mockReturnValue(databaseStack as any);
      mockGetRecommendations.mockReturnValue({
        data: null,
        isLoading: false,
        isError: true,
        error: new Error('Failed to fetch recommendations'),
        refetch: vi.fn(),
      } as any);

      render(<RecommendationEngine />);

      expect(screen.getByText('No template recommendations available')).toBeInTheDocument();
      expect(screen.getByText('Try adding more services to your stack')).toBeInTheDocument();
    });
  });

  describe('Configuration Options', () => {
    it('respects maxRecommendations prop', () => {
      mockUseStackServices.mockReturnValue(databaseStack as any);
      render(<RecommendationEngine maxRecommendations={2} />);

      fireEvent.click(screen.getByText('Services'));

      const serviceRecommendations = screen.getAllByTestId('card').filter(card =>
        card.className.includes('border-l-green-500')
      );
      expect(serviceRecommendations.length).toBeLessThanOrEqual(2);
    });

    it('applies custom className', () => {
      mockUseStackServices.mockReturnValue(emptyStack as any);
      const { container } = render(<RecommendationEngine className="custom-class" />);

      expect(container.querySelector('.custom-class')).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    beforeEach(() => {
      mockUseStackServices.mockReturnValue(databaseStack as any);
    });

    it('switches between tabs correctly', async () => {
      const user = userEvent.setup({ delay: null });
      render(<RecommendationEngine />);

      // Default tab should be Templates
      expect(screen.getByText('Templates').closest('button')).toHaveClass('variant-default');

      // Switch to Services tab
      await user.click(screen.getByText('Services'));
      expect(screen.getByText('Services').closest('button')).toHaveClass('variant-default');
      expect(screen.getByText('Templates').closest('button')).toHaveClass('variant-ghost');
    });

    it('handles re-analyze button in optimize tab', async () => {
      const refetchMock = vi.fn();
      mockGetRecommendations.mockReturnValue({
        data: mockRecommendationsData,
        isLoading: false,
        isError: false,
        error: null,
        refetch: refetchMock,
      } as any);

      const user = userEvent.setup({ delay: null });
      render(<RecommendationEngine />);

      await user.click(screen.getByText('Optimize'));

      const reAnalyzeButton = screen.getByText('Re-analyze');
      await user.click(reAnalyzeButton);

      expect(refetchMock).toHaveBeenCalled();
    });
  });

  describe('Confidence and Priority Colors', () => {
    beforeEach(() => {
      mockUseStackServices.mockReturnValue(databaseStack as any);
      mockGetRecommendations.mockReturnValue({
        data: mockRecommendationsData,
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      } as any);
    });

    it('applies correct confidence colors for templates', () => {
      render(<RecommendationEngine />);

      const highConfidenceBadge = screen.getByText('90% match');
      expect(highConfidenceBadge).toHaveClass('bg-success/10', 'text-success');

      const mediumConfidenceBadge = screen.getByText('75% match');
      expect(mediumConfidenceBadge).toHaveClass('bg-warning/10', 'text-warning');
    });

    it('applies correct confidence colors for services', () => {
      mockGetForServices.mockReturnValue({ data: serviceRecs, isLoading: false } as any);
      render(<RecommendationEngine />);

      fireEvent.click(screen.getByText('Services'));

      const pgadminBadge = screen.getByText('90% fit');
      expect(pgadminBadge).toHaveClass('bg-success/10', 'text-success');
    });
  });
});
