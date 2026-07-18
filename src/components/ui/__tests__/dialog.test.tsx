import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../dialog'

/**
 * Regression: the Dialog stub previously had NO way to close — no X button, no
 * Escape handler, no overlay-click — so an opened dialog trapped the user.
 */
function renderDialog(onOpenChange: (open: boolean) => void) {
  return render(
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sample Web Stack</DialogTitle>
        </DialogHeader>
        <button>Edit Stack</button>
      </DialogContent>
    </Dialog>,
  )
}

describe('Dialog', () => {
  it('renders children when open, nothing when closed', () => {
    const { rerender } = render(
      <Dialog open onOpenChange={vi.fn()}>
        <DialogContent><DialogTitle>Hi</DialogTitle></DialogContent>
      </Dialog>,
    )
    expect(screen.getByText('Hi')).toBeInTheDocument()
    rerender(
      <Dialog open={false} onOpenChange={vi.fn()}>
        <DialogContent><DialogTitle>Hi</DialogTitle></DialogContent>
      </Dialog>,
    )
    expect(screen.queryByText('Hi')).not.toBeInTheDocument()
  })

  it('closes via the X button', () => {
    const onOpenChange = vi.fn()
    renderDialog(onOpenChange)
    fireEvent.click(screen.getByLabelText('Close'))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('closes on Escape', () => {
    const onOpenChange = vi.fn()
    renderDialog(onOpenChange)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('closes when the overlay (backdrop) is clicked', () => {
    const onOpenChange = vi.fn()
    renderDialog(onOpenChange)
    // The overlay is the presentation wrapper around the dialog card.
    const overlay = screen.getByRole('dialog').parentElement as HTMLElement
    fireEvent.click(overlay)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('does NOT close when content inside the card is clicked', () => {
    const onOpenChange = vi.fn()
    renderDialog(onOpenChange)
    fireEvent.click(screen.getByText('Edit Stack'))
    expect(onOpenChange).not.toHaveBeenCalled()
  })
})
