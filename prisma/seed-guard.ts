/**
 * Guard for the seed's destructive catalog reset.
 *
 * The seed upserts services + categories by slug, so it is idempotent and does
 * NOT need to wipe anything on a normal run (e.g. the `migrate` service running
 * `tsx prisma/seed.ts` on every deploy). A reset is only useful against a local
 * dev DB to drop entries that were removed from the seed.
 *
 * Fail-safe by design:
 *  - OFF unless SEED_RESET=true is set explicitly, so a stray NODE_ENV on a prod
 *    box can never wipe the catalog.
 *  - HARD-REFUSED in production, so the live catalog + community submissions
 *    (service_imports) can never be destroyed by a deploy that runs the seed.
 */
export function shouldResetCatalog(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.SEED_RESET !== 'true') return false
  if (env.NODE_ENV === 'production') {
    throw new Error(
      'Refusing to reset the catalog: SEED_RESET=true with NODE_ENV=production. ' +
        'The seed upserts idempotently and must never wipe the production catalog or community submissions.',
    )
  }
  return true
}
