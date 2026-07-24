import type { Metadata } from 'next'
import DocsContent from './docs-content'

export const metadata: Metadata = {
  title: 'Help & Docs — BuildMyStack',
  description: 'How to compose, export and deploy a Docker stack with BuildMyStack.',
}

/**
 * In-app help page. Static, honest content about what BuildMyStack actually
 * does (a guided Docker Compose composer). Anchored sections back the help
 * links elsewhere in the app (#getting-started, #service-catalog, #support).
 * Body lives in DocsContent (client) so it can translate via useT while this
 * file keeps the server-only `metadata` export.
 */
export default function DocsPage() {
  return <DocsContent />
}
