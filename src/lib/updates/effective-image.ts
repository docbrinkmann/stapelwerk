import type { StackService } from '@/types/stack'

/**
 * The image ref a stack service will actually run, i.e. the catalog
 * `dockerImage` with any per-stack `configuration.imageTag` override applied.
 *
 * This is what the "update available" check must compare against — otherwise an
 * applied update keeps reporting as pending because the catalog tag never
 * changes. Handles registry ports and `@digest` when swapping the tag.
 */
export function effectiveImageRef(
  s: Pick<StackService, 'service' | 'configuration'>,
): string | undefined {
  const base = s.service?.dockerImage
  if (!base) return undefined
  const tag = s.configuration?.imageTag
  if (!tag) return base

  const ref = String(base).trim()
  const at = ref.indexOf('@')
  const withoutDigest = at >= 0 ? ref.slice(0, at) : ref
  const lastColon = withoutDigest.lastIndexOf(':')
  const lastSlash = withoutDigest.lastIndexOf('/')
  const repo =
    lastColon > lastSlash && lastColon !== -1
      ? withoutDigest.slice(0, lastColon)
      : withoutDigest
  return `${repo}:${tag}`
}
