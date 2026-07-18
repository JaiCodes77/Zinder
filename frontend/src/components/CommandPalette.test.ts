import { describe, expect, it } from 'vitest';
import { fuzzyScore } from './CommandPalette';

describe('fuzzyScore', () => {
  it('scores empty query as a weak match', () => {
    expect(fuzzyScore('', 'Discover')).toBe(1);
    expect(fuzzyScore('   ', 'Discover')).toBe(1);
  });

  it('prefers exact and prefix matches', () => {
    expect(fuzzyScore('deck', 'deck')).toBe(200);
    expect(fuzzyScore('disc', 'discover')).toBeGreaterThan(fuzzyScore('disc', 'rediscover'));
    expect(fuzzyScore('match', 'Go to Matches')).toBeGreaterThan(0);
  });

  it('supports subsequence hits and rejects misses', () => {
    expect(fuzzyScore('ph', 'project help')).toBeGreaterThan(0);
    expect(fuzzyScore('xyz', 'project help')).toBe(0);
  });

  it('is case-insensitive', () => {
    expect(fuzzyScore('DECK', 'Open Discover deck')).toBe(fuzzyScore('deck', 'Open Discover deck'));
  });
});
