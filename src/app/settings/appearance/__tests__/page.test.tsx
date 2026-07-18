import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('next-themes', () => ({ useTheme: () => ({ theme: 'dark', setTheme: vi.fn() }) }))
vi.mock('@/components/settings', () => ({
  SettingsLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

import AppearanceSettingsPage from '../page'

beforeEach(() => {
  localStorage.clear()
  document.documentElement.style.cssText = ''
})

describe('AppearanceSettingsPage', () => {
  it('applies + persists an accent color on selection', () => {
    render(<AppearanceSettingsPage />)
    fireEvent.click(screen.getByRole('button', { name: /select red color/i }))
    expect(localStorage.getItem('bms-accent')).toBe('red')
    expect(document.documentElement.style.getPropertyValue('--primary')).toBe('#ef4444')
  })

  it('applies + persists font size on selection', () => {
    render(<AppearanceSettingsPage />)
    fireEvent.click(screen.getByLabelText('Large'))
    expect(localStorage.getItem('bms-font-size')).toBe('large')
    expect(document.documentElement.style.fontSize).toBe('18px')
  })
})
