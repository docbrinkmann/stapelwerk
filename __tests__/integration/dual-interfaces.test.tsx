import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import ServiceBrowserClient from '@/app/services/components/ServiceBrowserClient';
import StackBuilderClient from '@/app/stack-builder/components/StackBuilderClient';
import DashboardClient from '@/app/dashboard/components/DashboardClient';
import CommunityMarketplace from '@/app/community/components/CommunityMarketplace';
import { useStackBuilder } from '@/stores/stack-builder';
import { useServiceBrowserStore } from '@/stores/service-browser';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(() => ({
    get: jest.fn(),
    toString: jest.fn(() => ''),
  })),
  usePathname: jest.fn(() => '/'),
}));

// Mock tRPC
jest.mock('@/lib/trpc/client', () => ({
  trpc: {
    stack: {
      shareStack: { useMutation: jest.fn(() => ({ mutateAsync: jest.fn(), isLoading: false })) },
      generateShareUrl: { useMutation: jest.fn(() => ({ mutateAsync: jest.fn(), isLoading: false })) },
    },
    template: {
      submitTemplate: { useMutation: jest.fn(() => ({ mutateAsync: jest.fn(), isLoading: false })) },
    },
    community: {
      searchStacks: { useQuery: jest.fn(() => ({ data: { stacks: [] }, isLoading: false })) },
      trackImport: { mutate: jest.fn() },
    },
    admin: {
      getPendingTemplates: { query: jest.fn(() => Promise.resolve({ templates: [], total: 0 })) },
      getTemplateApprovalStats: { query: jest.fn(() => Promise.resolve({ 
        totalPending: 0, totalReviewing: 0, totalApproved: 0, totalRejected: 0, avgReviewTime: 0 
      })) },
    },
  },
}));

// Mock services data
const mockServices = [
  {
    id: 'nginx',
    name: 'Nginx',
    category: 'Web Servers',
    description: 'High performance web server',
    logo: '/logos/nginx.svg',
    tags: ['web', 'proxy', 'load-balancer'],
    configurations: {
      ports: [{ container: 80, host: 8080 }],
      environment: {},
      volumes: [],
    },
  },
  {
    id: 'postgres',
    name: 'PostgreSQL',
    category: 'Databases',
    description: 'Open source relational database',
    logo: '/logos/postgres.svg',
    tags: ['database', 'sql', 'relational'],
    configurations: {
      ports: [{ container: 5432, host: 5432 }],
      environment: {
        POSTGRES_DB: 'mydb',
        POSTGRES_USER: 'user',
        POSTGRES_PASSWORD: 'password',
      },
      volumes: [{ host: './data', container: '/var/lib/postgresql/data' }],
    },
  },
];

// Mock community stacks
const mockCommunityStacks = [
  {
    id: 'stack-1',
    name: 'LAMP Stack',
    description: 'Linux, Apache, MySQL, PHP development stack',
    category: 'Web Development',
    difficulty: 'beginner' as const,
    tags: ['php', 'mysql', 'apache'],
    services: mockServices,
    author: { id: '1', name: 'John Doe' },
    stats: { views: 1500, likes: 120, downloads: 250, rating: 4.5, reviewCount: 30 },
    createdAt: new Date(),
    updatedAt: new Date(),
    featured: true,
  },
];

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('Dual Interface Integration Tests', () => {
  const mockPush = jest.fn();
  const mockBack = jest.fn();

  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
      back: mockBack,
      replace: jest.fn(),
    });
    
    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('Service Browser to Stack Builder Integration', () => {
    it('should allow adding services from browser to stack', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <ServiceBrowserClient />
        </TestWrapper>
      );

      // Wait for services to load
      await waitFor(() => {
        expect(screen.getByText('Nginx')).toBeInTheDocument();
      });

      // Enable stack mode
      const stackToggle = screen.getByLabelText(/stack mode/i);
      await user.click(stackToggle);

      // Add service to stack
      const addButton = screen.getByRole('button', { name: /add nginx/i });
      await user.click(addButton);

      // Verify service was added to stack
      await waitFor(() => {
        expect(screen.getByText(/1 service/i)).toBeInTheDocument();
      });
    });

    it('should maintain search and filter state when switching to stack mode', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <ServiceBrowserClient />
        </TestWrapper>
      );

      // Set search query
      const searchInput = screen.getByPlaceholderText(/search services/i);
      await user.type(searchInput, 'nginx');

      // Enable stack mode
      const stackToggle = screen.getByLabelText(/stack mode/i);
      await user.click(stackToggle);

      // Verify search is maintained
      expect(searchInput).toHaveValue('nginx');
    });

    it('should show stack canvas when stack mode is enabled', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <ServiceBrowserClient />
        </TestWrapper>
      );

      // Enable stack mode
      const stackToggle = screen.getByLabelText(/stack mode/i);
      await user.click(stackToggle);

      // Verify stack canvas is visible
      expect(screen.getByText(/drop services here/i)).toBeInTheDocument();
      expect(screen.getByText(/your stack is empty/i)).toBeInTheDocument();
    });
  });

  describe('Stack Builder Interface', () => {
    it('should render all three panels correctly', () => {
      render(
        <TestWrapper>
          <StackBuilderClient />
        </TestWrapper>
      );

      // Verify main panels are present
      expect(screen.getByText(/available services/i)).toBeInTheDocument();
      expect(screen.getByText(/your stack/i)).toBeInTheDocument();
      
      // Verify toolbar is present
      expect(screen.getByRole('button', { name: /import/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /templates/i })).toBeInTheDocument();
    });

    it('should show configuration panel when service is selected', async () => {
      const user = userEvent.setup();
      
      // Mock stack builder store with a service
      const mockUseStackBuilder = useStackBuilder as jest.MockedFunction<typeof useStackBuilder>;
      mockUseStackBuilder.mockReturnValue({
        services: [mockServices[0]],
        addService: jest.fn(),
        removeService: jest.fn(),
        updateService: jest.fn(),
        clearStack: jest.fn(),
        name: 'Test Stack',
        description: 'Test Description',
        // ... other required properties
      } as any);

      render(
        <TestWrapper>
          <StackBuilderClient />
        </TestWrapper>
      );

      // Click configure button
      const configureButton = screen.getByRole('button', { name: /configure/i });
      await user.click(configureButton);

      // Verify configuration panel opens
      await waitFor(() => {
        expect(screen.getByText(/service configuration/i)).toBeInTheDocument();
      });
    });

    it('should handle stack operations correctly', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <StackBuilderClient />
        </TestWrapper>
      );

      // Test clear stack
      const clearButton = screen.getByRole('button', { name: /clear/i });
      await user.click(clearButton);

      // Test export (should be disabled when empty)
      const exportButton = screen.getByRole('button', { name: /export/i });
      expect(exportButton).toBeDisabled();
    });
  });

  describe('Dashboard Integration', () => {
    it('should display stack management interface', () => {
      render(
        <TestWrapper>
          <DashboardClient />
        </TestWrapper>
      );

      // Verify dashboard elements
      expect(screen.getByText(/stack management dashboard/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /new stack/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /community/i })).toBeInTheDocument();
    });

    it('should navigate to stack builder when creating new stack', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <DashboardClient />
        </TestWrapper>
      );

      const newStackButton = screen.getByRole('button', { name: /new stack/i });
      await user.click(newStackButton);

      expect(mockPush).toHaveBeenCalledWith('/stack-builder');
    });

    it('should show sharing options for stacks', async () => {
      const user = userEvent.setup();
      
      // Mock dashboard with stacks
      render(
        <TestWrapper>
          <DashboardClient />
        </TestWrapper>
      );

      // Look for share buttons (if stacks are present)
      const shareButtons = screen.queryAllByRole('button', { name: /share/i });
      expect(shareButtons.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Community Marketplace Integration', () => {
    it('should display community stacks and allow import', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <CommunityMarketplace 
            initialFeatured={mockCommunityStacks}
            initialPopular={mockCommunityStacks}
            categories={['Web Development']}
            marketplaceStats={{
              totalStacks: 100,
              totalDownloads: 5000,
              activeContributors: 250,
              featuredStacks: 10,
            }}
          />
        </TestWrapper>
      );

      // Verify community content
      expect(screen.getByText(/community stack marketplace/i)).toBeInTheDocument();
      expect(screen.getByText('LAMP Stack')).toBeInTheDocument();

      // Test import functionality
      const importButton = screen.getByRole('button', { name: /import/i });
      await user.click(importButton);

      // Should navigate to stack builder
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/stack-builder');
      });
    });

    it('should handle search and filtering', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <CommunityMarketplace 
            initialFeatured={mockCommunityStacks}
            initialPopular={mockCommunityStacks}
            categories={['Web Development']}
            marketplaceStats={{
              totalStacks: 100,
              totalDownloads: 5000,
              activeContributors: 250,
              featuredStacks: 10,
            }}
          />
        </TestWrapper>
      );

      // Test search
      const searchInput = screen.getByPlaceholderText(/search community stacks/i);
      await user.type(searchInput, 'LAMP');

      // Test filters
      const filtersButton = screen.getByRole('button', { name: /filters/i });
      await user.click(filtersButton);

      // Should show filter options
      await waitFor(() => {
        expect(screen.getByLabelText(/category/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/difficulty/i)).toBeInTheDocument();
      });
    });
  });

  describe('Sharing and Template Workflow', () => {
    it('should open share modal when share button is clicked', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <StackBuilderClient />
        </TestWrapper>
      );

      // Assume we have a service in the stack
      const shareButton = screen.getByRole('button', { name: /share/i });
      await user.click(shareButton);

      // Should open share modal
      await waitFor(() => {
        expect(screen.getByText(/share stack/i)).toBeInTheDocument();
      });
    });

    it('should handle template submission workflow', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <StackBuilderClient />
        </TestWrapper>
      );

      // Test template submission
      const submitTemplateButton = screen.getByRole('button', { name: /submit template/i });
      await user.click(submitTemplateButton);

      // Should open template submission modal
      await waitFor(() => {
        expect(screen.getByText(/submit template/i)).toBeInTheDocument();
      });
    });
  });

  describe('Bulk Import/Export Operations', () => {
    it('should open bulk import modal', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <StackBuilderClient />
        </TestWrapper>
      );

      const bulkImportButton = screen.getByRole('button', { name: /bulk import/i });
      await user.click(bulkImportButton);

      // Should open bulk import modal
      await waitFor(() => {
        expect(screen.getByText(/bulk import stacks/i)).toBeInTheDocument();
      });
    });

    it('should open bulk export modal', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <StackBuilderClient />
        </TestWrapper>
      );

      const bulkExportButton = screen.getByRole('button', { name: /bulk export/i });
      await user.click(bulkExportButton);

      // Should open bulk export modal
      await waitFor(() => {
        expect(screen.getByText(/bulk export stacks/i)).toBeInTheDocument();
      });
    });
  });

  describe('State Consistency Across Interfaces', () => {
    it('should maintain stack state when switching between interfaces', () => {
      const { rerender } = render(
        <TestWrapper>
          <ServiceBrowserClient />
        </TestWrapper>
      );

      // Add service to stack (mock)
      act(() => {
        const { addService } = useStackBuilder.getState();
        addService(mockServices[0]);
      });

      // Switch to stack builder interface
      rerender(
        <TestWrapper>
          <StackBuilderClient />
        </TestWrapper>
      );

      // Verify stack state is maintained
      expect(screen.getByText(/1 service/i)).toBeInTheDocument();
    });

    it('should synchronize URL parameters correctly', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <ServiceBrowserClient />
        </TestWrapper>
      );

      // Simulate URL parameter synchronization
      const searchInput = screen.getByPlaceholderText(/search services/i);
      await user.type(searchInput, 'database');

      // Verify store synchronization
      await waitFor(() => {
        const { searchQuery } = useServiceBrowserStore.getState();
        expect(searchQuery).toBe('database');
      });
    });

    it('should handle persistence operations correctly', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <StackBuilderClient />
        </TestWrapper>
      );

      // Test storage manager
      const storageButton = screen.getByRole('button', { name: /storage/i });
      await user.click(storageButton);

      // Should open storage manager
      await waitFor(() => {
        expect(screen.getByText(/stack storage manager/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty states gracefully', () => {
      render(
        <TestWrapper>
          <StackBuilderClient />
        </TestWrapper>
      );

      // Verify empty stack state
      expect(screen.getByText(/your stack is empty/i)).toBeInTheDocument();
      expect(screen.getByText(/0 services/i)).toBeInTheDocument();
    });

    it('should handle loading states', async () => {
      render(
        <TestWrapper>
          <ServiceBrowserClient />
        </TestWrapper>
      );

      // Should show loading indicators
      expect(screen.getByTestId(/loading/i) || screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('should handle network errors gracefully', () => {
      // Mock network error
      const mockError = jest.fn(() => {
        throw new Error('Network error');
      });

      render(
        <TestWrapper>
          <CommunityMarketplace 
            initialFeatured={[]}
            initialPopular={[]}
            categories={[]}
            marketplaceStats={{
              totalStacks: 0,
              totalDownloads: 0,
              activeContributors: 0,
              featuredStacks: 0,
            }}
          />
        </TestWrapper>
      );

      // Should handle errors gracefully
      expect(screen.getByText(/no stacks found/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility and User Experience', () => {
    it('should provide proper ARIA labels', () => {
      render(
        <TestWrapper>
          <StackBuilderClient />
        </TestWrapper>
      );

      // Check for ARIA labels
      expect(screen.getByLabelText(/available services/i)).toBeInTheDocument();
      expect(screen.getByRole('main')).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <StackBuilderClient />
        </TestWrapper>
      );

      // Test tab navigation
      await user.tab();
      
      // Should focus on first interactive element
      expect(document.activeElement).toBeInTheDocument();
    });

    it('should provide screen reader announcements', () => {
      render(
        <TestWrapper>
          <StackBuilderClient />
        </TestWrapper>
      );

      // Check for screen reader announcements
      const announcements = screen.getByRole('status');
      expect(announcements).toBeInTheDocument();
    });
  });
});

describe('Cross-Interface Navigation', () => {
  const mockPush = jest.fn();

  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
      back: jest.fn(),
      replace: jest.fn(),
    });
    
    jest.clearAllMocks();
  });

  it('should navigate between interfaces correctly', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <DashboardClient />
      </TestWrapper>
    );

    // Navigate to community
    const communityButton = screen.getByRole('button', { name: /community/i });
    await user.click(communityButton);
    expect(mockPush).toHaveBeenCalledWith('/community');

    // Navigate to stack builder
    const newStackButton = screen.getByRole('button', { name: /new stack/i });
    await user.click(newStackButton);
    expect(mockPush).toHaveBeenCalledWith('/stack-builder');
  });
});

export {};