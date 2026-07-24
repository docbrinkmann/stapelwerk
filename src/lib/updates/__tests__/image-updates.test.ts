import { describe, it, expect, vi } from 'vitest';
import {
  checkImageUpdate,
  checkImageUpdates,
  parseImageRef,
  parseVersionTag,
  type TagLister,
} from '../image-updates';

/** A TagLister that always returns the same list, ignoring the repo path. */
const tagsOf = (tags: string[]): TagLister => () => Promise.resolve(tags);

describe('parseImageRef', () => {
  it('parses an official image into the library namespace', () => {
    const ref = parseImageRef('postgres:18-alpine');
    expect(ref).toMatchObject({
      registry: null,
      namespace: 'library',
      repository: 'postgres',
      repoPath: 'library/postgres',
      displayRepo: 'postgres',
      tag: '18-alpine',
    });
  });

  it('parses a namespaced user/repo image', () => {
    const ref = parseImageRef('bitnami/nginx:1.25');
    expect(ref).toMatchObject({
      registry: null,
      namespace: 'bitnami',
      repository: 'nginx',
      displayRepo: 'bitnami/nginx',
      tag: '1.25',
    });
  });

  it('flags a registry-qualified (non-Docker-Hub) image', () => {
    const ref = parseImageRef('ghcr.io/immich-app/immich-server:v1.106');
    expect(ref.registry).toBe('ghcr.io');
    expect(ref.tag).toBe('v1.106');
  });

  it('treats docker.io as Docker Hub (no external registry)', () => {
    const ref = parseImageRef('docker.io/library/postgres:18');
    expect(ref.registry).toBeNull();
    expect(ref.repoPath).toBe('library/postgres');
  });

  it('drops a trailing digest', () => {
    const ref = parseImageRef('postgres:18-alpine@sha256:deadbeef');
    expect(ref.tag).toBe('18-alpine');
  });
});

describe('parseVersionTag', () => {
  it('splits numeric version from variant suffix', () => {
    expect(parseVersionTag('18-alpine')).toEqual({ nums: [18], variant: 'alpine' });
    expect(parseVersionTag('18.2.1')).toEqual({ nums: [18, 2, 1], variant: '' });
    expect(parseVersionTag('v1.25.3-alpine')).toEqual({ nums: [1, 25, 3], variant: 'alpine' });
  });

  it('returns null for non-version tags', () => {
    expect(parseVersionTag('latest')).toBeNull();
    expect(parseVersionTag('stable')).toBeNull();
    expect(parseVersionTag('alpine')).toBeNull();
  });
});

describe('checkImageUpdate', () => {
  it('reports an update when a higher same-variant tag exists (18-alpine → 19-alpine)', async () => {
    const result = await checkImageUpdate(
      'postgres:18-alpine',
      tagsOf(['17-alpine', '18-alpine', '19-alpine', 'latest', '19']),
    );
    expect(result.updateAvailable).toBe(true);
    expect(result.latestStable).toBe('19-alpine');
    expect(result.note).toContain('postgres: 18-alpine → 19-alpine');
  });

  it('is up to date when the current tag is already the highest', async () => {
    const result = await checkImageUpdate(
      'postgres:19-alpine',
      tagsOf(['17-alpine', '18-alpine', '19-alpine']),
    );
    expect(result.updateAvailable).toBe(false);
    expect(result.note).toContain('Up to date');
  });

  it('never compares across variants (18-alpine ignores 19-bookworm and bare 19)', async () => {
    const result = await checkImageUpdate(
      'postgres:18-alpine',
      tagsOf(['19-bookworm', '20-bookworm', '19', 'latest']),
    );
    expect(result.updateAvailable).toBe(false);
    expect(result.latestStable).toBe('18-alpine');
  });

  it('notes a `latest` pin without a network call', async () => {
    const listTags = vi.fn<TagLister>();
    const result = await checkImageUpdate('nginx:latest', listTags);
    expect(result.updateAvailable).toBe(false);
    expect(result.note).toContain('pinning to a specific version is recommended');
    expect(listTags).not.toHaveBeenCalled();
  });

  it('skips a non-Docker-Hub registry without a network call', async () => {
    const listTags = vi.fn<TagLister>();
    const result = await checkImageUpdate('ghcr.io/owner/app:v1.2.0', listTags);
    expect(result.updateAvailable).toBe(false);
    expect(result.note).toContain('not Docker Hub');
    expect(listTags).not.toHaveBeenCalled();
  });

  it('returns "unknown" on a network error rather than throwing', async () => {
    const failing: TagLister = () => Promise.reject(new Error('ENETUNREACH'));
    const result = await checkImageUpdate('postgres:18-alpine', failing);
    expect(result.updateAvailable).toBe(false);
    expect(result.note.toLowerCase()).toContain('unknown');
  });

  it('cannot compare a non-version tag but does not error', async () => {
    const result = await checkImageUpdate('caddy:builder', tagsOf(['2.7', '2.8']));
    expect(result.updateAvailable).toBe(false);
    expect(result.note).toContain('not a version number');
  });
});

describe('checkImageUpdates (batch)', () => {
  it('memoizes tag fetches per repository', async () => {
    const listTags = vi.fn<TagLister>(() => Promise.resolve(['18-alpine', '19-alpine']));
    const results = await checkImageUpdates(
      ['postgres:18-alpine', 'postgres:19-alpine'],
      listTags,
    );
    expect(results).toHaveLength(2);
    // Same repo → fetched once.
    expect(listTags).toHaveBeenCalledTimes(1);
    expect(results[0].updateAvailable).toBe(true);
    expect(results[1].updateAvailable).toBe(false);
  });
});
