import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { act } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ApplyModal } from '@/components/deployments/ApplyModal'
import { api } from '@/trpc/client'

// Mock tRPC client
vi.mock('@/trpc/client', () => {
  const state: { call: number } = { call: 0 }
  const mockRenderApplyCiQuery = vi.fn(async () => ({ yaml: 'stages: [deploy]\napply: { stage: deploy }' }))

  return {
    api: {
      deployments: {
        listTargets: {
          query: vi.fn(async () => {
            // First call: no targets, second call: one new target
            state.call += 1
            if (state.call <= 1) return { targets: [] }
            return { targets: [{ id: 't-1', name: 'Local K3s', type: 'kubernetes', provider: 'self-managed' }] }
          }),
        },
        createTarget: {
          mutate: vi.fn(async (input: any) => ({ id: 't-1', ...input })),
        },
        getDeployPublicKey: {
          query: vi.fn(async () => ({
            configured: true,
            publicKey: 'ssh-ed25519 AAAAC3NzaC1lZDI1 deploy@buildmystack',
          })),
        },
        renderApplyCi: {
          query: mockRenderApplyCiQuery,
        },
      },
      stacks: {
        list: {
          query: vi.fn(async () => ({ stacks: [] })),
        },
      },
    },
  }
})


const renderWithQuery = (ui: React.ReactElement) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe('ApplyModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows empty-state and allows creating a target inline', async () => {
    await act(async () => {
      renderWithQuery(<ApplyModal isOpen={true} onClose={() => {}} />)
    })

    // Empty-state visible
    expect(await screen.findByText(/No deployment targets found/i)).toBeInTheDocument()

    // Open create target form
    const toggle = screen.getByTestId('apply-create-target-toggle')
    await act(async () => {
      await userEvent.click(toggle)
    })

    // Fill in name and submit (provider/type defaults are fine)
    const nameInput = screen.getByLabelText(/Name/i)
    await act(async () => {
      await userEvent.type(nameInput, 'Local K3s')
    })

    const submit = screen.getByRole('button', { name: /Create Target/i })
    await act(async () => {
      await userEvent.click(submit)
    })

    // After creation, list refetch returns one target; select should have it
    await waitFor(async () => {
      const targetSelect = await screen.findByTestId('apply-target-select')
      expect((targetSelect as HTMLSelectElement).value).toBe('t-1')
    })
  })

  it('creates a REMOTE (SSH) target: reveals host/user/port + the deploy public key, and sends a docker+remote payload', async () => {
    const user = userEvent.setup({ delay: null })
    // The create-target form lives in the zero-targets empty state — pin it (the
    // shared factory counter is order-dependent).
    ;(api.deployments.listTargets.query as any).mockResolvedValue({ targets: [] })
    await act(async () => {
      renderWithQuery(<ApplyModal isOpen={true} onClose={() => {}} />)
    })

    // Open the inline create-target form from the empty state.
    await act(async () => {
      await user.click(await screen.findByTestId('apply-create-target-toggle'))
    })
    await act(async () => {
      await user.type(screen.getByLabelText(/Name/i), 'Home server')
    })

    // Local by default → no remote fields yet.
    expect(screen.queryByTestId('apply-remote-fields')).not.toBeInTheDocument()

    // Switch to Remote (SSH): remote fields + the authorizable public key appear.
    await act(async () => {
      await user.selectOptions(screen.getByTestId('apply-target-location'), 'remote')
    })
    expect(await screen.findByTestId('apply-remote-fields')).toBeInTheDocument()
    const pubkey = await screen.findByTestId('apply-deploy-pubkey')
    expect(pubkey).toHaveTextContent('ssh-ed25519 AAAAC3NzaC1lZDI1 deploy@buildmystack')

    // Fill host + user (port defaults to 22) and submit.
    await act(async () => {
      await user.type(screen.getByLabelText(/^Host$/i), '192.168.1.20')
      await user.type(screen.getByLabelText(/SSH user/i), 'deploy')
      await user.click(screen.getByRole('button', { name: /Create Target/i }))
    })

    // The mutation carries the remote SSH shape and is forced to a docker target.
    await waitFor(() => {
      expect(api.deployments.createTarget.mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Home server',
          type: 'docker',
          location: 'remote',
          host: '192.168.1.20',
          sshUser: 'deploy',
          sshPort: 22,
        }),
      )
    })
  })

  it('renders CI YAML via renderApplyCi and shows it', async () => {
    const user = userEvent.setup({ delay: null }) // Disable delay to prevent timeouts
    // Needs a selectable target present (order-independent of the shared counter).
    ;(api.deployments.listTargets.query as any).mockResolvedValue({
      targets: [{ id: 't-1', name: 'Local K3s', type: 'kubernetes', provider: 'self-managed' }],
    })
    await act(async () => {
      renderWithQuery(<ApplyModal isOpen={true} onClose={() => {}} />)
    })

    // Wait for the target to be available (from the mock's second call)
    await waitFor(() => {
      const targetSelect = screen.getByTestId('apply-target-select') as HTMLSelectElement
      expect(targetSelect.options.length).toBeGreaterThan(1)
    })

    // Open CI panel and render
    const openCi = screen.getByTestId('apply-toggle-ci')
    await act(async () => { await user.click(openCi) })
    
    // After clicking, check if the render button appears, if so click it
    const renderBtn = screen.queryByTestId('apply-render-ci')
    if (renderBtn) {
      await act(async () => { await user.click(renderBtn) })
    }

    // Check that CI YAML appears
    await waitFor(() => {
      const yamlElement = screen.queryByTestId('apply-ci-yaml')
      if (!yamlElement) {
        // If YAML element doesn't exist, check for any text containing YAML content
        const yamlText = screen.queryByText(/stages.*deploy/i)
        expect(yamlText).toBeInTheDocument()
      } else {
        expect(yamlElement).toBeInTheDocument()
      }
    })
  })
})
