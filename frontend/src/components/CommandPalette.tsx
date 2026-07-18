import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Code2,
  Compass,
  Layers,
  LayoutGrid,
  MessageCircle,
  Plus,
  Search,
  User,
  type LucideIcon,
} from 'lucide-react';
import type { ActivityTab } from './ActivityBar';

export type PaletteMatch = {
  id: number | string;
  name: string;
};

export type PaletteProject = {
  id: number;
  title: string;
};

type CommandPaletteProps = {
  open: boolean;
  onClose: () => void;
  onNavigateTab: (tab: ActivityTab) => void;
  onOpenMatch: (match: PaletteMatch) => void;
  onOpenProject: (project: PaletteProject) => void;
  /** Jump straight to Discover deck / browse (optional actions). */
  onOpenDiscoverDeck?: () => void;
  onOpenDiscoverBrowse?: () => void;
  onNewProjectHelp?: () => void;
  matches: PaletteMatch[];
  projects: PaletteProject[];
  reducedMotion?: boolean;
};

type PaletteItem = {
  id: string;
  group: 'Navigate' | 'Actions' | 'Matches' | 'Project help';
  label: string;
  hint?: string;
  icon: LucideIcon;
  score: number;
  run: () => void;
};

/** Exported for unit tests. */
export function fuzzyScore(query: string, text: string): number {
  const q = query.trim().toLowerCase();
  const t = text.toLowerCase();
  if (!q) return 1;
  if (t === q) return 200;
  const idx = t.indexOf(q);
  if (idx === 0) return 160 - Math.min(idx, 20);
  if (idx > 0) return 120 - Math.min(idx, 40);

  let ti = 0;
  let hits = 0;
  for (let qi = 0; qi < q.length; qi++) {
    const ch = q[qi];
    let found = false;
    while (ti < t.length) {
      if (t[ti++] === ch) {
        hits++;
        found = true;
        break;
      }
    }
    if (!found) return 0;
  }
  return Math.round((hits / t.length) * 80);
}

const NAV: { tab: ActivityTab; label: string; icon: LucideIcon; keywords: string }[] = [
  { tab: 'discover', label: 'Go to Discover', icon: Compass, keywords: 'discover swipe browse feed' },
  { tab: 'matches', label: 'Go to Matches', icon: MessageCircle, keywords: 'matches chat messages inbox' },
  {
    tab: 'projectHelp',
    label: 'Go to Project Help',
    icon: Code2,
    keywords: 'project help requests issues',
  },
  { tab: 'profile', label: 'Go to Profile', icon: User, keywords: 'profile settings account me' },
];

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onClose,
  onNavigateTab,
  onOpenMatch,
  onOpenProject,
  onOpenDiscoverDeck,
  onOpenDiscoverBrowse,
  onNewProjectHelp,
  matches,
  projects,
  reducedMotion = false,
}) => {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const items = useMemo(() => {
    const q = query.trim();
    const results: PaletteItem[] = [];

    for (const nav of NAV) {
      const score = q
        ? Math.max(fuzzyScore(q, nav.label), fuzzyScore(q, nav.keywords), fuzzyScore(q, nav.tab))
        : 50;
      if (!q || score > 0) {
        results.push({
          id: `nav-${nav.tab}`,
          group: 'Navigate',
          label: nav.label,
          hint: 'Jump',
          icon: nav.icon,
          score: q ? score + 20 : score,
          run: () => onNavigateTab(nav.tab),
        });
      }
    }

    const actions: {
      id: string;
      label: string;
      keywords: string;
      hint: string;
      icon: LucideIcon;
      run?: () => void;
    }[] = [
      {
        id: 'action-deck',
        label: 'Open Discover deck',
        keywords: 'deck swipe cards stack',
        hint: 'Discover',
        icon: Layers,
        run: onOpenDiscoverDeck,
      },
      {
        id: 'action-browse',
        label: 'Open Discover browse',
        keywords: 'browse grid list candidates',
        hint: 'Discover',
        icon: LayoutGrid,
        run: onOpenDiscoverBrowse,
      },
      {
        id: 'action-new-ph',
        label: 'New Project Help request',
        keywords: 'new create project help request issue',
        hint: 'Create',
        icon: Plus,
        run: onNewProjectHelp,
      },
    ];

    for (const action of actions) {
      if (!action.run) continue;
      const score = q
        ? Math.max(fuzzyScore(q, action.label), fuzzyScore(q, action.keywords))
        : 40;
      if (!q || score > 0) {
        results.push({
          id: action.id,
          group: 'Actions',
          label: action.label,
          hint: action.hint,
          icon: action.icon,
          score: q ? score + 15 : score,
          run: action.run,
        });
      }
    }

    for (const m of matches) {
      const score = fuzzyScore(q, m.name);
      if (!q || score > 0) {
        results.push({
          id: `match-${m.id}`,
          group: 'Matches',
          label: m.name,
          hint: 'Conversation',
          icon: MessageCircle,
          score: q ? score : 10,
          run: () => onOpenMatch(m),
        });
      }
    }

    for (const p of projects) {
      const score = fuzzyScore(q, p.title);
      if (!q || score > 0) {
        results.push({
          id: `project-${p.id}`,
          group: 'Project help',
          label: p.title,
          hint: 'Request',
          icon: Code2,
          score: q ? score : 10,
          run: () => onOpenProject(p),
        });
      }
    }

    results.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
    // Without a query: Navigate → Actions → short entity slice
    if (!q) {
      const nav = results.filter((r) => r.group === 'Navigate');
      const acts = results.filter((r) => r.group === 'Actions');
      const rest = results
        .filter((r) => r.group !== 'Navigate' && r.group !== 'Actions')
        .slice(0, 6);
      return [...nav, ...acts, ...rest];
    }
    return results.slice(0, 12);
  }, [
    query,
    matches,
    projects,
    onNavigateTab,
    onOpenMatch,
    onOpenProject,
    onOpenDiscoverDeck,
    onOpenDiscoverBrowse,
    onNewProjectHelp,
  ]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(0);
    const t = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${activeIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const runItem = (item: PaletteItem) => {
    item.run();
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(items.length - 1, i + 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
      return;
    }
    if (e.key === 'Enter' && items[activeIndex]) {
      e.preventDefault();
      runItem(items[activeIndex]);
    }
  };

  let lastGroup = '';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="command-palette-root"
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
          initial={reducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.15 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            className="command-palette glass"
            initial={reducedMotion ? false : { opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reducedMotion ? undefined : { opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: reducedMotion ? 0 : 0.18, ease: [0.22, 1, 0.36, 1] }}
            onKeyDown={onKeyDown}
          >
            <div className="command-palette__input-row">
              <Search className="w-4 h-4 text-fg-subtle flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Jump to… discover, matches, a request, a conversation"
                className="command-palette__input"
                aria-autocomplete="list"
                aria-controls="command-palette-results"
                autoComplete="off"
                spellCheck={false}
              />
              <kbd className="command-palette__kbd">esc</kbd>
            </div>

            <div
              id="command-palette-results"
              ref={listRef}
              className="command-palette__results"
              role="listbox"
            >
              {items.length === 0 ? (
                <p className="command-palette__empty">No matches</p>
              ) : (
                items.map((item, idx) => {
                  const showGroup = item.group !== lastGroup;
                  lastGroup = item.group;
                  const Icon = item.icon;
                  const selected = idx === activeIndex;
                  return (
                    <React.Fragment key={item.id}>
                      {showGroup && (
                        <div className="command-palette__group" aria-hidden>
                          {item.group}
                        </div>
                      )}
                      <button
                        type="button"
                        role="option"
                        aria-selected={selected}
                        data-idx={idx}
                        className={`command-palette__item ${selected ? 'is-selected' : ''}`}
                        onMouseEnter={() => setActiveIndex(idx)}
                        onClick={() => runItem(item)}
                      >
                        <Icon className="w-3.5 h-3.5 flex-shrink-0 opacity-80" />
                        <span className="truncate flex-1 text-left">{item.label}</span>
                        {item.hint && (
                          <span className="command-palette__hint">{item.hint}</span>
                        )}
                      </button>
                    </React.Fragment>
                  );
                })
              )}
            </div>

            <div className="command-palette__footer">
              <span>
                <kbd className="command-palette__kbd">↑</kbd>
                <kbd className="command-palette__kbd">↓</kbd> navigate
              </span>
              <span>
                <kbd className="command-palette__kbd">↵</kbd> open
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/** Quiet discoverability chip for the breadcrumb strip. */
export const CommandPaletteHint: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  const isMac =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || '');
  return (
    <button
      type="button"
      onClick={onClick}
      className="command-palette-hint"
      title="Open command palette"
      aria-label="Open command palette"
    >
      <kbd>{isMac ? '⌘' : 'Ctrl'}</kbd>
      <kbd>K</kbd>
    </button>
  );
};
