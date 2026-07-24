import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { ServiceConfigurationPanel } from '../ServiceConfigurationPanel'

const DEFAULT_CONFIG_SENTINEL = { environmentVariables: { RESET: 'yes' }, portMappings: [], volumeMounts: [], dependsOn: [] }
vi.mock('@/stores/stack-builder', () => ({
  useStackValidation: () => ({ validationErrors: [], isValid: true }),
  // Other services in the stack: one shares this catalog service (excluded),
  // one contributes host port 8080 to usedPorts.
  useStackServices: () => ({
    services: [
      { id: 'entry-1', service: { id: 1 }, configuration: { portMappings: [{ containerPort: 5432, hostPort: 5432 }] } },
      { id: 'entry-2', service: { id: 9 }, configuration: { portMappings: [{ containerPort: 80, hostPort: 8080 }] } },
    ],
  }),
  createDefaultConfiguration: () => DEFAULT_CONFIG_SENTINEL,
}))
// The section editors pull in heavy deps — the wizard chrome is what's under test.
vi.mock('../EnvironmentVariableEditor', () => ({ EnvironmentVariableEditor: () => <div /> }))
vi.mock('../PortMappingEditor', () => ({
  PortMappingEditor: ({ usedPorts }: any) => (
    <div data-testid="port-editor" data-used-ports={JSON.stringify(usedPorts)} />
  ),
}))
vi.mock('../VolumeMountEditor', () => ({ VolumeMountEditor: () => <div /> }))
vi.mock('../DependencyOrderingPanel', () => ({ DependencyOrderingPanel: () => <div /> }))

const service: any = { id: 1, name: 'PostgreSQL' }
const baseProps = {
  service,
  configuration: { environmentVariables: {}, portMappings: [], volumeMounts: [], dependsOn: [] } as any,
  onConfigurationChange: vi.fn(),
  isOpen: true,
  onClose: vi.fn(),
}

describe('ServiceConfigurationPanel — guided wizard mode', () => {
  it('shows progress and fires onNext/onPrev', () => {
    const onNext = vi.fn()
    const onPrev = vi.fn()
    render(
      <ServiceConfigurationPanel
        {...baseProps}
        wizard={{ position: 2, total: 3, onNext, onPrev }}
      />,
    )
    expect(screen.getByTestId('wizard-progress')).toHaveTextContent('Service 2 of 3')
    fireEvent.click(screen.getByTestId('wizard-next'))
    expect(onNext).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByTestId('wizard-prev'))
    expect(onPrev).toHaveBeenCalledTimes(1)
  })

  it('disables Back on the first service and shows Finish on the last', () => {
    const { rerender } = render(
      <ServiceConfigurationPanel
        {...baseProps}
        wizard={{ position: 1, total: 3, onNext: vi.fn(), onPrev: vi.fn() }}
      />,
    )
    expect(screen.getByTestId('wizard-prev')).toBeDisabled()
    expect(screen.getByTestId('wizard-next')).toHaveTextContent('Next')

    rerender(
      <ServiceConfigurationPanel
        {...baseProps}
        wizard={{ position: 3, total: 3, onNext: vi.fn(), onPrev: vi.fn() }}
      />,
    )
    expect(screen.getByTestId('wizard-next')).toHaveTextContent('Finish — run checks')
  })

  it('without wizard props keeps the plain Done/Reset footer (no regression)', () => {
    render(<ServiceConfigurationPanel {...baseProps} />)
    expect(screen.queryByTestId('wizard-next')).toBeNull()
    expect(screen.getByText('Done')).toBeInTheDocument()
    expect(screen.getByText('Reset')).toBeInTheDocument()
  })
})

describe('ServiceConfigurationPanel — real Reset and usedPorts', () => {
  it('Reset is two-step and restores the catalog defaults on confirm', () => {
    const onConfigurationChange = vi.fn()
    render(<ServiceConfigurationPanel {...baseProps} onConfigurationChange={onConfigurationChange} />)

    const reset = screen.getByTestId('panel-reset')
    fireEvent.click(reset) // arm
    expect(reset).toHaveTextContent('Really reset? Click again')
    expect(onConfigurationChange).not.toHaveBeenCalled()

    fireEvent.click(reset) // confirm
    expect(onConfigurationChange).toHaveBeenCalledWith(service.id, DEFAULT_CONFIG_SENTINEL)
    expect(reset).toHaveTextContent('Reset')
  })

  it('feeds the port editor the host ports of OTHER stack services (not the 5432 mock)', () => {
    render(<ServiceConfigurationPanel {...baseProps} />)
    fireEvent.click(screen.getByTestId('ports-section-toggle'))
    const used = JSON.parse(screen.getByTestId('port-editor').getAttribute('data-used-ports') ?? '[]')
    // entry-1 shares this catalog service (id 1) and is excluded; entry-2 contributes 8080.
    expect(used).toEqual([8080])
  })
})

describe('ServiceConfigurationPanel — Image section (jump target for image updates)', () => {
  const imgService: any = { id: 1, name: 'PostgreSQL', dockerImage: 'postgres:18-alpine', version: '18' }

  it('one-click apply of a suggested tag sets configuration.imageTag', () => {
    const onConfigurationChange = vi.fn()
    render(
      <ServiceConfigurationPanel
        {...baseProps}
        service={imgService}
        onConfigurationChange={onConfigurationChange}
        initialSection="image"
        suggestedImageTag="18.4-alpine"
      />,
    )
    fireEvent.click(screen.getByTestId('apply-image-update'))
    expect(onConfigurationChange).toHaveBeenCalledWith(1, expect.objectContaining({ imageTag: '18.4-alpine' }))
  })

  it('editing the tag writes an override; typing the catalog default clears it', () => {
    // Stateful harness so the controlled input reflects each change (a plain
    // spy leaves the value pinned, and fireEvent.change on an unchanged value
    // is a no-op in React).
    const calls: any[] = []
    function Harness() {
      const [cfg, setCfg] = useState<any>(baseProps.configuration)
      return (
        <ServiceConfigurationPanel
          {...baseProps}
          service={imgService}
          configuration={cfg}
          onConfigurationChange={(_id, c) => {
            calls.push(c)
            setCfg(c)
          }}
          initialSection="image"
        />
      )
    }
    render(<Harness />)
    const input = screen.getByTestId('image-tag-input')
    fireEvent.change(input, { target: { value: '17-alpine' } })
    expect(calls.at(-1)).toEqual(expect.objectContaining({ imageTag: '17-alpine' }))
    // Typing the catalog tag back removes the redundant override.
    fireEvent.change(input, { target: { value: '18-alpine' } })
    expect(calls.at(-1)).toEqual(expect.objectContaining({ imageTag: undefined }))
  })
})
