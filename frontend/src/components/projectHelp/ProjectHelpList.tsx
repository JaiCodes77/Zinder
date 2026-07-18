import React, { useMemo, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { ArrowUpDown, Code2, Plus, Search } from 'lucide-react';
import type { RequestStatus } from '../RequestStepper';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import {
  deriveInterested,
  deriveUrgency,
  EASE,
  SPRING_PILL,
  URGENCY_RANK,
} from './helpers';
import type { ListTab, ProjectRequest, SortMode, Urgency } from './types';
import { nextRequestStatus, RequestCard } from './RequestCard';

type ProjectHelpListProps = {
  projects: ProjectRequest[];
  loading: boolean;
  myUserId: number | null;
  helpingIds: Set<number>;
  projectStatuses: Record<number, RequestStatus>;
  urgencyOverrides: Record<number, Urgency>;
  onOpenDetail: (id: number) => void;
  onNewRequest: () => void;
  onStatusChange: (id: number, next: RequestStatus) => void;
};

const TABS: { key: ListTab; label: string }[] = [
  { key: 'all', label: 'All requests' },
  { key: 'mine', label: 'My requests' },
  { key: 'helping', label: 'Helping' },
];

const SORTS: { key: SortMode; label: string }[] = [
  { key: 'recency', label: 'Recency' },
  { key: 'urgency', label: 'Urgency' },
  { key: 'tag', label: 'Tag' },
];

const RequestSkeleton: React.FC = () => (
  <div className="space-y-3">
    {[0, 1, 2].map((i) => (
      <div key={i} className="glass rounded-[18px] p-5 space-y-3 border-l-[3px] border-l-white/10">
        <div className="flex items-center gap-2.5">
          <div className="skeleton w-8 h-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3 w-28" />
            <div className="skeleton h-2.5 w-20" />
          </div>
        </div>
        <div className="skeleton h-1.5 w-full rounded-full" />
        <div className="skeleton h-4 w-3/4" />
        <div className="skeleton h-3 w-full" />
      </div>
    ))}
  </div>
);

export const ProjectHelpList: React.FC<ProjectHelpListProps> = ({
  projects,
  loading,
  myUserId,
  helpingIds,
  projectStatuses,
  urgencyOverrides,
  onOpenDetail,
  onNewRequest,
  onStatusChange,
}) => {
  const reduced = usePrefersReducedMotion();
  const [tab, setTab] = useState<ListTab>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortMode>('recency');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  /** Bumps on tab switch so cards re-stagger. */
  const [enterKey, setEnterKey] = useState(0);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const p of projects) for (const t of p.tech_stack || []) set.add(t);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [projects]);

  const filtered = useMemo(() => {
    let list = [...projects];

    if (tab === 'mine' && myUserId != null) {
      list = list.filter((p) => p.user_id === myUserId);
    } else if (tab === 'helping') {
      list = list.filter((p) => helpingIds.has(p.id));
    }

    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          (p.tech_stack || []).some((t) => t.toLowerCase().includes(q)) ||
          (p.user_name || '').toLowerCase().includes(q)
      );
    }

    if (tagFilter) {
      list = list.filter((p) => (p.tech_stack || []).includes(tagFilter));
    }

    list.sort((a, b) => {
      if (sort === 'urgency') {
        const ua = URGENCY_RANK[deriveUrgency(a, urgencyOverrides[a.id])];
        const ub = URGENCY_RANK[deriveUrgency(b, urgencyOverrides[b.id])];
        if (ub !== ua) return ub - ua;
      } else if (sort === 'tag') {
        const ta = (a.tech_stack?.[0] || '').toLowerCase();
        const tb = (b.tech_stack?.[0] || '').toLowerCase();
        if (ta !== tb) return ta.localeCompare(tb);
      }
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    return list;
  }, [projects, tab, myUserId, helpingIds, query, sort, tagFilter, urgencyOverrides]);

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="flex justify-between items-end mb-5 gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-fg">Project help</h1>
          <p className="text-[13px] text-fg-muted mt-0.5">
            Get unblocked by other developers — or lend a hand.
          </p>
        </div>
        <button
          type="button"
          onClick={onNewRequest}
          className="btn-primary flex items-center gap-1.5 px-3.5 py-2 rounded-[12px] text-[13px] flex-shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New request</span>
        </button>
      </div>

      <LayoutGroup id="project-help-tabs">
        <div className="glass relative flex p-0.5 rounded-xl mb-4">
          {TABS.map(({ key, label }) => {
            const active = tab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  if (key !== tab) {
                    setTab(key);
                    setEnterKey((k) => k + 1);
                  }
                }}
                aria-pressed={active}
                className={`relative flex-1 px-2.5 py-1.5 rounded-[10px] text-[12px] font-medium transition-colors duration-200 ${
                  active ? 'text-fg' : 'text-fg-muted'
                }`}
              >
                {active && (
                  <motion.div
                    layoutId="project-help-tab-pill"
                    className="absolute inset-0 rounded-[10px] bg-white/10"
                    transition={reduced ? { duration: 0 } : SPRING_PILL}
                  />
                )}
                <span className="relative z-10">{label}</span>
              </button>
            );
          })}
        </div>
      </LayoutGroup>

      <div className="flex flex-col sm:flex-row gap-2.5 mb-3">
        <div className="field flex items-center gap-2 flex-1 px-3">
          <Search className="w-3.5 h-3.5 text-fg-subtle flex-shrink-0" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, tech, requester…"
            className="w-full bg-transparent text-sm text-fg placeholder-fg-subtle focus:outline-none border-none py-2.5"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <ArrowUpDown className="w-3.5 h-3.5 text-fg-subtle hidden sm:block" />
          {SORTS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setSort(key)}
              className={`px-2.5 py-1.5 rounded-[10px] text-[11px] font-mono border transition-colors ${
                sort === key
                  ? 'bg-accent-brand/12 text-accent-brand border-accent-brand/30'
                  : 'bg-white/4 text-fg-muted border-white/12 hover:border-white/20'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-5">
          <button
            type="button"
            onClick={() => setTagFilter(null)}
            className={`px-2 py-0.5 rounded-md text-[11px] font-mono border transition-colors ${
              !tagFilter
                ? 'bg-white/10 text-fg border-white/20'
                : 'bg-transparent text-fg-subtle border-white/10 hover:border-white/20'
            }`}
          >
            All tags
          </button>
          {allTags.slice(0, 12).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTagFilter(tagFilter === t ? null : t)}
              className={`px-2 py-0.5 rounded-md text-[11px] font-mono border transition-colors ${
                tagFilter === t
                  ? 'bg-accent-brand/12 text-accent-brand border-accent-brand/30'
                  : 'bg-transparent text-fg-subtle border-white/10 hover:border-white/20'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <RequestSkeleton />
      ) : filtered.length > 0 ? (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((proj, index) => (
              <motion.div
                key={`${enterKey}-${proj.id}`}
                layout
                initial={reduced ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
                transition={{
                  duration: reduced ? 0 : 0.32,
                  delay: reduced ? 0 : index * 0.04,
                  ease: EASE,
                }}
              >
                <RequestCard
                  project={proj}
                  status={projectStatuses[proj.id] || 'pending'}
                  urgency={deriveUrgency(proj, urgencyOverrides[proj.id])}
                  interestOverride={
                    helpingIds.has(proj.id)
                      ? Math.max(deriveInterested(proj.id).length, 1)
                      : undefined
                  }
                  onClick={() => onOpenDetail(proj.id)}
                  onCycleStatus={() => {
                    const cur = projectStatuses[proj.id] || 'pending';
                    onStatusChange(proj.id, nextRequestStatus(cur));
                  }}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="glass rounded-[18px] p-12 text-center flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-white/6 border border-white/12 flex items-center justify-center mb-4">
            <Code2 className="w-5 h-5 text-fg-subtle" />
          </div>
          <h3 className="text-base font-semibold text-fg">
            {tab === 'helping'
              ? 'Not helping anyone yet'
              : tab === 'mine'
                ? 'No requests from you'
                : 'No matching requests'}
          </h3>
          <p className="text-[13px] text-fg-muted mt-1.5 max-w-xs">
            {tab === 'all'
              ? 'Be the first to ask for a code review, debugging help, or a collaborator.'
              : 'Try another tab or clear your filters.'}
          </p>
          {tab === 'all' && (
            <button
              type="button"
              onClick={onNewRequest}
              className="btn-primary mt-6 px-4 py-2 rounded-[12px] text-[13px]"
            >
              Create a request
            </button>
          )}
        </div>
      )}
    </div>
  );
};
