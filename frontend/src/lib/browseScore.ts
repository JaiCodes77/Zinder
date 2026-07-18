/**
 * Prefer server browse `score` (0–100). Fall back to interest overlap only when
 * the API omits it — never invent a score when a server value exists.
 */

export type BrowseScoreSource = 'server' | 'estimate';

export type BrowseScoreInput = {
  id: number;
  score?: number | null;
  interests?: string[];
};

export function estimateInterestScore(
  candidate: BrowseScoreInput,
  me: { interests?: string[] } | null | undefined
): number {
  const mine = new Set((me?.interests || []).map((i) => i.toLowerCase()));
  if (mine.size === 0) return 28 + ((candidate.id * 37) % 71);
  const theirs = (candidate.interests || []).map((i) => i.toLowerCase());
  const overlap = theirs.filter((i) => mine.has(i)).length;
  const base = Math.round((overlap / Math.max(mine.size, 1)) * 70) + 25;
  return Math.min(98, Math.max(28, base + (candidate.id % 7)));
}

export function resolveBrowseScore(
  candidate: BrowseScoreInput,
  me?: { interests?: string[] } | null
): { score: number; source: BrowseScoreSource } {
  if (typeof candidate.score === 'number' && Number.isFinite(candidate.score)) {
    return {
      score: Math.max(0, Math.min(100, Math.round(candidate.score))),
      source: 'server',
    };
  }
  return { score: estimateInterestScore(candidate, me), source: 'estimate' };
}
