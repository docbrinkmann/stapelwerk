import type { Metadata } from 'next'
import DocsContent from './docs-content'
import { getT } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t('landing.docsMetaTitle'), description: t('landing.docsMetaDescription') }
}

/**
 * In-app help page. Static, honest content about what Stapelwerk actually
 * does (a guided Docker Compose composer). Anchored sections back the help
 * links elsewhere in the app (#getting-started, #service-catalog, #support).
 * Body lives in DocsContent (client) so it can translate via useT while this
 * file keeps the server-only metadata (generateMetadata, in the reader's language).
 */
export default function DocsPage() {
  return <DocsContent />
}
