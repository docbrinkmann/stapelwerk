import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

const h = vi.hoisted(() => ({ role: 'user' }))
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { name: 'Test', email: 'test@example.com', role: h.role } } }),
  signOut: vi.fn(),
}))
vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard', useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/utils/trpc', () => ({ trpc: { stacks: { list: { useQuery: () => ({ data: undefined }) } } } }))

import { AppSidebar } from '../app-sidebar'
import { SidebarProvider } from '@/components/ui/sidebar'

const renderSidebar = () =>
  render(
    <SidebarProvider>
      <AppSidebar />
    </SidebarProvider>,
  )

describe('AppSidebar', () => {
  it('shows the admin entry to admins only', () => {
    h.role = 'user'
    const { unmount } = renderSidebar()
    expect(screen.queryByRole('link', { name: /admin/i })).not.toBeInTheDocument()
    unmount()

    h.role = 'admin'
    renderSidebar()
    expect(screen.getByRole('link', { name: /admin/i })).toHaveAttribute('href', '/admin/templates')
  })
})
