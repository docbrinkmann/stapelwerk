/**
 * Image-update awareness — "is a newer tag available?" for a service's image.
 *
 * Stapelwerk pins service images to a specific tag (e.g. `postgres:18-alpine`).
 * This module answers, advisory-only, whether Docker Hub publishes a newer
 * *comparable* tag so the builder can surface an "update available" hint.
 *
 * Design principles:
 * - Reuse the existing Docker Hub client (`DockerHubExtractor.getPopularTags`);
 *   we do NOT add a second HTTP path.
 * - Compare like-for-like: `18-alpine` vs `19-alpine`, never `18-alpine` vs
 *   `latest` or `19-bookworm`. The variant suffix must match exactly.
 * - Be conservative: only claim `updateAvailable` when we found a strictly
 *   higher same-variant semver. Anything ambiguous → `updateAvailable: false`.
 * - Be resilient: this runs server-side (tRPC). A network failure or an
 *   unparseable tag yields an "unknown"/advisory note, never a thrown error.
 */

import { DockerHubExtractor } from '@/lib/services/docker-hub-extractor';

/** Structured, advisory result for a single image's update check. */
export interface ImageUpdateResult {
  /** The image ref we were asked about, e.g. `postgres:18-alpine`. */
  image: string;
  /** The Docker Hub repository, e.g. `postgres` or `bitnami/nginx`. */
  repo: string;
  /** The tag currently pinned (or `latest` when none/`latest`). */
  current: string;
  /** The newest comparable stable tag, or null when none / not applicable. */
  latestStable: string | null;
  /** True only when a strictly-newer, same-variant tag was found. */
  updateAvailable: boolean;
  /** Human-readable, advisory explanation of the result. */
  note: string;
}

/** Fetches candidate tag names for a Docker Hub repo path (`namespace/repo`). */
export type TagLister = (repoPath: string) => Promise<string[]>;

interface ParsedRef {
  /** Non-Docker-Hub registry host (e.g. `ghcr.io`), or null for Docker Hub. */
  registry: string | null;
  namespace: string;
  repository: string;
  /** Path passed to the extractor, e.g. `library/postgres`. */
  repoPath: string;
  /** Bare repo name for display, e.g. `postgres` or `bitnami/nginx`. */
  displayRepo: string;
  /** The requested tag, or null when the ref carries no tag. */
  tag: string | null;
}

interface ParsedTag {
  /** Numeric version segments, e.g. `[18]` or `[18, 2, 1]`. */
  nums: number[];
  /** Non-numeric suffix family, e.g. `alpine`, `bookworm`, or '' for none. */
  variant: string;
}

/** A host segment is a registry when it looks like a domain or has a port. */
function looksLikeRegistry(segment: string): boolean {
  return segment.includes('.') || segment.includes(':') || segment === 'localhost';
}

const DOCKER_HUB_HOSTS = new Set(['docker.io', 'index.docker.io', 'registry.hub.docker.com']);

/**
 * Parse a `repo:tag` (optionally `registry/namespace/repo:tag@digest`) ref into
 * its parts. Distinguishes official (`library/`), namespaced (`user/repo`), and
 * registry-qualified refs (a non-Docker-Hub registry is flagged, not an error).
 */
export function parseImageRef(image: string): ParsedRef {
  // Drop any `@sha256:...` digest before splitting on the tag separator.
  const withoutDigest = image.trim().split('@')[0];
  const segments = withoutDigest.split('/');

  let registry: string | null = null;
  if (segments.length > 1 && looksLikeRegistry(segments[0])) {
    const host = segments.shift() as string;
    registry = DOCKER_HUB_HOSTS.has(host) ? null : host;
  }

  // The tag lives on the last path segment as `name:tag`.
  const last = segments[segments.length - 1];
  const colon = last.lastIndexOf(':');
  const tag = colon >= 0 ? last.slice(colon + 1) : null;
  if (colon >= 0) segments[segments.length - 1] = last.slice(0, colon);

  let namespace: string;
  let repository: string;
  if (segments.length === 1) {
    namespace = 'library';
    repository = segments[0];
  } else {
    namespace = segments[0];
    repository = segments.slice(1).join('/');
  }

  const displayRepo = namespace === 'library' ? repository : `${namespace}/${repository}`;
  return {
    registry,
    namespace,
    repository,
    repoPath: `${namespace}/${repository}`,
    displayRepo,
    tag: tag || null,
  };
}

/**
 * Parse a tag into a numeric version plus its variant suffix. Returns null for
 * tags that are not version numbers (`latest`, `stable`, `alpine`, …), which are
 * therefore not comparable.
 */
export function parseVersionTag(tag: string): ParsedTag | null {
  const t = tag.trim().toLowerCase().replace(/^v/, '');
  const match = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:[-_.]?([a-z][a-z0-9._-]*))?$/.exec(t);
  if (!match) return null;
  const nums = [match[1], match[2], match[3]]
    .filter((n): n is string => n !== undefined)
    .map(Number);
  return { nums, variant: match[4] ?? '' };
}

/** Compare two numeric version arrays; positive when a > b. Missing → 0. */
function compareVersions(a: number[], b: number[]): number {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * Check a single image for a newer comparable tag on Docker Hub.
 *
 * @param dockerImage The image ref, e.g. `postgres:18-alpine`.
 * @param listTags    Fetches candidate tags for a `namespace/repo` path.
 *                    Injectable for testing; defaults to the Docker Hub client.
 */
export async function checkImageUpdate(
  dockerImage: string,
  listTags: TagLister = defaultListTags,
): Promise<ImageUpdateResult> {
  const ref = parseImageRef(dockerImage);
  const base: Pick<ImageUpdateResult, 'image' | 'repo'> = {
    image: dockerImage,
    repo: ref.displayRepo,
  };

  // Registry-qualified, non-Docker-Hub images: acknowledge, don't error.
  if (ref.registry) {
    return {
      ...base,
      current: ref.tag ?? 'latest',
      latestStable: null,
      updateAvailable: false,
      note: `${ref.registry} is not Docker Hub — update check not supported.`,
    };
  }

  // No tag or `latest`: nudge toward pinning, but claim nothing.
  if (!ref.tag || ref.tag.toLowerCase() === 'latest') {
    return {
      ...base,
      current: 'latest',
      latestStable: null,
      updateAvailable: false,
      note: 'Using `latest` — pinning to a specific version is recommended.',
    };
  }

  const currentParsed = parseVersionTag(ref.tag);
  if (!currentParsed) {
    return {
      ...base,
      current: ref.tag,
      latestStable: null,
      updateAvailable: false,
      note: `Tag \`${ref.tag}\` is not a version number — cannot check for updates.`,
    };
  }

  // Fetch candidate tags. Any failure or empty result → advisory "unknown".
  let tags: string[];
  try {
    tags = await listTags(ref.repoPath);
  } catch {
    tags = [];
  }
  if (tags.length === 0) {
    return {
      ...base,
      current: ref.tag,
      latestStable: null,
      updateAvailable: false,
      note: 'Update status unknown — could not reach Docker Hub.',
    };
  }

  // Find the highest strictly-newer tag with the SAME variant (like-for-like).
  let best: { tag: string; nums: number[] } | null = null;
  for (const candidate of tags) {
    const parsed = parseVersionTag(candidate);
    if (!parsed || parsed.variant !== currentParsed.variant) continue;
    if (compareVersions(parsed.nums, currentParsed.nums) <= 0) continue;
    if (!best || compareVersions(parsed.nums, best.nums) > 0) {
      best = { tag: candidate, nums: parsed.nums };
    }
  }

  if (best) {
    return {
      ...base,
      current: ref.tag,
      latestStable: best.tag,
      updateAvailable: true,
      note: `${ref.displayRepo}: ${ref.tag} → ${best.tag} available`,
    };
  }

  return {
    ...base,
    current: ref.tag,
    latestStable: ref.tag,
    updateAvailable: false,
    note: 'Up to date.',
  };
}

/**
 * Check several images at once. Tag fetches are memoized per repository so a
 * stack with two images from the same repo only hits the network once.
 */
export async function checkImageUpdates(
  dockerImages: string[],
  listTags: TagLister = defaultListTags,
): Promise<ImageUpdateResult[]> {
  const cache = new Map<string, Promise<string[]>>();
  const memoized: TagLister = (repoPath) => {
    let pending = cache.get(repoPath);
    if (!pending) {
      pending = listTags(repoPath);
      cache.set(repoPath, pending);
    }
    return pending;
  };

  // Dedupe identical image refs while preserving input order.
  const seen = new Map<string, ImageUpdateResult>();
  const order: string[] = [];
  for (const image of dockerImages) {
    if (seen.has(image)) continue;
    order.push(image);
    seen.set(image, await checkImageUpdate(image, memoized));
  }
  return order.map((image) => seen.get(image) as ImageUpdateResult);
}

// Shared client instance; getPopularTags already swallows errors and caps the
// request to Docker Hub's tag page. 100 asks for the full recent-tag page.
const sharedExtractor = new DockerHubExtractor();
const defaultListTags: TagLister = (repoPath) => sharedExtractor.getPopularTags(repoPath, 100);
