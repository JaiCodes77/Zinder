import React, { useMemo } from 'react';
import {
  motion,
  AnimatePresence,
  LayoutGroup,
} from 'framer-motion';
import {
  GitMerge,
  CircleSlash,
  Loader2,
  ArrowUpDown,
} from 'lucide-react';
import { CompatibilityRing } from './CompatibilityRing';
import { resolveBrowseScore } from '../lib/browseScore';
import { techChipTone } from '../lib/languageColors';
import { type BrowseSort } from '../lib/discoverRoutes';

export interface BrowseProfile {
  id: number;
  name: string;
  age: number;
  distance: string;
  bio: string;
  image: string;
  interests: string[];
  score?: number;
  distanceKm?: number | null;
}

export type DiscoverBrowseProps = {
  profiles: BrowseProfile[];
  myProfile: { interests?: string[] } | null;
  browseFilters: string[];
  browseSort: BrowseSort;
  browseCursor: string | null;
  loadingCandidates: boolean;
  loadingMoreCandidates: boolean;
  candidatesError: string | null;
  /** Status line while Nearby syncs browser geo → profile lat/lng. */
  nearbyGeoHint?: string | null;
  selectedBrowseId: number | null;
  reducedMotion: boolean;
  onToggleFilter: (chip: string) => void;
  onBrowseSortChange: (sort: BrowseSort) => void;
  onClearFilters: () => void;
  onRetry: () => void;
  onLoadMore: () => void;
  onSelectBrowseId: (id: number | null) => void;
  onBrowseAction: (userId: number, action: 'LIKE' | 'PASS') => void;
  onMergeAndGoToDeck: (userId: number) => void;
};

/** Canonical Discover filter chips — always shown (not derived from a thin seed set). */
const DISCOVER_FILTER_TAGS = [
  'Python',
  'Redis',
  'FastAPI',
  'React',
  'Node.js',
  'Rust',
  'TypeScript',
  'WebSockets',
  'Monaco Editor',
  'Go',
  'Docker',
  'GraphQL',
] as const;

const EASE = [0.22, 1, 0.36, 1] as const;
const SPRING_PILL = { type: 'spring' as const, stiffness: 380, damping: 32 };

const RequestSkeleton: React.FC = () => (
  <div className="space-y-3">
    {[0, 1, 2].map((i) => (
      <div key={i} className="glass rounded-[18px] p-5 space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="skeleton w-8 h-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3 w-28" />
            <div className="skeleton h-2.5 w-20" />
          </div>
        </div>
        <div className="skeleton h-4 w-3/4" />
        <div className="skeleton h-3 w-full" />
        <div className="skeleton h-3 w-5/6" />
      </div>
    ))}
  </div>
);

function parseDistanceMiles(distance: string): number {
  const n = parseFloat(distance.replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : 99;
}

export const DiscoverBrowse: React.FC<DiscoverBrowseProps> = ({
  profiles,
  myProfile,
  browseFilters,
  browseSort,
  browseCursor,
  loadingCandidates,
  loadingMoreCandidates,
  candidatesError,
  nearbyGeoHint = null,
  selectedBrowseId,
  reducedMotion,
  onToggleFilter,
  onBrowseSortChange,
  onClearFilters,
  onRetry,
  onLoadMore,
  onSelectBrowseId,
  onBrowseAction,
  onMergeAndGoToDeck,
}) => {
  const allInterestChips = useMemo(() => {
    const set = new Set<string>(DISCOVER_FILTER_TAGS);
    profiles.forEach((p) => p.interests.forEach((i) => set.add(i)));
    (myProfile?.interests || []).forEach((i: string) => set.add(i));
    const canonical = DISCOVER_FILTER_TAGS.filter((t) => set.has(t));
    const extras = Array.from(set)
      .filter((t) => !DISCOVER_FILTER_TAGS.some((c) => c.toLowerCase() === t.toLowerCase()))
      .slice(0, 4);
    return [...canonical, ...extras];
  }, [profiles, myProfile]);

  const browseScore = (p: BrowseProfile) => resolveBrowseScore(p, myProfile);

  const filteredBrowse = useMemo(() => {
    let list =
      browseFilters.length === 0
        ? [...profiles]
        : profiles.filter((p) =>
            browseFilters.some((f) =>
              p.interests.some((i) => i.toLowerCase() === f.toLowerCase())
            )
          );

    if (browseSort === 'match') {
      list.sort((a, b) => browseScore(b).score - browseScore(a).score);
    } else if (browseSort === 'nearby') {
      list.sort((a, b) => {
        const da = a.distanceKm ?? parseDistanceMiles(a.distance);
        const db = b.distanceKm ?? parseDistanceMiles(b.distance);
        return da - db;
      });
    } else {
      list.sort((a, b) => b.id - a.id);
    }
    return list;
  }, [profiles, browseFilters, browseSort, myProfile]);

  const selectedBrowse = profiles.find((p) => p.id === selectedBrowseId) || null;

  return (
    <LayoutGroup>
      <div className="w-full max-w-[960px]">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex flex-wrap gap-1.5 min-w-0 flex-1">
            {allInterestChips.map((chip) => {
              const on = browseFilters.includes(chip);
              const tone = techChipTone(chip);
              return (
                <motion.button
                  key={chip}
                  type="button"
                  onClick={() => onToggleFilter(chip)}
                  aria-pressed={on}
                  layout
                  animate={{ scale: on ? 1.03 : 1 }}
                  transition={
                    reducedMotion
                      ? { duration: 0 }
                      : { type: 'spring', stiffness: 480, damping: 16 }
                  }
                  className={`inline-flex items-center rounded-md px-2.5 py-1 text-[12px] font-mono border transition-[box-shadow,opacity] duration-200 ${
                    on ? 'ring-1 ring-offset-0' : 'opacity-85 hover:opacity-100'
                  }`}
                  style={{
                    background: tone.bg,
                    borderColor: on ? tone.text : tone.border,
                    color: tone.text,
                    boxShadow: on ? `0 0 0 1px ${tone.text}` : undefined,
                  }}
                >
                  {chip}
                </motion.button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 glass p-0.5 rounded-xl flex-shrink-0">
            <ArrowUpDown className="w-3 h-3 text-fg-subtle ml-2" />
            {(
              [
                { key: 'match' as const, label: 'Best match' },
                { key: 'newest' as const, label: 'Newest' },
                { key: 'nearby' as const, label: 'Nearby' },
              ] as const
            ).map(({ key, label }) => {
              const active = browseSort === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onBrowseSortChange(key)}
                  aria-pressed={active}
                  className={`relative px-2.5 py-1.5 rounded-[10px] text-[11px] font-medium transition-colors duration-200 ${
                    active ? 'text-fg' : 'text-fg-muted'
                  }`}
                >
                  {active && (
                    <motion.div
                      layoutId="browse-sort-pill"
                      className="absolute inset-0 rounded-[10px] bg-white/10"
                      transition={reducedMotion ? { duration: 0 } : SPRING_PILL}
                    />
                  )}
                  <span className="relative z-10">{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {nearbyGeoHint && (
          <p className="mono-label mb-3 text-fg-muted" role="status">
            {nearbyGeoHint}
          </p>
        )}

        {loadingCandidates && profiles.length === 0 ? (
          <RequestSkeleton />
        ) : candidatesError ? (
          <div className="glass rounded-[18px] p-12 text-center">
            <p className="text-sm text-fg-muted">{candidatesError}</p>
            <button
              type="button"
              onClick={onRetry}
              className="btn-ghost mt-4 px-4 py-2 rounded-[12px] text-[13px]"
            >
              Try again
            </button>
          </div>
        ) : filteredBrowse.length === 0 ? (
          <div className="glass rounded-[18px] p-12 text-center">
            <p className="text-sm text-fg-muted">No candidates match these filters.</p>
            {browseFilters.length > 0 && (
              <button
                type="button"
                onClick={onClearFilters}
                className="btn-ghost mt-4 px-4 py-2 rounded-[12px] text-[13px]"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="browse-grid">
            {filteredBrowse.map((p, idx) => {
              const { score, source } = browseScore(p);
              const isFeatured = idx === 0;
              const layoutSpring = reducedMotion
                ? { duration: 0 }
                : { type: 'spring' as const, stiffness: 300, damping: 30, mass: 0.8 };

              return (
                <motion.div
                  key={p.id}
                  layout
                  layoutId={`browse-card-${p.id}`}
                  transition={layoutSpring}
                  whileHover={
                    reducedMotion
                      ? undefined
                      : {
                          y: -4,
                          boxShadow: '0 18px 40px -16px rgba(0,0,0,0.6)',
                        }
                  }
                  className={`group relative glass rounded-[18px] overflow-hidden text-left h-full ${
                    isFeatured ? 'card-featured' : 'card-standard'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelectBrowseId(p.id)}
                    className="absolute inset-0 z-0"
                    aria-label={`Open ${p.name}`}
                  />

                  {isFeatured ? (
                    <div className="relative h-full min-h-[inherit] flex flex-col pointer-events-none">
                      <motion.div
                        layoutId="browse-featured-badge"
                        className="absolute top-3 left-3 z-20 px-2 py-0.5 rounded-md text-[10px] font-mono tracking-wide bg-accent-brand/20 text-accent-brand border border-accent-brand/35"
                        transition={layoutSpring}
                      >
                        Top match
                      </motion.div>
                      <div className="relative flex-1 min-h-[160px] overflow-hidden">
                        <img
                          src={p.image}
                          alt={p.name}
                          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                        />
                        <div
                          className="absolute inset-0"
                          style={{
                            background:
                              'linear-gradient(to top, rgba(10,13,20,0.92) 0%, rgba(10,13,20,0.4) 45%, transparent 100%)',
                          }}
                        />
                        <div
                          className="absolute top-3 right-3 z-10 pointer-events-auto"
                          title={
                            source === 'server'
                              ? 'Match score from server'
                              : 'Estimated from shared interests'
                          }
                        >
                          <CompatibilityRing
                            score={score}
                            size={52}
                            layoutId={`compat-${p.id}`}
                          />
                          {source === 'estimate' && (
                            <span className="sr-only">Estimated score</span>
                          )}
                        </div>
                      </div>
                      <div className="relative p-4 sm:p-5 -mt-10 z-10">
                        <p className="browse-card-name text-[16px] font-semibold text-fg">
                          {p.name}{' '}
                          <span className="text-fg-muted font-normal">{p.age}</span>
                        </p>
                        <p className="mono-label mt-0.5">{p.distance}</p>
                        <p className="browse-card-bio mt-2 !text-[13px]">
                          {p.bio || 'This developer hasn’t written a bio yet.'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="relative h-full min-h-[140px] flex gap-3 p-3.5 pointer-events-none">
                      <div className="w-14 h-14 rounded-[14px] overflow-hidden border border-white/12 flex-shrink-0">
                        <img
                          src={p.image}
                          alt={p.name}
                          className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                        />
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="browse-card-name text-[14px] font-semibold text-fg">
                              {p.name}{' '}
                              <span className="text-fg-muted font-normal">{p.age}</span>
                            </p>
                            <p className="mono-label mt-0.5">{p.distance}</p>
                          </div>
                          <div className="pointer-events-auto flex-shrink-0">
                            <CompatibilityRing
                              score={score}
                              size={40}
                              layoutId={`compat-${p.id}`}
                            />
                          </div>
                        </div>
                        <p className="browse-card-bio mt-1.5">
                          {p.bio || 'This developer hasn’t written a bio yet.'}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="absolute inset-x-0 bottom-0 z-20 flex justify-center gap-3 pb-3 pt-8 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-[opacity,transform] duration-200 pointer-events-none group-hover:pointer-events-auto bg-gradient-to-t from-bg-base/90 via-bg-base/50 to-transparent">
                    <motion.button
                      type="button"
                      whileTap={reducedMotion ? undefined : { scale: 0.9 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onBrowseAction(p.id, 'PASS');
                      }}
                      title="Close"
                      className="w-10 h-10 rounded-full glass border border-[#E5534B]/40 text-[#E5534B] flex items-center justify-center"
                    >
                      <CircleSlash className="w-4 h-4" />
                    </motion.button>
                    <motion.button
                      type="button"
                      whileTap={reducedMotion ? undefined : { scale: 0.9 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onBrowseAction(p.id, 'LIKE');
                      }}
                      title="Merge"
                      className="w-10 h-10 rounded-full glass border border-[#3FB950]/40 text-[#3FB950] flex items-center justify-center"
                    >
                      <GitMerge className="w-4 h-4" />
                    </motion.button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {browseCursor && !candidatesError && filteredBrowse.length > 0 && (
          <div className="flex justify-center mt-6">
            <button
              type="button"
              disabled={loadingMoreCandidates}
              onClick={onLoadMore}
              className="btn-ghost flex items-center gap-2 px-4 py-2.5 rounded-[12px] text-[13px] disabled:opacity-50"
            >
              {loadingMoreCandidates ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading more…
                </>
              ) : (
                'Load more candidates'
              )}
            </button>
          </div>
        )}

        <AnimatePresence>
          {selectedBrowse && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-bg-base/80 backdrop-blur-md"
              onClick={() => onSelectBrowseId(null)}
            >
              <motion.div
                initial={reducedMotion ? false : { y: 24, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={reducedMotion ? { opacity: 0 } : { y: 16, opacity: 0 }}
                transition={{ duration: 0.22, ease: EASE }}
                onClick={(e) => e.stopPropagation()}
                className="glass-raised w-full max-w-md rounded-[18px] p-6"
              >
                <div className="flex gap-4 items-start">
                  <div className="w-16 h-16 rounded-[14px] overflow-hidden border border-white/12">
                    <img
                      src={selectedBrowse.image}
                      alt={selectedBrowse.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-fg">
                      {selectedBrowse.name}{' '}
                      <span className="text-fg-muted font-normal">{selectedBrowse.age}</span>
                    </h3>
                    <p className="mono-label mt-0.5">{selectedBrowse.distance}</p>
                  </div>
                  <div
                    title={
                      browseScore(selectedBrowse).source === 'server'
                        ? 'Match score from server'
                        : 'Estimated from shared interests'
                    }
                  >
                    <CompatibilityRing
                      score={browseScore(selectedBrowse).score}
                      size={52}
                      layoutId={`compat-${selectedBrowse.id}`}
                    />
                  </div>
                </div>
                <p className="text-sm text-fg-muted mt-4 leading-relaxed">{selectedBrowse.bio}</p>
                <div className="flex flex-wrap gap-1.5 mt-4">
                  {selectedBrowse.interests.map((i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-md text-[11px] font-mono text-fg-muted bg-white/6 border border-white/12"
                    >
                      {i}
                    </span>
                  ))}
                </div>
                <div className="flex gap-2.5 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      onMergeAndGoToDeck(selectedBrowse.id);
                      onSelectBrowseId(null);
                    }}
                    className="btn-primary flex-1 py-2.5 rounded-[12px] text-sm"
                  >
                    Merge
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectBrowseId(null)}
                    className="btn-ghost flex-1 py-2.5 rounded-[12px] text-sm"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </LayoutGroup>
  );
};
