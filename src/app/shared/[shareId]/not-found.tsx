import Link from 'next/link'
import { getT } from '@/lib/i18n/server'

export default async function NotFound() {
  const t = await getT()
  return (
    <main aria-labelledby="nf-title" className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6">
      <h1 id="nf-title" className="text-3xl font-semibold mb-3">{t('catalog.sharedNotFoundTitle')}</h1>
      <p className="text-muted-foreground mb-6 max-w-xl">{t('catalog.sharedNotFoundBody')}</p>
      <Link href="/community" className="px-4 py-2 rounded bg-primary text-primary-foreground">{t('catalog.browseCommunityStacks')}</Link>
    </main>
  )
}
