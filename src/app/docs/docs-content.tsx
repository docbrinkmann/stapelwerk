'use client'

import Link from 'next/link'
import { useT } from '@/lib/i18n/client'

/**
 * Client body of the /docs page (translated via useT). Kept separate from
 * page.tsx so the page can stay a server component and export `metadata`.
 */
export default function DocsContent() {
  const t = useT()

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight">{t('landing.docsTitle')}</h1>
      <p className="mt-2 text-muted-foreground">
        {t('landing.docsIntroPre')}{' '}
        <code className="rounded bg-muted px-1 py-0.5 text-sm">docker-compose.yml</code>
        {t('landing.docsIntroPost')}
      </p>

      <nav aria-label={t('landing.docsTocAria')} className="mt-6 flex flex-wrap gap-3 text-sm">
        <a href="#getting-started" className="text-primary hover:underline">{t('landing.docsNavGettingStarted')}</a>
        <a href="#service-catalog" className="text-primary hover:underline">{t('landing.docsNavCatalog')}</a>
        <a href="#support" className="text-primary hover:underline">{t('landing.docsNavSupport')}</a>
      </nav>

      <section id="getting-started" className="mt-10 scroll-mt-24">
        <h2 className="text-xl font-semibold">{t('landing.docsNavGettingStarted')}</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-muted-foreground">
          <li>
            <Link href="/services" className="text-primary hover:underline">{t('landing.docsStep1Browse')}</Link>
            {t('landing.docsStep1Middle')}
            <Link href="/stack-builder" className="text-primary hover:underline">{t('landing.docsStep1Template')}</Link>.
          </li>
          <li>{t('landing.docsStep2')}</li>
          <li>{t('landing.docsStep3')}</li>
          <li>{t('landing.docsStep4Pre')} <code className="rounded bg-muted px-1 py-0.5 text-sm">docker-compose.yml</code>{t('landing.docsStep4Mid')} <code className="rounded bg-muted px-1 py-0.5 text-sm">.env</code>{t('landing.docsStep4Post')}</li>
          <li>{t('landing.docsStep5')}</li>
        </ol>
      </section>

      <section id="service-catalog" className="mt-10 scroll-mt-24">
        <h2 className="text-xl font-semibold">{t('landing.docsCatalogTitle')}</h2>
        <p className="mt-3 text-muted-foreground">{t('landing.docsCatalogIntro')}</p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-muted-foreground">
          <li><strong>{t('landing.docsCheckCompatTerm')}</strong> — {t('landing.docsCheckCompatBody')}</li>
          <li><strong>{t('landing.docsCheckBudgetTerm')}</strong> — {t('landing.docsCheckBudgetBody')}</li>
          <li><strong>{t('landing.docsCheckConfigTerm')}</strong> — {t('landing.docsCheckConfigBody')}</li>
        </ul>
      </section>

      <section id="support" className="mt-10 scroll-mt-24">
        <h2 className="text-xl font-semibold">{t('landing.docsNavSupport')}</h2>
        <p className="mt-3 text-muted-foreground">{t('landing.docsSupportP1')}</p>
        <p className="mt-3 text-muted-foreground">{t('landing.docsSupportP2')}</p>
      </section>
    </main>
  )
}
