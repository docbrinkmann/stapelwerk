import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { describe, it, expect } from 'vitest'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

function TabsDemo() {
  return (
    <Tabs defaultValue="one">
      <TabsList aria-label="Demo tabs">
        <TabsTrigger value="one">One</TabsTrigger>
        <TabsTrigger value="two">Two</TabsTrigger>
        <TabsTrigger value="three">Three</TabsTrigger>
      </TabsList>
      <TabsContent value="one">Panel One</TabsContent>
      <TabsContent value="two">Panel Two</TabsContent>
      <TabsContent value="three">Panel Three</TabsContent>
    </Tabs>
  )
}

describe('Tabs a11y & keyboard model', () => {
  it('uses arrow keys to move focus and activates panels automatically', async () => {
    const user = userEvent.setup({ delay: null }) // Disable delay to prevent timeouts
    render(<TabsDemo />)

    const triggers = screen.getAllByRole('tab')
    // Initial selected tab should be value "one"
    expect(triggers[0]).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Panel One')).toBeInTheDocument()

    // Move focus to first tab and navigate
    triggers[0].focus()
    await user.keyboard('{ArrowRight}')
    // Radix automatic activation selects next tab on arrow
    expect(triggers[1]).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Panel Two')).toBeInTheDocument()

    await user.keyboard('{End}')
    expect(triggers[2]).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Panel Three')).toBeInTheDocument()

    await user.keyboard('{Home}')
    expect(triggers[0]).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Panel One')).toBeInTheDocument()
  })
})