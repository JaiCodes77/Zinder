import { describe, expect, it } from 'vitest';
import { hashForDiscover, parseDiscoverHash } from './discoverRoutes';

describe('discoverRoutes', () => {
  it('defaults when hash is not discover', () => {
    expect(parseDiscoverHash('#/matches')).toEqual({
      view: 'deck',
      sort: 'match',
      tags: [],
    });
  });

  it('parses view, sort, and tags', () => {
    expect(parseDiscoverHash('#/discover?view=browse&sort=nearby&tags=React,Go')).toEqual({
      view: 'browse',
      sort: 'nearby',
      tags: ['React', 'Go'],
    });
  });

  it('builds compact hashes', () => {
    expect(hashForDiscover({ view: 'deck', sort: 'match', tags: [] })).toBe('#/discover');
    expect(
      hashForDiscover({ view: 'browse', sort: 'newest', tags: ['Rust'] })
    ).toBe('#/discover?view=browse&sort=newest&tags=Rust');
  });

  it('round-trips', () => {
    const state = {
      view: 'browse' as const,
      sort: 'newest' as const,
      tags: ['TypeScript', 'Vite'],
    };
    expect(parseDiscoverHash(hashForDiscover(state))).toEqual(state);
  });
});
