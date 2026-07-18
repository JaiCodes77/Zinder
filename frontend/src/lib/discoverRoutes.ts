export type DiscoverView = 'deck' | 'browse';
export type BrowseSort = 'match' | 'newest' | 'nearby';

export type DiscoverRouteState = {
  view: DiscoverView;
  sort: BrowseSort;
  tags: string[];
};

const SORTS = new Set<BrowseSort>(['match', 'newest', 'nearby']);

/** Parse `#/discover?view=browse&sort=newest&tags=React,Go`. */
export function parseDiscoverHash(
  hash: string = typeof window !== 'undefined' ? window.location.hash : ''
): DiscoverRouteState {
  const raw = hash.replace(/^#\/?/, '');
  const [path, query = ''] = raw.split('?');
  const first = path.split('/').filter(Boolean)[0];
  if (first !== 'discover') {
    return { view: 'deck', sort: 'match', tags: [] };
  }
  const params = new URLSearchParams(query);
  const view = params.get('view') === 'browse' ? 'browse' : 'deck';
  const sortRaw = params.get('sort') || 'match';
  const sort: BrowseSort = SORTS.has(sortRaw as BrowseSort)
    ? (sortRaw as BrowseSort)
    : 'match';
  const tags = (params.get('tags') || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  return { view, sort, tags };
}

export function hashForDiscover(state: DiscoverRouteState): string {
  const params = new URLSearchParams();
  if (state.view === 'browse') params.set('view', 'browse');
  if (state.sort !== 'match') params.set('sort', state.sort);
  if (state.tags.length > 0) params.set('tags', state.tags.join(','));
  const q = params.toString();
  return q ? `#/discover?${q}` : '#/discover';
}

export function replaceDiscoverHash(state: DiscoverRouteState): void {
  if (typeof window === 'undefined') return;
  const target = hashForDiscover(state);
  if (window.location.hash === target) return;
  window.history.replaceState(
    null,
    '',
    `${window.location.pathname}${window.location.search}${target}`
  );
}
