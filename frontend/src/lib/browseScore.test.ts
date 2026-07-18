import { describe, expect, it } from 'vitest';
import { estimateInterestScore, resolveBrowseScore } from './browseScore';

describe('resolveBrowseScore', () => {
  it('prefers finite server score over interest estimate', () => {
    const result = resolveBrowseScore(
      { id: 1, score: 91, interests: ['Python'] },
      { interests: ['Rust'] }
    );
    expect(result).toEqual({ score: 91, source: 'server' });
  });

  it('clamps server scores into 0–100', () => {
    expect(resolveBrowseScore({ id: 2, score: 140 }).score).toBe(100);
    expect(resolveBrowseScore({ id: 3, score: -5 }).score).toBe(0);
  });

  it('falls back to estimate when score is missing', () => {
    const result = resolveBrowseScore(
      { id: 10, interests: ['React', 'Go'] },
      { interests: ['React', 'TypeScript'] }
    );
    expect(result.source).toBe('estimate');
    expect(result.score).toBe(estimateInterestScore({ id: 10, interests: ['React', 'Go'] }, { interests: ['React', 'TypeScript'] }));
  });

  it('treats null/NaN server score as missing', () => {
    expect(resolveBrowseScore({ id: 4, score: null }).source).toBe('estimate');
    expect(resolveBrowseScore({ id: 5, score: Number.NaN }).source).toBe('estimate');
  });
});
