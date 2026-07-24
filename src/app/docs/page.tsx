import type { Metadata } from 'next'
import DocsContent from './docs-content'

export const metadata: Metadata = {
  title: 'Help & Docs — Stapelwerk',
  description: 'How to compose, export and deploy a Docker stack with Stapelwerk.',
}

/**
 * In-app help page. Static, honest content about what Stapelwerk actually
 * does (a guided Docker Compose composer). Anchored sections back the help
 * links elsewhere in the app (#getting-started, #service-catalog, #support).
 * Body lives in DocsContent (client) so it can translate via useT while this
 * file keeps the server-only `metadata` export.
 */
export default function DocsPage() {
  return <DocsContent />
}
