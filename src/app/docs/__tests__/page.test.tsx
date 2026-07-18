import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import DocsPage from '../page'

describe('DocsPage', () => {
  it('renders the anchored help sections the app links to', () => {
    const { container } = render(<DocsPage />)
    // These ids back the /docs#... help links on /services and /403.
    expect(container.querySelector('#getting-started')).toBeTruthy()
    expect(container.querySelector('#service-catalog')).toBeTruthy()
    expect(container.querySelector('#support')).toBeTruthy()
  })
})
