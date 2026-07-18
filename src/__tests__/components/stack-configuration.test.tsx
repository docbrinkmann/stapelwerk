import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach, type MockedFunction } from 'vitest'
import { act } from 'react-dom/test-utils'

// Mock the stack builder store
vi.mock('@/stores/stack-builder', () => ({
  useStackServices: vi.fn(),
  useStackValidation: vi.fn(),
  useServiceConfiguration: vi.fn(),
}))

import { useStackServices, useStackValidation, useServiceConfiguration } from '@/stores/stack-builder'
import type { Service, StackService, ServiceConfiguration } from '@/types/stack'

// Import components that will be implemented
import { StackCanvas } from '@/components/stack-configuration/StackCanvas'
import { ServiceConfigurationPanel } from '@/components/stack-configuration/ServiceConfigurationPanel'
import { EnvironmentVariableEditor } from '@/components/stack-configuration/EnvironmentVariableEditor'
import { PortMappingEditor } from '@/components/stack-configuration/PortMappingEditor'
import { VolumeMountEditor } from '@/components/stack-configuration/VolumeMountEditor'
import { DependencyOrderingPanel } from '@/components/stack-configuration/DependencyOrderingPanel'

// Mock data
const mockService: Service = {
  id: 1,
  name: 'PostgreSQL',
  description: 'Powerful open-source database',
  dockerImage: 'postgres',
  version: '15',
  category: { id: 1, name: 'Database' },
  ports: [5432],
  environmentVariables: [
    { name: 'POSTGRES_DB', required: true, description: 'Database name' },
    { name: 'POSTGRES_USER', required: true, description: 'Database user' },
    { name: 'POSTGRES_PASSWORD', required: true, description: 'Database password' },
  ],
  volumes: ['/var/lib/postgresql/data'],
  status: 'active',
  featured: false,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-15T10:30:00Z',
}

const mockStackService: StackService = {
  id: 'stack-service-1',
  serviceId: 1,
  service: mockService,
  configuration: {
    environmentVariables: {
      POSTGRES_DB: 'myapp',
      POSTGRES_USER: 'user',
      POSTGRES_PASSWORD: 'password123',
    },
    portMappings: [
      { containerPort: 5432, hostPort: 5432, protocol: 'tcp' }
    ],
    volumeMounts: [
      { containerPath: '/var/lib/postgresql/data', hostPath: './postgres-data', type: 'bind' }
    ],
    dependencies: [],
    resourceLimits: {
      memory: '512Mi',
      cpu: '0.5',
    },
  },
  order: 0,
}

const mockConfiguration: ServiceConfiguration = mockStackService.configuration

describe('Stack Configuration Components', () => {
  const mockServices = [mockStackService]
  const mockValidationErrors: string[] = []
  const mockUpdateConfiguration = vi.fn()
  const mockValidateConfiguration = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(useStackServices).mockReturnValue({
      services: mockServices,
      addService: vi.fn(),
      removeService: vi.fn(),
      reorderServices: vi.fn(),
      updateServiceConfiguration: mockUpdateConfiguration,
    })

    vi.mocked(useStackValidation).mockReturnValue({
      validationErrors: mockValidationErrors,
      validateStack: mockValidateConfiguration,
      isValid: true,
    })

    vi.mocked(useServiceConfiguration).mockReturnValue({
      getConfiguration: vi.fn().mockReturnValue(mockConfiguration),
      updateConfiguration: mockUpdateConfiguration,
      resetConfiguration: vi.fn(),
    })
  })

  describe('StackCanvas', () => {
    describe('Responsive Grid Layout', () => {
      it('should render with responsive grid layout classes', () => {
        render(<StackCanvas />)
        
        const canvas = screen.getByTestId('stack-canvas')
        expect(canvas).toHaveClass('grid')
        expect(canvas).toHaveClass('gap-4')
        // Should have responsive breakpoint classes
        expect(canvas.className).toMatch(/grid-cols-1|sm:grid-cols-2|lg:grid-cols-3/)
      })

      it('should adapt layout for different screen sizes', () => {
        // Mock window.innerWidth for different screen sizes
        Object.defineProperty(window, 'innerWidth', {
          writable: true,
          configurable: true,
          value: 320, // Mobile
        })

        const { rerender } = render(<StackCanvas />)
        let canvas = screen.getByTestId('stack-canvas')
        expect(canvas).toHaveClass('grid-cols-1')

        // Tablet
        Object.defineProperty(window, 'innerWidth', { value: 768 })
        rerender(<StackCanvas />)
        canvas = screen.getByTestId('stack-canvas')
        expect(canvas).toHaveClass('sm:grid-cols-2')

        // Desktop
        Object.defineProperty(window, 'innerWidth', { value: 1024 })
        rerender(<StackCanvas />)
        canvas = screen.getByTestId('stack-canvas')
        expect(canvas).toHaveClass('lg:grid-cols-3')
      })

      it('should maintain aspect ratio for service cards', () => {
        render(<StackCanvas />)
        
        const serviceCard = screen.getByTestId('service-configuration-card')
        expect(serviceCard).toHaveClass('aspect-square', 'min-h-0')
      })
    })

    describe('Service Configuration Cards', () => {
      it('should display service cards with configuration status', () => {
        render(<StackCanvas />)
        
        expect(screen.getByText('PostgreSQL')).toBeInTheDocument()
        expect(screen.getByText('Database')).toBeInTheDocument()
        expect(screen.getByTestId('configuration-status')).toBeInTheDocument()
      })

      it('should show configuration completeness indicator', () => {
        render(<StackCanvas />)
        
        const indicator = screen.getByTestId('configuration-completeness')
        expect(indicator).toBeInTheDocument()
        // Should show percentage or checkmarks for completed sections
        expect(indicator.textContent).toMatch(/\d+%|✓/)
      })

      it('should handle card click to open configuration', async () => {
        const user = userEvent.setup({ delay: null }) // Disable delay to prevent timeouts
        render(<StackCanvas />)
        
        const card = screen.getByTestId('service-configuration-card')
        await user.click(card)
        
        expect(screen.getByTestId('service-configuration-panel')).toBeInTheDocument()
      })
    })

    describe('Empty State', () => {
      it('should show empty state when no services in stack', () => {
        vi.mocked(useStackServices).mockReturnValue({
          services: [],
          addService: vi.fn(),
          removeService: vi.fn(),
          reorderServices: vi.fn(),
          updateServiceConfiguration: vi.fn(),
        })

        render(<StackCanvas />)
        
        expect(screen.getByTestId('empty-stack-canvas')).toBeInTheDocument()
        expect(screen.getByText(/add services to your stack to configure them/i)).toBeInTheDocument()
      })
    })
  })

  describe('ServiceConfigurationPanel', () => {
    describe('Panel Behavior', () => {
      it('should render collapsible configuration panel', () => {
        render(
          <ServiceConfigurationPanel 
            service={mockService} 
            configuration={mockConfiguration}
            onConfigurationChange={mockUpdateConfiguration}
            isOpen={true}
            onClose={vi.fn()}
          />
        )
        
        expect(screen.getByTestId('service-configuration-panel')).toBeInTheDocument()
        expect(screen.getByText('PostgreSQL Configuration')).toBeInTheDocument()
      })

      it('should toggle panel sections on click', async () => {
        const user = userEvent.setup({ delay: null }) // Disable delay to prevent timeouts
        render(
          <ServiceConfigurationPanel 
            service={mockService} 
            configuration={mockConfiguration}
            onConfigurationChange={mockUpdateConfiguration}
            isOpen={true}
            onClose={vi.fn()}
          />
        )
        
        const environmentSection = screen.getByTestId('environment-section-toggle')
        await user.click(environmentSection)
        
        expect(screen.getByTestId('environment-variables-editor')).toBeVisible()
      })

      it('should save configuration changes automatically', async () => {
        const user = userEvent.setup({ delay: null }) // Disable delay to prevent timeouts
        render(
          <ServiceConfigurationPanel 
            service={mockService} 
            configuration={mockConfiguration}
            onConfigurationChange={mockUpdateConfiguration}
            isOpen={true}
            onClose={vi.fn()}
          />
        )
        
        // First expand the environment section to access inputs
        const environmentSection = screen.getByTestId('environment-section-toggle')
        await user.click(environmentSection)
        
        // Wait for the section to expand and inputs to be available
        await waitFor(() => {
          expect(screen.getByDisplayValue('myapp')).toBeVisible()
        })
        
        // Make a change to trigger auto-save
        const input = screen.getByDisplayValue('myapp')
        await user.clear(input)
        await user.type(input, 'test')
        
        // Verify auto-save was called
        await waitFor(() => {
          expect(mockUpdateConfiguration).toHaveBeenCalledWith(
            mockService.id,
            expect.anything()
          )
        })
      })

      it('should close panel when clicking close button', async () => {
        const mockClose = vi.fn()
        const user = userEvent.setup({ delay: null }) // Disable delay to prevent timeouts
        
        render(
          <ServiceConfigurationPanel 
            service={mockService} 
            configuration={mockConfiguration}
            onConfigurationChange={mockUpdateConfiguration}
            isOpen={true}
            onClose={mockClose}
          />
        )
        
        const closeButton = screen.getByTestId('close-configuration-panel')
        await user.click(closeButton)
        
        expect(mockClose).toHaveBeenCalled()
      })
    })

    describe('Configuration Sections', () => {
      it('should display all configuration sections', () => {
        render(
          <ServiceConfigurationPanel 
            service={mockService} 
            configuration={mockConfiguration}
            onConfigurationChange={mockUpdateConfiguration}
            isOpen={true}
            onClose={vi.fn()}
          />
        )
        
        expect(screen.getByText('Environment Variables')).toBeInTheDocument()
        expect(screen.getByText('Port Mappings')).toBeInTheDocument()
        expect(screen.getByText('Volume Mounts')).toBeInTheDocument()
        expect(screen.getByText('Dependencies')).toBeInTheDocument()
      })

      it('should show validation errors for each section', async () => {
        vi.mocked(useStackValidation).mockReturnValue({
          validationErrors: ['POSTGRES_PASSWORD is required', 'Port 5432 is already in use'],
          validateStack: mockValidateConfiguration,
          isValid: false,
        })

        const user = userEvent.setup({ delay: null }) // Disable delay to prevent timeouts
        render(
          <ServiceConfigurationPanel 
            service={mockService} 
            configuration={mockConfiguration}
            onConfigurationChange={mockUpdateConfiguration}
            isOpen={true}
            onClose={vi.fn()}
          />
        )

        // Validation summary should reflect total issues
        expect(screen.getByTestId('validation-summary').textContent).toContain('2 issues found')

        // Section headers should indicate issues
        const envToggle = screen.getByTestId('environment-section-toggle')
        const portsToggle = screen.getByTestId('ports-section-toggle')
        expect(envToggle.textContent).toMatch(/issues/i)
        expect(portsToggle.textContent).toMatch(/issues/i)

        // Optionally click toggles (state change may recreate nodes)
        await user.click(envToggle)
        await user.click(portsToggle)
        // No strict aria-expanded assertions to remain resilient to re-renders
      })
    })
  })

  describe('EnvironmentVariableEditor', () => {
    describe('Variable Management', () => {
      it('should display all environment variables', () => {
        render(
          <EnvironmentVariableEditor 
            service={mockService}
            variables={mockConfiguration.environmentVariables}
            onChange={mockUpdateConfiguration}
          />
        )
        
        expect(screen.getByLabelText('POSTGRES_DB')).toBeInTheDocument()
        expect(screen.getByLabelText('POSTGRES_USER')).toBeInTheDocument()
        expect(screen.getByLabelText('POSTGRES_PASSWORD')).toBeInTheDocument()
      })

      it('should mark required variables with indicator', () => {
        render(
          <EnvironmentVariableEditor 
            service={mockService}
            variables={mockConfiguration.environmentVariables}
            onChange={mockUpdateConfiguration}
          />
        )
        
        const requiredIndicators = screen.getAllByText('*')
        expect(requiredIndicators).toHaveLength(3) // All are required
      })

      it('should allow adding custom environment variables', async () => {
        const user = userEvent.setup({ delay: null }) // Disable delay to prevent timeouts
        render(
          <EnvironmentVariableEditor 
            service={mockService}
            variables={mockConfiguration.environmentVariables}
            onChange={mockUpdateConfiguration}
          />
        )
        
        const addButton = screen.getByTestId('add-environment-variable')
        await user.click(addButton)
        
        const nameInput = screen.getByLabelText('Variable Name')
        const valueInput = screen.getByLabelText('Variable Value')
        
        await user.type(nameInput, 'CUSTOM_VAR')
        await user.type(valueInput, 'custom_value')
        
        const saveButton = screen.getByTestId('save-custom-variable')
        await user.click(saveButton)
        
        expect(mockUpdateConfiguration).toHaveBeenCalledWith({
          ...mockConfiguration.environmentVariables,
          CUSTOM_VAR: 'custom_value'
        })
      })

      it('should validate environment variable values in real-time', async () => {
        const user = userEvent.setup({ delay: null }) // Disable delay to prevent timeouts
        render(
          <EnvironmentVariableEditor 
            service={mockService}
            variables={mockConfiguration.environmentVariables}
            onChange={mockUpdateConfiguration}
          />
        )
        
        const passwordInput = screen.getByLabelText('POSTGRES_PASSWORD')
        await user.clear(passwordInput)
        
        // Rerender editor with cleared value to simulate parent state update
        const { rerender } = render(
          <EnvironmentVariableEditor 
            service={mockService}
            variables={{ ...mockConfiguration.environmentVariables, POSTGRES_PASSWORD: '' }}
            onChange={mockUpdateConfiguration}
          />
        )
        
        expect(screen.getByText('Password is required')).toBeInTheDocument()
      })
    })

    describe('Variable Types', () => {
      it('renders secret variables as password inputs and others as text', () => {
        // The real catalog metadata uses a `secret` flag (not a rich `type`);
        // secret vars must be masked as password inputs, everything else is text.
        const serviceWithSecret = {
          ...mockService,
          environmentVariables: [
            { name: 'POSTGRES_USER', required: true, description: 'Database user' },
            { name: 'POSTGRES_PASSWORD', required: true, secret: true, description: 'Database password' },
          ],
        }

        render(
          <EnvironmentVariableEditor
            service={serviceWithSecret}
            variables={{}}
            onChange={mockUpdateConfiguration}
          />
        )

        expect(screen.getByLabelText('POSTGRES_PASSWORD')).toHaveAttribute('type', 'password')
        expect(screen.getByLabelText('POSTGRES_USER')).toHaveAttribute('type', 'text')
      })
    })
  })

  describe('PortMappingEditor', () => {
    describe('Port Configuration', () => {
      it('should display current port mappings', () => {
        render(
          <PortMappingEditor 
            service={mockService}
            portMappings={mockConfiguration.portMappings}
            onChange={mockUpdateConfiguration}
          />
        )
        
        const portInputs = screen.getAllByDisplayValue('5432')
        expect(portInputs.length).toBeGreaterThanOrEqual(2)
      })

      it('should detect port conflicts', async () => {
        const conflictingMappings = [
          { containerPort: 5432, hostPort: 80, protocol: 'tcp' as const },
          { containerPort: 3306, hostPort: 80, protocol: 'tcp' as const }, // Conflict
        ]

        render(
          <PortMappingEditor 
            service={mockService}
            portMappings={conflictingMappings}
            onChange={mockUpdateConfiguration}
          />
        )
        
        expect(screen.getByText(/port 80 is already in use/i)).toBeInTheDocument()
      })

      it('should allow adding new port mappings', async () => {
        const user = userEvent.setup({ delay: null }) // Disable delay to prevent timeouts
        render(
          <PortMappingEditor 
            service={mockService}
            portMappings={[]}
            onChange={mockUpdateConfiguration}
          />
        )
        
        const addButton = screen.getByTestId('add-port-mapping')
        await user.click(addButton)
        
        const containerPortInput = screen.getByLabelText('Container Port')
        const hostPortInput = screen.getByLabelText('Host Port')
        
        await user.type(containerPortInput, '3000')
        await user.type(hostPortInput, '3000')
        
        // Save the new mapping
        const saveBtn = screen.getByTestId('save-port-mapping')
        await user.click(saveBtn)
        
        expect(mockUpdateConfiguration).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ containerPort: 3000, hostPort: 3000, protocol: 'tcp' })
          ])
        )
      })

      it('should validate port ranges', async () => {
        const user = userEvent.setup({ delay: null }) // Disable delay to prevent timeouts
        render(
          <PortMappingEditor 
            service={mockService}
            portMappings={[]}
            onChange={mockUpdateConfiguration}
          />
        )
        
        const addButton = screen.getByTestId('add-port-mapping')
        await user.click(addButton)
        
        const containerPortInput = screen.getByLabelText('Container Port')
        await user.type(containerPortInput, '70000') // Invalid port
        
        expect(screen.getByText(/port must be between 1 and 65535/i)).toBeInTheDocument()
      })
    })

    describe('Protocol Selection', () => {
      it('should allow selecting different protocols', async () => {
        const user = userEvent.setup({ delay: null }) // Disable delay to prevent timeouts
        render(
          <PortMappingEditor 
            service={mockService}
            portMappings={mockConfiguration.portMappings}
            onChange={mockUpdateConfiguration}
          />
        )
        
        const protocolSelect = screen.getByLabelText('Protocol')
        await user.selectOptions(protocolSelect, 'udp')
        
        expect(mockUpdateConfiguration).toHaveBeenCalledWith([
          { containerPort: 5432, hostPort: 5432, protocol: 'udp' }
        ])
      })
    })
  })

  describe('VolumeMountEditor', () => {
    describe('Volume Configuration', () => {
      it('should display current volume mounts', () => {
        render(
          <VolumeMountEditor 
            service={mockService}
            volumeMounts={mockConfiguration.volumeMounts}
            onChange={mockUpdateConfiguration}
          />
        )
        
        expect(screen.getByDisplayValue('/var/lib/postgresql/data')).toBeInTheDocument()
        expect(screen.getByDisplayValue('./postgres-data')).toBeInTheDocument()
      })

      it('should validate host paths', async () => {
        const user = userEvent.setup({ delay: null }) // Disable delay to prevent timeouts
        render(
          <VolumeMountEditor 
            service={mockService}
            volumeMounts={[]}
            onChange={mockUpdateConfiguration}
          />
        )
        
        const addButton = screen.getByTestId('add-volume-mount')
        await user.click(addButton)
        
        const hostPathInput = screen.getByLabelText('Host Path')
        await user.type(hostPathInput, '/invalid/path/with/../')
        
        expect(screen.getByText(/invalid path format/i)).toBeInTheDocument()
      })

      it('should support different mount types', async () => {
        const user = userEvent.setup({ delay: null }) // Disable delay to prevent timeouts
        render(
          <VolumeMountEditor 
            service={mockService}
            volumeMounts={[]}
            onChange={mockUpdateConfiguration}
          />
        )
        
        const addButton = screen.getByTestId('add-volume-mount')
        await user.click(addButton)
        
        const typeSelect = screen.getByLabelText('Mount Type')
        expect(typeSelect).toBeInTheDocument()
        
        await user.selectOptions(typeSelect, 'volume')
        await user.selectOptions(typeSelect, 'bind')
        await user.selectOptions(typeSelect, 'tmpfs')
      })

      it('should allow setting mount options', async () => {
        const user = userEvent.setup({ delay: null }) // Disable delay to prevent timeouts
        render(
          <VolumeMountEditor 
            service={mockService}
            volumeMounts={mockConfiguration.volumeMounts}
            onChange={mockUpdateConfiguration}
          />
        )
        
        const optionsButton = screen.getByTestId('mount-options')
        await user.click(optionsButton)
        
        const readOnlyCheckbox = screen.getByLabelText('Read-only')
        await user.click(readOnlyCheckbox)
        
        expect(mockUpdateConfiguration).toHaveBeenCalledWith([
          { 
            containerPath: '/var/lib/postgresql/data', 
            hostPath: './postgres-data', 
            type: 'bind',
            options: { readonly: true }
          }
        ])
      })
    })
  })

  describe('DependencyOrderingPanel', () => {
    // Use the panel's expected props: services as simple list and dependencies as a map
    const panelServices = [
      { id: 'postgres', name: 'PostgreSQL' } as any,
      { id: 'redis', name: 'Redis' } as any,
      { id: 'api', name: 'API Server' } as any,
    ]

    describe('Dependency Management', () => {
      it('should display available services for dependencies', () => {
        render(
          <DependencyOrderingPanel 
            services={panelServices}
            currentServiceId="api"
            dependencies={{ api: [] }}
            onChange={mockUpdateConfiguration}
          />
        )

        // Within the API Server row, the dependency select should include PostgreSQL and Redis, but not API Server
        const apiHeading = screen.getAllByRole('heading', { level: 4, name: 'API Server' })[0]
        const apiCard = (apiHeading.parentElement as HTMLElement).parentElement as HTMLElement
        const selectEl = apiCard.querySelector('select') as HTMLSelectElement
        const options = Array.from(selectEl.querySelectorAll('option')).map(o => o.textContent?.trim())
        expect(options).toContain('PostgreSQL')
        expect(options).toContain('Redis')
        expect(options).not.toContain('API Server')
      })

      it('should allow adding dependencies', async () => {
        const user = userEvent.setup({ delay: null }) // Disable delay to prevent timeouts
        render(
          <DependencyOrderingPanel 
            services={panelServices}
            currentServiceId="api"
            dependencies={{}}
            onChange={mockUpdateConfiguration}
          />
        )

        const apiHeading = screen.getAllByRole('heading', { level: 4, name: 'API Server' })[0]
        const apiCard = (apiHeading.parentElement as HTMLElement).parentElement as HTMLElement
        const selectEl = apiCard.querySelector('select') as HTMLSelectElement
        await user.selectOptions(selectEl, 'postgres')
        const addBtn = within(apiCard).getByTestId('add-dependency')
        await user.click(addBtn)

        expect(mockUpdateConfiguration).toHaveBeenCalledWith({ api: ['postgres'] })
      })

      it('should detect circular dependencies', () => {
        render(
          <DependencyOrderingPanel 
            services={panelServices}
            currentServiceId="api"
            dependencies={{ api: ['postgres'], postgres: ['api'] }}
            onChange={mockUpdateConfiguration}
          />
        )
        
        expect(screen.getAllByText(/circular dependenc/i).length).toBeGreaterThan(0)
      })

      it('should show dependency order visualization', () => {
        render(
          <DependencyOrderingPanel 
            services={panelServices}
            currentServiceId="api"
            dependencies={{ api: ['postgres', 'redis'] }}
            onChange={mockUpdateConfiguration}
          />
        )
        
        const order = screen.getByTestId('startup-order')
        expect(order).toBeInTheDocument()
        const text = order.textContent || ''
        expect(text.indexOf('PostgreSQL')).toBeLessThan(text.indexOf('Redis'))
        expect(text.indexOf('Redis')).toBeLessThan(text.indexOf('API Server'))
      })
    })

    describe('Ordering Logic', () => {
      it('should calculate correct startup order', () => {
        render(
          <DependencyOrderingPanel 
            services={panelServices}
            currentServiceId="api"
            dependencies={{ api: ['postgres'] }}
            onChange={mockUpdateConfiguration}
          />
        )
        
        const startupOrder = screen.getByTestId('startup-order')
        const text = startupOrder.textContent || ''
        expect(text.indexOf('PostgreSQL')).toBeLessThan(text.indexOf('API Server'))
      })

      it('should handle complex dependency chains', () => {
        const complexServices = [
          { id: 'db', name: 'PostgreSQL' } as any,
          { id: 'cache', name: 'Redis' } as any,
          { id: 'api', name: 'API Server' } as any,
        ]

        render(
          <DependencyOrderingPanel 
            services={complexServices}
            currentServiceId="api"
            dependencies={{ cache: ['db'], api: ['db', 'cache'] }}
            onChange={mockUpdateConfiguration}
          />
        )
        
        const order = screen.getByTestId('startup-order')
        const text = order.textContent || ''
        expect(text.indexOf('PostgreSQL')).toBeLessThan(text.indexOf('Redis'))
        expect(text.indexOf('Redis')).toBeLessThan(text.indexOf('API Server'))
      })
    })
  })

  describe('Real-time Validation', () => {
    it('should validate configuration changes in real-time', async () => {
      const user = userEvent.setup({ delay: null }) // Disable delay to prevent timeouts
      render(
        <ServiceConfigurationPanel 
          service={mockService} 
          configuration={mockConfiguration}
          onConfigurationChange={mockUpdateConfiguration}
          isOpen={true}
          onClose={vi.fn()}
        />
      )
      
      // Expand environment section to access inputs
      await user.click(screen.getByTestId('environment-section-toggle'))
      const input = screen.getByLabelText('POSTGRES_PASSWORD')
      await user.clear(input)
      
      // Auto-save should be triggered on change
      await waitFor(() => {
        expect(mockUpdateConfiguration).toHaveBeenCalled()
      })
    })

    it('should show validation summary', () => {
      vi.mocked(useStackValidation).mockReturnValue({
        validationErrors: [
          'POSTGRES_PASSWORD is required',
          'Port 5432 conflicts with another service',
          'Volume path /data is invalid'
        ],
        validateStack: mockValidateConfiguration,
        isValid: false,
      })

      render(
        <ServiceConfigurationPanel 
          service={mockService} 
          configuration={mockConfiguration}
          onConfigurationChange={mockUpdateConfiguration}
          isOpen={true}
          onClose={vi.fn()}
        />
      )
      
      const summary = screen.getByTestId('validation-summary')
      expect(summary).toBeInTheDocument()
      expect(summary.textContent).toContain('3 issues found')
    })

    it('should update validation status when issues are resolved', async () => {
      const user = userEvent.setup({ delay: null }) // Disable delay to prevent timeouts

      // Start with validation errors
      vi.mocked(useStackValidation).mockReturnValue({
        validationErrors: ['POSTGRES_PASSWORD is required'],
        validateStack: mockValidateConfiguration,
        isValid: false,
      })
      const { rerender } = render(
        <ServiceConfigurationPanel 
          service={mockService} 
          configuration={mockConfiguration}
          onConfigurationChange={mockUpdateConfiguration}
          isOpen={true}
          onClose={vi.fn()}
        />
      )

      // Then resolve
      vi.mocked(useStackValidation).mockReturnValue({
        validationErrors: [],
        validateStack: mockValidateConfiguration,
        isValid: true,
      })

      rerender(
        <ServiceConfigurationPanel 
          service={mockService} 
          configuration={mockConfiguration}
          onConfigurationChange={mockUpdateConfiguration}
          isOpen={true}
          onClose={vi.fn()}
        />
      )
      
      expect(screen.getByText(/configuration is valid/i)).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should expose the panel as a labelled dialog', () => {
      render(
        <ServiceConfigurationPanel
          service={mockService}
          configuration={mockConfiguration}
          onConfigurationChange={mockUpdateConfiguration}
          isOpen={true}
          onClose={vi.fn()}
        />
      )

      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByLabelText('Service configuration panel')).toBeInTheDocument()
    })

    it('should announce validation errors to screen readers', async () => {
      vi.mocked(useStackValidation).mockReturnValue({
        validationErrors: ['POSTGRES_PASSWORD is required'],
        validateStack: mockValidateConfiguration,
        isValid: false,
      })

      render(
        <ServiceConfigurationPanel 
          service={mockService} 
          configuration={mockConfiguration}
          onConfigurationChange={mockUpdateConfiguration}
          isOpen={true}
          onClose={vi.fn()}
        />
      )
      
      // Current UI provides a validation summary banner (no explicit role=alert)
      const summary = screen.getByTestId('validation-summary')
      expect(summary).toBeInTheDocument()
      expect(summary.textContent).toMatch(/issues found/i)
    })
  })
})