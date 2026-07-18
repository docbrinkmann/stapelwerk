import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import StackBuilderClient from '@/app/stack-builder/components/StackBuilderClient';
import ServiceBrowserClient from '@/app/services/components/ServiceBrowserClient';
import DashboardClient from '@/app/dashboard/components/DashboardClient';
import CommunityMarketplace from '@/app/community/components/CommunityMarketplace';

// Mock implementations
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(() => ({
    get: jest.fn(),
    toString: jest.fn(() => ''),
  })),
  usePathname: jest.fn(() => '/'),
}));

jest.mock('@/lib/trpc/client');
jest.mock('@/stores/stack-builder');
jest.mock('@/store/service-browser');

// Mock file operations
global.URL.createObjectURL = jest.fn(() => 'mock-blob-url');
global.URL.revokeObjectURL = jest.fn();

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn(() => Promise.resolve()),
    readText: jest.fn(() => Promise.resolve('mock text')),
  },
});

// Mock file reader
global.FileReader = class MockFileReader {
  result = null;
  readAsText = jest.fn(function (this: FileReader) {
    this.result = JSON.stringify({
      name: 'Test Stack',
      services: [{
        id: 'nginx',
        name: 'Nginx',
        category: 'Web Servers',
      }],
    });
    setTimeout(() => this.onload?.(new Event('load')), 0);
  });
  onload = null;
  onerror = null;
} as any;

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

describe('Stack Builder End-to-End Workflow Tests', () => {
  const mockPush = jest.fn();

  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
      back: jest.fn(),
      replace: jest.fn(),
    });
    
    jest.clearAllMocks();
  });

  describe('Complete Stack Building Workflow', () => {
    it('should complete full stack creation workflow', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <StackBuilderClient />
        </TestWrapper>
      );

      // Step 1: Add services to stack
      await waitFor(() => {
        expect(screen.getByText(/available services/i)).toBeInTheDocument();
      });

      // Find and add first service
      const serviceCards = screen.getAllByTestId(/service-card/i);
      if (serviceCards.length > 0) {
        const addButton = within(serviceCards[0]).getByRole('button', { name: /add/i });
        await user.click(addButton);

        // Verify service was added
        await waitFor(() => {
          expect(screen.getByText(/1 service/i)).toBeInTheDocument();
        });
      }

      // Step 2: Configure stack metadata
      const nameInput = screen.getByLabelText(/stack name/i);
      await user.clear(nameInput);
      await user.type(nameInput, 'My Test Stack');

      const descriptionInput = screen.getByLabelText(/description/i);
      await user.clear(descriptionInput);
      await user.type(descriptionInput, 'A comprehensive test stack');

      // Step 3: Export stack
      const exportButton = screen.getByRole('button', { name: /export/i });
      await user.click(exportButton);

      // Should open export modal
      await waitFor(() => {
        expect(screen.getByText(/export stack/i)).toBeInTheDocument();
      });

      // Select Docker Compose format and export
      const dockerComposeOption = screen.getByLabelText(/docker compose/i);
      await user.click(dockerComposeOption);

      const confirmExportButton = screen.getByRole('button', { name: /download/i });
      await user.click(confirmExportButton);

      // Step 4: Share stack
      const shareButton = screen.getByRole('button', { name: /share/i });
      await user.click(shareButton);

      await waitFor(() => {
        expect(screen.getByText(/share stack/i)).toBeInTheDocument();
      });

      // Generate share link
      const generateLinkButton = screen.getByRole('button', { name: /generate link/i });
      await user.click(generateLinkButton);
    });

    it('should handle import and configuration workflow', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <StackBuilderClient />
        </TestWrapper>
      );

      // Step 1: Import stack from file
      const importButton = screen.getByRole('button', { name: /import/i });
      await user.click(importButton);

      await waitFor(() => {
        expect(screen.getByText(/import stack/i)).toBeInTheDocument();
      });

      // Simulate file selection
      const fileInput = screen.getByLabelText(/choose file/i);
      const file = new File([JSON.stringify({
        name: 'Imported Stack',
        services: [{
          id: 'nginx',
          name: 'Nginx',
          category: 'Web Servers',
        }],
      })], 'stack.json', { type: 'application/json' });

      await user.upload(fileInput, file);

      // Step 2: Configure imported service
      await waitFor(() => {
        expect(screen.getByText('Imported Stack')).toBeInTheDocument();
      });

      // Open service configuration
      const configureButton = screen.getByRole('button', { name: /configure/i });
      await user.click(configureButton);

      await waitFor(() => {
        expect(screen.getByText(/service configuration/i)).toBeInTheDocument();
      });

      // Modify port configuration
      const portInput = screen.getByLabelText(/host port/i);
      await user.clear(portInput);
      await user.type(portInput, '8080');

      // Save configuration
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Step 3: Validate stack
      const validateButton = screen.getByRole('button', { name: /validate/i });
      await user.click(validateButton);

      await waitFor(() => {
        expect(screen.getByText(/validation complete/i)).toBeInTheDocument();
      });
    });

    it('should handle bulk operations workflow', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <StackBuilderClient />
        </TestWrapper>
      );

      // Step 1: Open bulk import
      const bulkImportButton = screen.getByRole('button', { name: /bulk import/i });
      await user.click(bulkImportButton);

      await waitFor(() => {
        expect(screen.getByText(/bulk import stacks/i)).toBeInTheDocument();
      });

      // Switch to folder import tab
      const folderTab = screen.getByRole('tab', { name: /folder/i });
      await user.click(folderTab);

      // Configure folder import settings
      const includeSubfoldersCheckbox = screen.getByLabelText(/include subfolders/i);
      await user.click(includeSubfoldersCheckbox);

      // Step 2: Process bulk import
      const processButton = screen.getByRole('button', { name: /process/i });
      await user.click(processButton);

      // Should show progress
      await waitFor(() => {
        expect(screen.getByText(/processing/i)).toBeInTheDocument();
      });

      // Step 3: Open bulk export
      const bulkExportButton = screen.getByRole('button', { name: /bulk export/i });
      await user.click(bulkExportButton);

      await waitFor(() => {
        expect(screen.getByText(/bulk export stacks/i)).toBeInTheDocument();
      });

      // Select export format
      const zipFormatOption = screen.getByLabelText(/zip archive/i);
      await user.click(zipFormatOption);

      // Configure export options
      const includeMetadataCheckbox = screen.getByLabelText(/include metadata/i);
      await user.click(includeMetadataCheckbox);

      // Export all stacks
      const exportAllButton = screen.getByRole('button', { name: /export all/i });
      await user.click(exportAllButton);
    });
  });

  describe('Service Browser Integration Workflow', () => {
    it('should complete service discovery and stack building', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <ServiceBrowserClient />
        </TestWrapper>
      );

      // Step 1: Search for services
      const searchInput = screen.getByPlaceholderText(/search services/i);
      await user.type(searchInput, 'web server');

      await waitFor(() => {
        expect(screen.getByDisplayValue('web server')).toBeInTheDocument();
      });

      // Step 2: Apply filters
      const categoryFilter = screen.getByLabelText(/category/i);
      await user.selectOptions(categoryFilter, 'Web Servers');

      // Step 3: Enable stack mode
      const stackModeToggle = screen.getByLabelText(/stack mode/i);
      await user.click(stackModeToggle);

      // Stack canvas should appear
      await waitFor(() => {
        expect(screen.getByText(/drop services here/i)).toBeInTheDocument();
      });

      // Step 4: Add services via drag and drop (simulated)
      const serviceCards = screen.getAllByTestId(/service-card/i);
      if (serviceCards.length > 0) {
        // Simulate adding service to stack
        const addButton = within(serviceCards[0]).getByRole('button', { name: /add/i });
        await user.click(addButton);

        await waitFor(() => {
          expect(screen.getByText(/1 service/i)).toBeInTheDocument();
        });
      }

      // Step 5: Navigate to full stack builder
      const buildStackButton = screen.getByRole('button', { name: /build stack/i });
      await user.click(buildStackButton);

      expect(mockPush).toHaveBeenCalledWith('/stack-builder');
    });

    it('should maintain state across interface transitions', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <ServiceBrowserClient />
        </TestWrapper>
      );

      // Configure search and filters
      const searchInput = screen.getByPlaceholderText(/search services/i);
      await user.type(searchInput, 'database');

      const tagsFilter = screen.getByLabelText(/tags/i);
      await user.selectOptions(tagsFilter, 'sql');

      // Enable stack mode
      const stackModeToggle = screen.getByLabelText(/stack mode/i);
      await user.click(stackModeToggle);

      // Add services to stack
      const serviceCards = screen.getAllByTestId(/service-card/i);
      if (serviceCards.length > 0) {
        const addButton = within(serviceCards[0]).getByRole('button', { name: /add/i });
        await user.click(addButton);
      }

      // Switch back to browse mode
      await user.click(stackModeToggle);

      // Verify state is maintained
      expect(searchInput).toHaveValue('database');
      expect(screen.getByText(/1 service/i)).toBeInTheDocument();
    });
  });

  describe('Community Integration Workflow', () => {
    it('should complete community discovery and import workflow', async () => {
      const user = userEvent.setup();
      
      const mockCommunityStacks = [{
        id: 'community-1',
        name: 'MEAN Stack',
        description: 'MongoDB, Express, Angular, Node.js',
        category: 'Web Development',
        difficulty: 'intermediate' as const,
        tags: ['mongodb', 'express', 'angular', 'nodejs'],
        services: [],
        author: { id: '1', name: 'Community User' },
        stats: { views: 1000, likes: 80, downloads: 200, rating: 4.2, reviewCount: 25 },
        createdAt: new Date(),
        updatedAt: new Date(),
        featured: false,
      }];

      render(
        <TestWrapper>
          <CommunityMarketplace 
            initialFeatured={mockCommunityStacks}
            initialPopular={mockCommunityStacks}
            categories={['Web Development', 'Databases', 'DevOps']}
            marketplaceStats={{
              totalStacks: 150,
              totalDownloads: 10000,
              activeContributors: 500,
              featuredStacks: 15,
            }}
          />
        </TestWrapper>
      );

      // Step 1: Search community stacks
      const searchInput = screen.getByPlaceholderText(/search community stacks/i);
      await user.type(searchInput, 'MEAN');

      // Step 2: Apply filters
      const filtersButton = screen.getByRole('button', { name: /filters/i });
      await user.click(filtersButton);

      await waitFor(() => {
        expect(screen.getByLabelText(/category/i)).toBeInTheDocument();
      });

      const categorySelect = screen.getByLabelText(/category/i);
      await user.selectOptions(categorySelect, 'Web Development');

      const difficultySelect = screen.getByLabelText(/difficulty/i);
      await user.selectOptions(difficultySelect, 'intermediate');

      // Apply filters
      const applyFiltersButton = screen.getByRole('button', { name: /apply/i });
      await user.click(applyFiltersButton);

      // Step 3: Preview stack details
      const stackCard = screen.getByText('MEAN Stack').closest('[data-testid="stack-card"]');
      if (stackCard) {
        const previewButton = within(stackCard).getByRole('button', { name: /preview/i });
        await user.click(previewButton);

        await waitFor(() => {
          expect(screen.getByText(/stack preview/i)).toBeInTheDocument();
        });
      }

      // Step 4: Import stack
      const importButton = screen.getByRole('button', { name: /import stack/i });
      await user.click(importButton);

      // Should show import confirmation
      await waitFor(() => {
        expect(screen.getByText(/import confirmation/i)).toBeInTheDocument();
      });

      const confirmImportButton = screen.getByRole('button', { name: /confirm import/i });
      await user.click(confirmImportButton);

      // Should navigate to stack builder
      expect(mockPush).toHaveBeenCalledWith('/stack-builder');
    });

    it('should handle stack sharing to community', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <StackBuilderClient />
        </TestWrapper>
      );

      // Create a stack first
      const nameInput = screen.getByLabelText(/stack name/i);
      await user.type(nameInput, 'My Community Stack');

      // Open share modal
      const shareButton = screen.getByRole('button', { name: /share/i });
      await user.click(shareButton);

      await waitFor(() => {
        expect(screen.getByText(/share stack/i)).toBeInTheDocument();
      });

      // Switch to community sharing tab
      const communityTab = screen.getByRole('tab', { name: /community/i });
      await user.click(communityTab);

      // Fill out community submission form
      const titleInput = screen.getByLabelText(/title/i);
      await user.type(titleInput, 'Awesome Web Stack');

      const descriptionTextarea = screen.getByLabelText(/description/i);
      await user.type(descriptionTextarea, 'A great stack for web development');

      const categorySelect = screen.getByLabelText(/category/i);
      await user.selectOptions(categorySelect, 'Web Development');

      const difficultySelect = screen.getByLabelText(/difficulty/i);
      await user.selectOptions(difficultySelect, 'beginner');

      // Add tags
      const tagInput = screen.getByLabelText(/tags/i);
      await user.type(tagInput, 'web,frontend,backend');

      // Submit to community
      const submitButton = screen.getByRole('button', { name: /submit to community/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/submitted successfully/i)).toBeInTheDocument();
      });
    });
  });

  describe('Dashboard Management Workflow', () => {
    it('should complete stack management workflow', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <DashboardClient />
        </TestWrapper>
      );

      // Step 1: View stack overview
      await waitFor(() => {
        expect(screen.getByText(/stack management dashboard/i)).toBeInTheDocument();
      });

      // Step 2: Create new stack
      const newStackButton = screen.getByRole('button', { name: /new stack/i });
      await user.click(newStackButton);
      expect(mockPush).toHaveBeenCalledWith('/stack-builder');

      // Step 3: Access community marketplace
      const communityButton = screen.getByRole('button', { name: /community/i });
      await user.click(communityButton);
      expect(mockPush).toHaveBeenCalledWith('/community');

      // Step 4: Manage existing stacks (if any)
      const stackCards = screen.queryAllByTestId(/stack-card/i);
      if (stackCards.length > 0) {
        const firstStack = stackCards[0];
        
        // Edit stack
        const editButton = within(firstStack).getByRole('button', { name: /edit/i });
        await user.click(editButton);

        // Delete stack
        const deleteButton = within(firstStack).getByRole('button', { name: /delete/i });
        await user.click(deleteButton);

        // Confirm deletion
        await waitFor(() => {
          expect(screen.getByText(/confirm deletion/i)).toBeInTheDocument();
        });

        const confirmDeleteButton = screen.getByRole('button', { name: /confirm/i });
        await user.click(confirmDeleteButton);
      }
    });

    it('should handle stack deployment workflow', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <DashboardClient />
        </TestWrapper>
      );

      const stackCards = screen.queryAllByTestId(/stack-card/i);
      if (stackCards.length > 0) {
        const firstStack = stackCards[0];

        // Deploy stack
        const deployButton = within(firstStack).getByRole('button', { name: /deploy/i });
        await user.click(deployButton);

        await waitFor(() => {
          expect(screen.getByText(/deployment options/i)).toBeInTheDocument();
        });

        // Select deployment target
        const localDeployment = screen.getByLabelText(/local docker/i);
        await user.click(localDeployment);

        // Configure deployment settings
        const deploymentName = screen.getByLabelText(/deployment name/i);
        await user.type(deploymentName, 'production-stack');

        // Start deployment
        const startDeployButton = screen.getByRole('button', { name: /start deployment/i });
        await user.click(startDeployButton);

        // Monitor deployment progress
        await waitFor(() => {
          expect(screen.getByText(/deployment in progress/i)).toBeInTheDocument();
        });
      }
    });
  });

  describe('Error Handling and Recovery Workflows', () => {
    it('should handle import errors gracefully', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <StackBuilderClient />
        </TestWrapper>
      );

      // Try to import invalid file
      const importButton = screen.getByRole('button', { name: /import/i });
      await user.click(importButton);

      const fileInput = screen.getByLabelText(/choose file/i);
      const invalidFile = new File(['invalid json content'], 'invalid.json', { type: 'application/json' });

      await user.upload(fileInput, invalidFile);

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/invalid file format/i)).toBeInTheDocument();
      });

      // Should allow retry
      const retryButton = screen.getByRole('button', { name: /try again/i });
      expect(retryButton).toBeInTheDocument();
    });

    it('should handle network errors during sharing', async () => {
      const user = userEvent.setup();
      
      // Mock network error
      jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'));

      render(
        <TestWrapper>
          <StackBuilderClient />
        </TestWrapper>
      );

      const shareButton = screen.getByRole('button', { name: /share/i });
      await user.click(shareButton);

      const generateLinkButton = screen.getByRole('button', { name: /generate link/i });
      await user.click(generateLinkButton);

      // Should show error and retry option
      await waitFor(() => {
        expect(screen.getByText(/sharing failed/i)).toBeInTheDocument();
      });

      const retryShareButton = screen.getByRole('button', { name: /retry/i });
      expect(retryShareButton).toBeInTheDocument();
    });

    it('should validate stack configuration and show warnings', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <StackBuilderClient />
        </TestWrapper>
      );

      // Create stack with potential issues
      const nameInput = screen.getByLabelText(/stack name/i);
      await user.type(nameInput, ''); // Empty name should trigger validation

      const validateButton = screen.getByRole('button', { name: /validate/i });
      await user.click(validateButton);

      // Should show validation warnings
      await waitFor(() => {
        expect(screen.getByText(/validation warnings/i)).toBeInTheDocument();
        expect(screen.getByText(/stack name is required/i)).toBeInTheDocument();
      });

      // Should provide fix suggestions
      expect(screen.getByText(/fix issues/i)).toBeInTheDocument();
    });
  });

  describe('Performance and Optimization Workflows', () => {
    it('should handle large stack operations efficiently', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <StackBuilderClient />
        </TestWrapper>
      );

      // Simulate adding many services
      const bulkAddButton = screen.getByRole('button', { name: /bulk add/i });
      await user.click(bulkAddButton);

      // Select multiple services
      const serviceCheckboxes = screen.getAllByRole('checkbox');
      for (let i = 0; i < Math.min(10, serviceCheckboxes.length); i++) {
        await user.click(serviceCheckboxes[i]);
      }

      const addSelectedButton = screen.getByRole('button', { name: /add selected/i });
      await user.click(addSelectedButton);

      // Should handle large stack efficiently
      await waitFor(() => {
        expect(screen.getByText(/10 services/i)).toBeInTheDocument();
      }, { timeout: 5000 });

      // Export large stack
      const exportButton = screen.getByRole('button', { name: /export/i });
      await user.click(exportButton);

      // Should show progress for large operations
      await waitFor(() => {
        expect(screen.getByText(/preparing export/i)).toBeInTheDocument();
      });
    });

    it('should provide search optimization for large service catalogs', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <ServiceBrowserClient />
        </TestWrapper>
      );

      // Test incremental search
      const searchInput = screen.getByPlaceholderText(/search services/i);
      await user.type(searchInput, 'd'); // Should show results immediately
      
      await waitFor(() => {
        expect(screen.getByText(/searching/i) || screen.getAllByTestId(/service-card/i).length).toBeTruthy();
      });

      // Continue typing
      await user.type(searchInput, 'atabase');

      // Should update results efficiently
      await waitFor(() => {
        const serviceCards = screen.getAllByTestId(/service-card/i);
        expect(serviceCards.length).toBeGreaterThan(0);
      });

      // Test filter combinations
      const categoryFilter = screen.getByLabelText(/category/i);
      await user.selectOptions(categoryFilter, 'Databases');

      const tagsFilter = screen.getByLabelText(/tags/i);
      await user.selectOptions(tagsFilter, 'sql');

      // Should maintain performance with multiple filters
      await waitFor(() => {
        expect(screen.getAllByTestId(/service-card/i).length).toBeGreaterThan(0);
      });
    });
  });
});

export {};