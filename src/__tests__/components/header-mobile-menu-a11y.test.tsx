import { render, screen, fireEvent } from '@testing-library/react'
import Header from '@/components/header'

function ensureRoot() {
  let root = document.getElementById('root')
  if (!root) {
    root = document.createElement('div')
    root.id = 'root'
    document.body.appendChild(root)
  }
}

describe('Header mobile menu a11y', () => {
  it('opens as dialog with aria-modal and sets inert on background, restores focus on close', async () => {
    ensureRoot()
    render(<Header />)

    const toggle = screen.getByRole('button', { name: /toggle mobile menu/i })
    toggle.focus()
    fireEvent.click(toggle)

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')

    // Inert is applied to #root
    const root = document.getElementById('root')
    expect(root).toHaveAttribute('inert')

    // Close via Escape
    fireEvent.keyDown(dialog, { key: 'Escape' })

    // Focus should return to the opener. Re-query: the motion button is
    // re-created on menu toggle, so the pre-open node reference is stale.
    expect(
      screen.getByRole('button', { name: /toggle mobile menu/i })
    ).toHaveFocus()
  })
})