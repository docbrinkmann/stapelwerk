import { PageProps } from '@/types/globals'
import { APP_CONFIG } from '@/lib/constants'
import { formatVersion } from '@/utils/helpers'
import Link from 'next/link'
import HeroSection from '@/components/hero-section'

export default function HomePage(_props: PageProps) {
  return (
    <div>
      <HeroSection />

      <footer className="border-t border-border/60 bg-background">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p className="text-sm text-muted-foreground">
            BuildMyStack — a guided composer for self-hosted Docker stacks.
          </p>
          <nav className="flex flex-wrap items-center gap-5 text-sm text-muted-foreground">
            <Link href="/services" className="transition-colors hover:text-foreground">
              Services
            </Link>
            <Link href="/docs" className="transition-colors hover:text-foreground">
              Docs
            </Link>
            <Link href="/auth/signin" className="transition-colors hover:text-foreground">
              Sign in
            </Link>
            <span className="text-muted-foreground/70">{formatVersion(APP_CONFIG.version)}</span>
          </nav>
        </div>
      </footer>
    </div>
  )
}
