import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { StackTemplateModal } from '../StackTemplateModal';

// Deterministic tRPC + store state. vi.hoisted so the hoisted vi.mock factories
// can reference it. Templates use the real `use_case_templates` payload shape
// (serviceIds + services relation + metadata.tags), not the old StackTemplate DTO.
const harness = vi.hoisted(() => ({
  templates: [
    {
      id: 'tpl-media-server',
      name: 'Media Server',
      description: 'A complete self-hosted media stack with Jellyfin, Sonarr and Radarr',
      category: 'media',
      difficulty: 'intermediate',
      estimatedSetupTime: '45 minutes',
      serviceIds: [1, 2, 3, 4, 5],
      services: [
        { id: 1, name: 'Jellyfin' },
        { id: 2, name: 'Sonarr' },
        { id: 3, name: 'Radarr' },
        { id: 4, name: 'Prowlarr' },
        { id: 5, name: 'qBittorrent' },
      ],
      metadata: { tags: ['media', 'streaming', 'automation'] },
      usageCount: 42,
    },
    {
      id: 'tpl-web-dev',
      name: 'Web Dev Environment',
      description: 'Everything a modern web app needs: database, cache, proxy and Git',
      category: 'development',
      difficulty: 'beginner',
      estimatedSetupTime: '20 minutes',
      serviceIds: [6, 7, 8],
      services: [
        { id: 6, name: 'PostgreSQL' },
        { id: 7, name: 'Redis' },
        { id: 8, name: 'Nginx' },
      ],
      metadata: { tags: ['development', 'database'] },
      usageCount: 30,
    },
    {
      id: 'tpl-monitoring',
      name: 'Monitoring & Observability',
      description: 'Collect metrics and aggregate logs on shared dashboards',
      category: 'monitoring',
      difficulty: 'advanced',
      estimatedSetupTime: '60 minutes',
      serviceIds: [9, 10],
      services: [
        { id: 9, name: 'Prometheus' },
        { id: 10, name: 'Grafana' },
      ],
      metadata: { tags: ['monitoring', 'metrics'] },
      usageCount: 15,
    },
  ],
  fetchCalls: [] as number[],
  added: [] as any[],
  failFetch: false,
  pending: false,
  reset() {
    harness.fetchCalls.length = 0;
    harness.added.length = 0;
    harness.failFetch = false;
    harness.pending = false;
  },
}));

vi.mock('@/utils/trpc', () => {
  const useQuery = () => ({ data: harness.templates, isLoading: false, isError: false, error: null });
  return {
    trpc: {
      templates: {
        getAll: { useQuery },
        search: { useQuery },
      },
      useUtils: () => ({
        services: {
          get: {
            fetch: (input: { id: number }) => {
              harness.fetchCalls.push(input.id);
              if (harness.pending) return new Promise(() => {});
              if (harness.failFetch) return Promise.reject(new Error('fetch failed'));
              return Promise.resolve({
                id: input.id,
                name: `svc-${input.id}`,
                slug: `svc-${input.id}`,
                dockerImage: 'img',
                version: 'latest',
                category: 'cat',
                categoryId: 1,
                categories: { id: 1, name: 'cat', slug: 'cat' },
                ports: [],
                environmentVariables: [],
                resourceRequirements: {},
                volumes: [],
              });
            },
          },
        },
      }),
    },
    api: {},
  };
});

vi.mock('@/stores/stack-builder', () => ({
  useStackServices: () => ({
    addService: (s: any) => {
      harness.added.push(s);
    },
  }),
}));

vi.mock('@/lib/analytics/recommendation-analytics', () => ({
  useRecommendationAnalytics: () => ({
    trackSearch: () => {},
    trackFilter: () => {},
    trackTemplateApplied: () => {},
  }),
}));

// UI component mocks
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) => (open ? <div data-testid="dialog">{children}</div> : null),
  DialogContent: ({ children, className }: any) => <div className={className} data-testid="dialog-content">{children}</div>,
  DialogDescription: ({ children }: any) => <div data-testid="dialog-description">{children}</div>,
  DialogHeader: ({ children }: any) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: any) => <h2 data-testid="dialog-title">{children}</h2>,
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

vi.mock('@/components/ui/input', () => ({
  Input: ({ placeholder, value, onChange, className, ...props }: any) => (
    <input placeholder={placeholder} value={value} onChange={onChange} className={className} data-testid="input" {...props} />
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant, className }: any) => (
    <span className={`badge ${className} variant-${variant}`} data-testid="badge">
      {children}
    </span>
  ),
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, className }: any) => (
    <div className={className} data-testid="scroll-area">
      {children}
    </div>
  ),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => <div className={className} data-testid="card">{children}</div>,
  CardContent: ({ children, className }: any) => <div className={className} data-testid="card-content">{children}</div>,
  CardDescription: ({ children, className }: any) => <div className={className} data-testid="card-description">{children}</div>,
  CardFooter: ({ children, className }: any) => <div className={className} data-testid="card-footer">{children}</div>,
  CardHeader: ({ children, className }: any) => <div className={className} data-testid="card-header">{children}</div>,
  CardTitle: ({ children, className }: any) => <h3 className={className} data-testid="card-title">{children}</h3>,
}));

vi.mock('lucide-react', () => ({
  Search: () => <div data-testid="search-icon" />,
  Plus: () => <div data-testid="plus-icon" />,
  Users: () => <div data-testid="users-icon" />,
  Clock: () => <div data-testid="clock-icon" />,
  Tag: () => <div data-testid="tag-icon" />,
  Layers3: () => <div data-testid="layers-icon" />,
  AlertCircle: () => <div data-testid="alert-icon" />,
  Loader2: () => <div data-testid="loader-icon" />,
}));

describe('StackTemplateModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
  };

  // Category names also appear as tag badges, so query the filter buttons by
  // exact text rather than getByText.
  const categoryButton = (label: string) =>
    screen.getAllByTestId('button').find((b) => b.textContent === label)!;

  beforeEach(() => {
    vi.clearAllMocks();
    harness.reset();
  });

  describe('Modal Rendering', () => {
    it('renders when open', () => {
      render(<StackTemplateModal {...defaultProps} />);

      expect(screen.getByTestId('dialog')).toBeInTheDocument();
      expect(screen.getByTestId('dialog-title')).toHaveTextContent('Stack Templates');
    });

    it('does not render when closed', () => {
      render(<StackTemplateModal {...defaultProps} isOpen={false} />);

      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
    });

    it('renders search input with correct placeholder', () => {
      render(<StackTemplateModal {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText('Search templates...');
      expect(searchInput).toBeInTheDocument();
    });

    it('renders a category filter button per seeded category', () => {
      render(<StackTemplateModal {...defaultProps} />);

      expect(screen.getByText('All')).toBeInTheDocument();
      expect(categoryButton('media')).toBeInTheDocument();
      expect(categoryButton('development')).toBeInTheDocument();
      expect(categoryButton('monitoring')).toBeInTheDocument();
    });
  });

  describe('Template Display', () => {
    it('renders all templates by default', () => {
      render(<StackTemplateModal {...defaultProps} />);

      expect(screen.getByText('Media Server')).toBeInTheDocument();
      expect(screen.getByText('Web Dev Environment')).toBeInTheDocument();
      expect(screen.getByText('Monitoring & Observability')).toBeInTheDocument();
    });

    it('displays template description, usage count and setup time', () => {
      render(<StackTemplateModal {...defaultProps} />);

      expect(
        screen.getByText('A complete self-hosted media stack with Jellyfin, Sonarr and Radarr')
      ).toBeInTheDocument();
      expect(screen.getByText('42 uses')).toBeInTheDocument();
      expect(screen.getByText('45 minutes')).toBeInTheDocument();
    });

    it('displays member service badges (first four, then +N more)', () => {
      render(<StackTemplateModal {...defaultProps} />);

      expect(screen.getByText('Jellyfin')).toBeInTheDocument();
      expect(screen.getByText('Sonarr')).toBeInTheDocument();
      expect(screen.getByText('Radarr')).toBeInTheDocument();
      expect(screen.getByText('Prowlarr')).toBeInTheDocument();
      expect(screen.getByText('+1 more')).toBeInTheDocument();
    });

    it('displays tag badges from template metadata', () => {
      render(<StackTemplateModal {...defaultProps} />);

      expect(screen.getByText('streaming')).toBeInTheDocument();
      expect(screen.getAllByText('automation')[0]).toBeInTheDocument();
    });

    it('applies on-token difficulty badge styling', () => {
      render(<StackTemplateModal {...defaultProps} />);

      expect(screen.getByText('beginner')).toHaveClass('bg-success/10', 'text-success');
      expect(screen.getByText('intermediate')).toHaveClass('bg-warning/10', 'text-warning');
      expect(screen.getByText('advanced')).toHaveClass('bg-destructive/10', 'text-destructive');
    });
  });

  describe('Search and Filter', () => {
    it('filters templates by name when searching', async () => {
      const user = userEvent.setup();
      render(<StackTemplateModal {...defaultProps} />);

      await user.type(screen.getByPlaceholderText('Search templates...'), 'Media');

      expect(screen.getByText('Media Server')).toBeInTheDocument();
      expect(screen.queryByText('Web Dev Environment')).not.toBeInTheDocument();
      expect(screen.queryByText('Monitoring & Observability')).not.toBeInTheDocument();
    });

    it('filters templates by member service name', async () => {
      const user = userEvent.setup();
      render(<StackTemplateModal {...defaultProps} />);

      await user.type(screen.getByPlaceholderText('Search templates...'), 'grafana');

      expect(screen.getByText('Monitoring & Observability')).toBeInTheDocument();
      expect(screen.queryByText('Media Server')).not.toBeInTheDocument();
    });

    it('shows a no-results message when nothing matches', async () => {
      const user = userEvent.setup();
      render(<StackTemplateModal {...defaultProps} />);

      await user.type(screen.getByPlaceholderText('Search templates...'), 'nonexistent-xyz');

      expect(screen.getByText('No templates found matching your criteria.')).toBeInTheDocument();
    });

    it('filters templates by category', async () => {
      const user = userEvent.setup();
      render(<StackTemplateModal {...defaultProps} />);

      await user.click(categoryButton('development'));

      expect(screen.getByText('Web Dev Environment')).toBeInTheDocument();
      expect(screen.queryByText('Media Server')).not.toBeInTheDocument();
      expect(screen.queryByText('Monitoring & Observability')).not.toBeInTheDocument();
    });
  });

  describe('Apply', () => {
    it('resolves the template services and adds them to the builder store, then closes', async () => {
      const user = userEvent.setup();
      const onCloseMock = vi.fn();
      render(<StackTemplateModal {...defaultProps} onClose={onCloseMock} />);

      // First card is the Media Server template.
      const applyButtons = screen.getAllByText('Apply');
      await user.click(applyButtons[0]);

      await waitFor(() => {
        expect(onCloseMock).toHaveBeenCalled();
      });

      // Every member service was fetched and pushed into the builder store.
      expect(harness.fetchCalls).toEqual([1, 2, 3, 4, 5]);
      expect(harness.added).toHaveLength(5);
      // Services are reshaped for the store: category becomes an object.
      expect(harness.added[0].category).toEqual({ id: 1, name: 'cat', slug: 'cat' });
    });

    it('shows a loading state and disables apply while resolving', async () => {
      harness.pending = true;
      const user = userEvent.setup();
      render(<StackTemplateModal {...defaultProps} />);

      await user.click(screen.getAllByText('Apply')[0]);

      expect(screen.getByText('Applying...')).toBeInTheDocument();
      screen.getAllByText('Applying...').forEach((btn) => expect(btn.closest('button')).toBeDisabled());
    });

    it('logs an error when service resolution fails', async () => {
      harness.failFetch = true;
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const user = userEvent.setup();
      render(<StackTemplateModal {...defaultProps} />);

      await user.click(screen.getAllByText('Apply')[0]);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to apply template:', expect.any(Error));
      });

      consoleErrorSpy.mockRestore();
    });
  });
});
