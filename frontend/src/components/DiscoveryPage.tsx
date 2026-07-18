import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  useSpring,
  animate,
  LayoutGroup,
} from 'framer-motion';
import {
  GitMerge,
  CircleSlash,
  X,
  Undo2,
  Star,
  MessageCircle,
  User,
  Compass,
  Code2,
  Send,
  Loader2,
  ChevronLeft,
  MapPin,
  Check,
  CheckCheck,
  LayoutGrid,
  Layers,
  ArrowDown,
  ArrowUpDown,
} from 'lucide-react';
import { GatewayNetwork } from './GatewayNetwork';
import { MatchBloom } from './MatchBloom';
import { CompatibilityRing } from './CompatibilityRing';
import { type RequestStatus } from './RequestStepper';
import { ProfilePage } from './ProfilePage';
import { ProjectHelpHub, type ProjectRequest } from './projectHelp';
import { isProjectHelpHash, projectHelpHash } from './projectHelp/routes';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { techChipTone } from '../lib/languageColors';
import { ActivityBar, type ActivityTab } from './ActivityBar';
import { CommandPalette, CommandPaletteHint } from './CommandPalette';

const ACTIVITY_BAR_COLLAPSED_KEY = 'zinder.activityBar.collapsed';

function readActivityBarCollapsed(): boolean {
  try {
    const v = localStorage.getItem(ACTIVITY_BAR_COLLAPSED_KEY);
    if (v === null) return true; // default: icon rail
    return v === '1';
  } catch {
    return true;
  }
}

// ==========================================
// TYPES
// ==========================================
interface Profile {
  id: number;
  name: string;
  age: number;
  distance: string;
  bio: string;
  image: string;
  interests: string[];
  /** Server-computed compatibility (0–100), when browse returns it. */
  score?: number;
  distanceKm?: number | null;
}

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

interface Match {
  id: number | string;
  name: string;
  avatar: string;
  lastMessage: string;
  time: string;
  unread: boolean;
  type?: 'match' | 'project';
  projectTitle?: string;
  projectDesc?: string;
  projectTech?: string[];
}

type ChatMessage = {
  sender: 'me' | 'them';
  text: string;
  time: string;
  read?: boolean;
};

interface DiscoveryPageProps {
  onLogout: () => void;
}

const EASE = [0.22, 1, 0.36, 1] as const;

// ==========================================
// SMALL SHARED PIECES
const Avatar: React.FC<{ initials: string; size?: string; className?: string }> = ({
  initials,
  size = 'w-9 h-9 text-xs',
  className = '',
}) => (
  <div
    className={`${size} ${className} rounded-full bg-ink-750 border border-white/12 flex items-center justify-center font-semibold text-fg-muted flex-shrink-0 select-none`}
  >
    {initials}
  </div>
);

const Spinner: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex flex-col items-center justify-center gap-3 py-16">
    <Loader2 className="w-5 h-5 text-fg-subtle animate-spin" />
    <p className="mono-label">{label}</p>
  </div>
);

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

function scoreCompatibility(candidate: Profile, me: { interests?: string[] } | null): number {
  const mine = new Set((me?.interests || []).map((i) => i.toLowerCase()));
  // Spread across <50 / 50–79 / ≥80 so Browse size + ring bands are always visible.
  if (mine.size === 0) return 28 + ((candidate.id * 37) % 71);
  const theirs = candidate.interests.map((i) => i.toLowerCase());
  const overlap = theirs.filter((i) => mine.has(i)).length;
  const base = Math.round((overlap / Math.max(mine.size, 1)) * 70) + 25;
  return Math.min(98, Math.max(28, base + (candidate.id % 7)));
}

/** Presentation-only online hint — does not touch the messaging data layer. */
function isMatchOnline(id: number | string): boolean {
  const n = typeof id === 'number' ? id : [...String(id)].reduce((a, c) => a + c.charCodeAt(0), 0);
  return n % 3 !== 0;
}

const CHAT_STARTERS = ['👋 Say hi', 'Ask about their stack', 'What are you building?'] as const;

const DateSeparator: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex justify-center py-2">
    <span className="px-2.5 py-0.5 rounded-full text-[11px] tracking-wide text-fg-subtle bg-white/6 border border-white/10">
      {label}
    </span>
  </div>
);

const OnlinePresence: React.FC<{
  reducedMotion: boolean;
  size?: 'sm' | 'md';
  /** Chat uses a soft human pulse; list keeps quiet tool chrome. */
  tone?: 'tool' | 'human';
}> = ({ reducedMotion, size = 'md', tone = 'tool' }) => {
  const dot = size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5';
  const color = tone === 'human' ? 'bg-fg-muted' : 'bg-accent-merge';
  return (
    <span className={`absolute bottom-0 right-0 ${dot} flex items-center justify-center`}>
      {!reducedMotion && (
        <motion.span
          className={`absolute inset-0 rounded-full ${color}/55`}
          animate={{ scale: [1, 1.75], opacity: [0.55, 0] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }}
        />
      )}
      <span className={`relative ${dot} rounded-full ${color} border-[1.5px] border-bg-base`} />
    </span>
  );
};

const MatchEmptyChat: React.FC<{
  name: string;
  avatar: string;
  reducedMotion: boolean;
  onSuggest: (text: string) => void;
}> = ({ name, avatar, reducedMotion, onSuggest }) => (
  <div className="flex-1 min-h-[320px] flex flex-col items-center justify-center text-center px-4">
    {/* Radar ping — sized box so rings aren't clipped by the scroll parent */}
    <div className="relative w-[140px] h-[140px] mb-2 flex items-center justify-center">
      {[0, 1].map((i) => (
        <motion.div
          key={i}
          className="absolute w-14 h-14 rounded-full border border-white/25 pointer-events-none"
          initial={false}
          animate={
            reducedMotion
              ? { opacity: 0.28, scale: 1 + i * 0.35 }
              : { scale: [1, 1.8], opacity: [0.5, 0] }
          }
          transition={
            reducedMotion
              ? { duration: 0 }
              : { duration: 2, repeat: Infinity, ease: 'easeOut', delay: i * 1 }
          }
        />
      ))}
      <div className="relative z-10 w-14 h-14 rounded-full overflow-hidden border border-white/14">
        <img src={avatar} alt={name} className="w-full h-full object-cover" />
      </div>
    </div>

    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: reducedMotion ? 0 : 0.45, duration: 0.4, ease: EASE }}
      className="space-y-1"
    >
      <p className="display text-lg text-fg">
        You matched with {name}
      </p>
      <p className="text-sm text-fg-muted mt-1">Say hi and start the conversation.</p>
    </motion.div>

    <div className="mt-5 flex flex-wrap items-center justify-center gap-2 max-w-[340px]">
      {CHAT_STARTERS.map((label, i) => (
        <motion.button
          key={label}
          type="button"
          onClick={() => onSuggest(label)}
          initial={reducedMotion ? false : { opacity: 0, y: 8 }}
          animate={
            reducedMotion
              ? { opacity: 1, y: 0 }
              : { opacity: 1, y: [0, -3, 0] }
          }
          transition={
            reducedMotion
              ? { duration: 0 }
              : {
                  opacity: { delay: 0.65 + i * 0.08, duration: 0.3, ease: EASE },
                  y: {
                    delay: 1 + i * 0.45,
                    duration: 3.2 + i * 0.5,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  },
                }
          }
          className="px-3 py-1.5 rounded-full text-[12px] text-fg-muted bg-white/6 border border-white/12 hover:bg-white/10 hover:text-fg hover:border-white/25 transition-colors duration-200"
        >
          {label}
        </motion.button>
      ))}
    </div>
  </div>
);

const NoConversationOpen: React.FC<{
  matches: Match[];
  reducedMotion: boolean;
  onSelect: (match: Match) => void;
}> = ({ matches, reducedMotion, onSelect }) => (
  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
    <motion.div
      className="w-12 h-12 rounded-full bg-white/6 border border-white/12 flex items-center justify-center mb-4 text-fg-subtle"
      animate={reducedMotion ? undefined : { y: [0, -4, 0] }}
      transition={
        reducedMotion
          ? { duration: 0 }
          : { duration: 3, repeat: Infinity, ease: 'easeInOut' }
      }
    >
      <MessageCircle className="w-5 h-5" />
    </motion.div>
    <h3 className="text-sm font-semibold text-fg">Your messages</h3>
    <p className="text-[13px] text-fg-muted mt-1.5 max-w-[240px] leading-relaxed">
      Select a match to start the conversation.
    </p>

    {matches.length > 0 && (
      <div className="mt-6 flex items-center justify-center gap-2.5 flex-wrap max-w-[280px]">
        {matches.slice(0, 6).map((match, i) => (
          <motion.button
            key={match.id}
            type="button"
            title={match.name}
            aria-label={`Open chat with ${match.name}`}
            onClick={() => onSelect(match)}
            initial={reducedMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: reducedMotion ? 0 : i * 0.05,
              duration: reducedMotion ? 0 : 0.35,
              ease: EASE,
            }}
            className="relative w-10 h-10 rounded-full overflow-hidden border border-white/14 hover:border-accent-brand/50 hover:scale-105 transition-[border-color,transform] duration-200"
          >
            <img src={match.avatar} alt={match.name} className="w-full h-full object-cover" />
          </motion.button>
        ))}
      </div>
    )}
  </div>
);

function parseDistanceMiles(distance: string): number {
  const n = parseFloat(distance.replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : 99;
}

function formatDistanceKm(km: unknown, fallback?: string | null): string {
  if (typeof km === 'number' && Number.isFinite(km)) {
    const miles = km * 0.621371;
    if (miles < 0.1) return 'Nearby';
    const rounded = miles < 10 ? miles.toFixed(1) : String(Math.round(miles));
    return `${rounded} miles away`;
  }
  if (typeof fallback === 'string' && fallback.trim()) return fallback;
  return 'Distance unknown';
}

function extractBrowseItems(data: unknown): unknown[] | null {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object' && Array.isArray((data as { items?: unknown }).items)) {
    return (data as { items: unknown[] }).items;
  }
  return null;
}

function mapBrowseItem(p: any): Profile {
  return {
    id: p.user_id,
    name: p.name || p.user?.name || 'Developer',
    age: p.age || 25,
    distance: formatDistanceKm(p.distance_km, p.distance),
    bio: p.bio || 'This developer hasn’t written a bio yet.',
    image: p.image || '/profile_3.png',
    interests: Array.isArray(p.interests) ? p.interests : [],
    score: typeof p.score === 'number' ? p.score : undefined,
    distanceKm: typeof p.distance_km === 'number' ? p.distance_km : null,
  };
}

function useIsCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(pointer: coarse)').matches;
  });
  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)');
    const onChange = () => setCoarse(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return coarse;
}

const SPRING_PRESS = { type: 'spring' as const, stiffness: 520, damping: 18 };
/** Spec: spring forward when stack reflows after a swipe. */
const SPRING_STACK = { type: 'spring' as const, stiffness: 300, damping: 30 };
const SPRING_PILL = { type: 'spring' as const, stiffness: 380, damping: 32 };

function stackAnimate(index: number, reducedMotion: boolean) {
  if (reducedMotion) {
    if (index === 0) return { scale: 1, y: 0, opacity: 1 };
    if (index === 1) return { scale: 0.97, y: 8, opacity: 0.5 };
    return { scale: 0.94, y: 14, opacity: 0.3 };
  }
  if (index === 0) return { scale: 1, y: 0, opacity: 1 };
  if (index === 1) return { scale: 0.94, y: 14, opacity: 0.55 };
  return { scale: 0.88, y: 26, opacity: 0.3 };
}

/** Photo plane with subtle pointer parallax (disabled on touch / reduced motion). */
const ParallaxPhoto: React.FC<{
  src: string;
  alt: string;
  enabled: boolean;
}> = ({ src, alt, enabled }) => {
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const rotateX = useSpring(rawY, { stiffness: 160, damping: 22 });
  const rotateY = useSpring(rawX, { stiffness: 160, damping: 22 });

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!enabled) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    rawX.set(px * 5);
    rawY.set(-py * 4.5);
  };

  const onLeave = () => {
    rawX.set(0);
    rawY.set(0);
  };

  return (
    <motion.div
      className="absolute inset-0"
      style={
        enabled
          ? { rotateX, rotateY, transformPerspective: 900 }
          : undefined
      }
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      <img
        src={src}
        alt=""
        draggable={false}
        className="absolute inset-0 w-full h-full object-cover scale-110 blur-xl opacity-50 select-none pointer-events-none"
      />
      <img
        src={src}
        alt={alt}
        draggable={false}
        className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
      />
    </motion.div>
  );
};

// ==========================================
export const DiscoveryPage: React.FC<DiscoveryPageProps> = ({ onLogout }) => {
  const reducedMotion = usePrefersReducedMotion();
  const coarsePointer = useIsCoarsePointer();
  const parallaxEnabled = !reducedMotion && !coarsePointer;
  const [activeTab, setActiveTab] = useState<ActivityTab>('discover');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readActivityBarCollapsed);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [discoverView, setDiscoverView] = useState<'deck' | 'browse'>('deck');

  const toggleSidebarCollapsed = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(ACTIVITY_BAR_COLLAPSED_KEY, next ? '1' : '0');
      } catch {
        /* ignore quota / private mode */
      }
      return next;
    });
  }, []);

  const [myProfile, setMyProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [projects, setProjects] = useState<any[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [projectStatuses, setProjectStatuses] = useState<Record<number, RequestStatus>>({});

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [history, setHistory] = useState<Profile[]>([]);
  const [likesCount, setLikesCount] = useState(0);
  const [loadingCandidates, setLoadingCandidates] = useState(true);
  /** Set when browse fetch fails or returns an unparseable body — never treat as empty. */
  const [candidatesError, setCandidatesError] = useState<string | null>(null);
  const [browseFilters, setBrowseFilters] = useState<string[]>([]);
  const [browseSort, setBrowseSort] = useState<'match' | 'newest' | 'nearby'>('match');
  const [selectedBrowseId, setSelectedBrowseId] = useState<number | null>(null);

  const [matches, setMatches] = useState<Match[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [matchBloomDone, setMatchBloomDone] = useState(false);
  const [matchModalData, setMatchModalData] = useState<{
    id: number;
    name: string;
    avatar: string;
  } | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [chatFocused, setChatFocused] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [showNewMsgPill, setShowNewMsgPill] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const stickToBottom = useRef(true);

  const [chatHistory, setChatHistory] = useState<Record<string | number, ChatMessage[]>>({});

  const dragX = useMotionValue(0);
  const dragY = useMotionValue(0);
  const rotate = useTransform(dragX, [-200, 200], [-15, 15]);
  const cardOpacity = useTransform(dragX, [-200, -150, 0, 150, 200], [0.6, 0.95, 1, 0.95, 0.6]);
  // MERGE / CLOSE stamp opacities from dragX
  const likeOpacity = useTransform(dragX, [0, 120], [0, 1]);
  const likeScale = useTransform(dragX, [0, 120], [0.8, 1]);
  const nopeOpacity = useTransform(dragX, [-120, 0], [1, 0]);
  const nopeScale = useTransform(dragX, [-120, 0], [1, 0.8]);
  const superLikeOpacity = useTransform(dragY, [-130, -60, 0], [1, 0, 0]);
  const superLikeScale = useTransform(dragY, [-130, -60], [1, 0.8]);

  const getInitials = (name: string) => {
    if (!name) return '??';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  // ------------------------------------------
  // DATA
  // ------------------------------------------
  const fetchProfile = async () => {
    try {
      setLoadingProfile(true);
      const res = await fetch('http://localhost:8080/api/v1/profiles/me', { credentials: 'include' });
      if (res.ok) setMyProfile(await res.json());
    } catch (err) {
      console.error('Failed to fetch profile', err);
    } finally {
      setLoadingProfile(false);
    }
  };

  const fetchProjects = async () => {
    try {
      setLoadingProjects(true);
      const res = await fetch('http://localhost:8080/api/v1/projects', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
        setProjectStatuses((prev) => {
          const next = { ...prev };
          for (const p of data) {
            if (!next[p.id]) next[p.id] = 'pending';
          }
          return next;
        });
      }
    } catch (err) {
      console.error('Failed to fetch projects', err);
    } finally {
      setLoadingProjects(false);
    }
  };

  const fetchCandidates = useCallback(async () => {
    try {
      setLoadingCandidates(true);
      setCandidatesError(null);

      // Tags stay client-side for snappy chip toggles; sort/limit match the browse contract.
      const sortParam =
        browseSort === 'newest' ? 'newest' : browseSort === 'nearby' ? 'nearby' : 'best';
      const params = new URLSearchParams({ sort: sortParam, limit: '50' });

      const res = await fetch(
        `http://localhost:8080/api/v1/matcher/browse?${params.toString()}`,
        { credentials: 'include' }
      );

      if (!res.ok) {
        setProfiles([]);
        setCandidatesError("Couldn't load candidates. Try again.");
        return;
      }

      let data: unknown;
      try {
        data = await res.json();
      } catch {
        setProfiles([]);
        setCandidatesError("Couldn't load candidates. Try again.");
        return;
      }

      const items = extractBrowseItems(data);
      if (!items) {
        setProfiles([]);
        setCandidatesError("Couldn't load candidates. Try again.");
        return;
      }

      setProfiles(items.map(mapBrowseItem));
      setCandidatesError(null);
    } catch (err) {
      console.error('Failed to fetch candidate profiles', err);
      setProfiles([]);
      setCandidatesError("Couldn't load candidates. Try again.");
    } finally {
      setLoadingCandidates(false);
    }
  }, [browseSort]);

  const fetchMatches = async () => {
    try {
      setLoadingMatches(true);
      const res = await fetch('http://localhost:8080/api/v1/matcher/matches', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setMatches(
          data.map((m: any) => ({
            id: m.matched_user_id,
            name: m.matched_user_name,
            avatar: m.image || '/profile_3.png',
            lastMessage: 'You matched — say hi',
            time: new Date(m.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            }),
            unread: false,
          }))
        );
      }
    } catch (err) {
      console.error('Failed to fetch matches', err);
    } finally {
      setLoadingMatches(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    fetchMatches();
  }, []);

  // Deep-link: `#/project-help`, `#/project-help/new`, `#/project-help/:id`
  useEffect(() => {
    const syncTabFromHash = () => {
      if (isProjectHelpHash()) setActiveTab('projectHelp');
    };
    syncTabFromHash();
    window.addEventListener('hashchange', syncTabFromHash);
    return () => window.removeEventListener('hashchange', syncTabFromHash);
  }, []);

  const goToTab = (key: ActivityTab) => {
    setActiveTab(key);
    if (key !== 'projectHelp' && isProjectHelpHash()) {
      window.history.replaceState(
        null,
        '',
        window.location.pathname + window.location.search
      );
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setCommandPaletteOpen((open) => !open);
        return;
      }
      if (e.key === 'Escape' && commandPaletteOpen) {
        setCommandPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [commandPaletteOpen]);

  useEffect(() => {
    if (activeTab === 'projectHelp' || activeTab === 'profile') fetchProjects();
    else if (activeTab === 'discover') fetchCandidates();
    else if (activeTab === 'matches') fetchMatches();
  }, [activeTab, fetchCandidates]);

  const handleProjectOfferHelp = (proj: ProjectRequest, message: string) => {
    const projectHelpId = `project_help_${proj.id}`;
    const projectMatchItem: Match = {
      id: projectHelpId,
      name: proj.user_name || 'Anonymous',
      avatar: '/profile_3.png',
      lastMessage: message
        ? message.slice(0, 80)
        : `Help request: ${proj.title}`,
      time: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
      unread: true,
      type: 'project',
      projectTitle: proj.title,
      projectDesc: proj.description,
      projectTech: proj.tech_stack,
    };

    setMatches((prev) => {
      if (prev.some((m) => m.id === projectHelpId)) return prev;
      return [projectMatchItem, ...prev];
    });

    if (message) {
      const now = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
      setChatHistory((prev) => ({
        ...prev,
        [projectHelpId]: [
          ...(prev[projectHelpId] || []),
          { sender: 'me', text: message, time: now, read: true },
        ],
      }));
    }
    // Stay on Project Help detail — Matches is updated in the background.
  };

  // ------------------------------------------
  // SWIPE / MATCH
  // ------------------------------------------
  const removeTopCard = useCallback(() => {
    setProfiles((prev) => {
      if (prev.length === 0) return prev;
      const [swiped, ...rest] = prev;
      setHistory((h) => [...h, swiped]);
      return rest;
    });
    dragX.set(0);
    dragY.set(0);
  }, [dragX, dragY]);

  const flyOff = useCallback(
    async (vx: number, vy: number, dir: 'left' | 'right' | 'up') => {
      const targetX =
        dir === 'up' ? dragX.get() + vx * 0.08 : dir === 'right' ? Math.max(480, Math.abs(vx) * 0.35) : -Math.max(480, Math.abs(vx) * 0.35);
      const targetY = dir === 'up' ? -Math.max(520, Math.abs(vy) * 0.4) : dragY.get() + vy * 0.12;

      if (reducedMotion) {
        removeTopCard();
        return;
      }

      await Promise.all([
        animate(dragX, targetX, { type: 'tween', duration: 0.28, ease: EASE }),
        animate(dragY, targetY, { type: 'tween', duration: 0.28, ease: EASE }),
      ]);
      removeTopCard();
    },
    [dragX, dragY, reducedMotion, removeTopCard]
  );

  const postSwipe = async (targetUserId: number, action: 'LIKE' | 'PASS' | 'SUPERLIKE') => {
    try {
      const res = await fetch('http://localhost:8080/api/v1/matcher/swipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ swiped_id: targetUserId, action }),
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.is_match) {
          const matchedProfile = profiles.find((p) => p.id === targetUserId);
          setMatchModalData({
            id: targetUserId,
            name: matchedProfile?.name || 'Developer',
            avatar: matchedProfile?.image || '/profile_3.png',
          });
          setMatchBloomDone(false);
          setShowMatchModal(true);
          fetchMatches();
        }
      }
    } catch (err) {
      console.error('Failed to post swipe', err);
    }
  };

  const handleSendMessageFromModal = () => {
    if (matchModalData) {
      const targetUserId = matchModalData.id;
      const existingMatch = matches.find((m) => m.id === targetUserId);
      const matchObj =
        existingMatch ||
        ({
          id: targetUserId,
          name: matchModalData.name,
          avatar: matchModalData.avatar,
          lastMessage: 'You matched — say hi',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          unread: false,
        } as Match);
      if (!existingMatch) setMatches((prev) => [matchObj, ...prev]);
      setSelectedMatch(matchObj);
      setActiveTab('matches');
    }
    setShowMatchModal(false);
    setMatchBloomDone(false);
  };

  const handleLike = (userId: number, vx = 800, vy = 0) => {
    postSwipe(userId, 'LIKE');
    setLikesCount((prev) => prev + 1);
    flyOff(vx, vy, 'right');
  };

  const handlePass = (userId: number, vx = -800, vy = 0) => {
    postSwipe(userId, 'PASS');
    flyOff(vx, vy, 'left');
  };

  const handleSuperLike = (userId: number, vx = 0, vy = -900) => {
    postSwipe(userId, 'SUPERLIKE');
    flyOff(vx, vy, 'up');
  };

  /** Browse quick-actions: same swipe API, remove the tapped card (no deck fling). */
  const handleBrowseAction = (userId: number, action: 'LIKE' | 'PASS') => {
    if (action === 'LIKE') {
      postSwipe(userId, 'LIKE');
      setLikesCount((prev) => prev + 1);
    } else {
      postSwipe(userId, 'PASS');
    }
    const removed = profiles.find((p) => p.id === userId);
    if (removed) setHistory((h) => [...h, removed]);
    setProfiles((prev) => prev.filter((p) => p.id !== userId));
    if (selectedBrowseId === userId) setSelectedBrowseId(null);
  };

  const handleRewind = () => {
    if (history.length === 0) return;
    const prevHistory = [...history];
    const lastSwiped = prevHistory.pop()!;
    setHistory(prevHistory);
    setProfiles([lastSwiped, ...profiles]);
  };

  const handleDragEnd = (_event: unknown, info: { offset: { x: number; y: number }; velocity: { x: number; y: number } }) => {
    if (!profiles[0]) return;
    const { offset, velocity } = info;
    const throwRight = offset.x > 120 || velocity.x > 600;
    const throwLeft = offset.x < -120 || velocity.x < -600;
    const throwUp = offset.y < -100 || velocity.y < -700;

    if (throwRight) handleLike(profiles[0].id, velocity.x, velocity.y);
    else if (throwLeft) handlePass(profiles[0].id, velocity.x, velocity.y);
    else if (throwUp) handleSuperLike(profiles[0].id, velocity.x, velocity.y);
    else {
      animate(dragX, 0, { type: 'spring', stiffness: 400, damping: 32 });
      animate(dragY, 0, { type: 'spring', stiffness: 400, damping: 32 });
    }
  };

  // ------------------------------------------
  // CHAT
  // ------------------------------------------
  const getInitialMessagesForMatch = (match: Match): ChatMessage[] => {
    if (match.type === 'project') {
      return [
        {
          sender: 'them',
          text: `[SYSTEM: PROJECT BRIEF]\nProject: ${match.projectTitle}\nStack: ${match.projectTech?.join(', ') || 'None'}\n\nDescription: ${match.projectDesc}`,
          time: match.time,
        },
        {
          sender: 'them',
          text: `Hey — thanks for offering to help with “${match.projectTitle}”. Happy to walk you through where I’m stuck.`,
          time: match.time,
        },
      ];
    }
    return [];
  };

  const currentMessages = selectedMatch
    ? chatHistory[selectedMatch.id] || getInitialMessagesForMatch(selectedMatch)
    : [];

  const onChatScroll = () => {
    const el = chatScrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    stickToBottom.current = nearBottom;
    if (nearBottom) setShowNewMsgPill(false);
  };

  const scrollChatToBottom = () => {
    const el = chatScrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: reducedMotion ? 'auto' : 'smooth' });
    stickToBottom.current = true;
    setShowNewMsgPill(false);
  };

  useEffect(() => {
    if (!selectedMatch) return;
    if (stickToBottom.current) scrollChatToBottom();
    else if (currentMessages.length > 0) setShowNewMsgPill(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMessages.length, selectedMatch?.id]);

  const handleSendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !selectedMatch) return;

    const newMsg: ChatMessage = {
      sender: 'me',
      text: chatInput,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      read: false,
    };

    setChatHistory((prev) => {
      const matchId = selectedMatch.id;
      const log = prev[matchId] || getInitialMessagesForMatch(selectedMatch);
      return { ...prev, [matchId]: [...log, newMsg] };
    });
    setChatInput('');
    stickToBottom.current = true;

    setIsTyping(true);
    setTimeout(() => {
      let replyText = 'Sounds good — let me take a look and get back to you.';
      if (selectedMatch.type === 'project') {
        const titleLower = (selectedMatch.projectTitle || '').toLowerCase();
        const techStr = (selectedMatch.projectTech || []).map((t) => t.toLowerCase()).join(' ');
        if (
          titleLower.includes('websocket') ||
          techStr.includes('websocket') ||
          titleLower.includes('scale')
        ) {
          replyText =
            'Thanks for reaching out! For scaling WebSockets we were considering a Redis pub/sub backplane. What do you think?';
        } else if (techStr.includes('react') || techStr.includes('next.js')) {
          replyText =
            'Hey, thanks for offering to help. I’m hitting performance bottlenecks during state updates — have you worked with concurrent rendering?';
        } else if (techStr.includes('python') || techStr.includes('fastapi')) {
          replyText =
            'Appreciate it! We’re running into database connection limits under load with FastAPI. Any suggestions on tuning the pool?';
        } else {
          replyText = `Thanks for helping out! Which part of ${selectedMatch.projectTech?.join(', ') || 'the stack'} do you know best?`;
        }
      }

      const replyMsg: ChatMessage = {
        sender: 'them',
        text: replyText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setIsTyping(false);
      setChatHistory((prev) => {
        const matchId = selectedMatch.id;
        const log = (prev[matchId] || getInitialMessagesForMatch(selectedMatch)).map((m) =>
          m.sender === 'me' ? { ...m, read: true } : m
        );
        return { ...prev, [matchId]: [...log, replyMsg] };
      });
      setMatches((prev) =>
        prev.map((m) => (m.id === selectedMatch.id ? { ...m, lastMessage: replyText } : m))
      );
    }, 1500);
  };

  // ------------------------------------------
  // BROWSE FILTERS
  // ------------------------------------------
  /** Fixed discover chips + any extra tags from the loaded pool (capped). */
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

  const browseScore = (p: Profile) =>
    typeof p.score === 'number' ? p.score : scoreCompatibility(p, myProfile);

  // Server already applies tags + sort; keep a light client pass for responsiveness / legacy shapes.
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
      list.sort((a, b) => browseScore(b) - browseScore(a));
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

  const toggleFilter = (chip: string) => {
    setBrowseFilters((prev) =>
      prev.includes(chip) ? prev.filter((c) => c !== chip) : [...prev, chip]
    );
  };

  const activeProfile = profiles[0];
  const selectedBrowse = profiles.find((p) => p.id === selectedBrowseId) || null;

  const navItems = [
    { key: 'discover' as const, label: 'Discover', icon: Compass, path: '~/zinder/discover' },
    { key: 'matches' as const, label: 'Matches', icon: MessageCircle, path: '~/zinder/matches' },
    { key: 'projectHelp' as const, label: 'Project help', icon: Code2, path: '~/zinder/project-help' },
    { key: 'profile' as const, label: 'Profile', icon: User, path: '~/zinder/profile' },
  ];

  const breadcrumb = navItems.find((n) => n.key === activeTab)?.path ?? '~/zinder';

  return (
    <div
      className="app-shell"
      data-collapsed={sidebarCollapsed ? 'true' : 'false'}
    >
      {/* Absolute backdrop — must not participate in grid track sizing */}
      <GatewayNetwork />

      <ActivityBar
        collapsed={sidebarCollapsed}
        onToggleCollapsed={toggleSidebarCollapsed}
        navItems={navItems}
        activeTab={activeTab}
        onNavigate={goToTab}
        matchCount={matches.length}
        userName={myProfile?.user?.name}
        userEmail={myProfile?.user?.email}
        userInitials={myProfile?.user?.name ? getInitials(myProfile.user.name) : '··'}
        onLogout={onLogout}
        Avatar={Avatar}
      />

      <main className="main-content">
        <div className="breadcrumb-bar breadcrumb-strip px-4 md:px-8 pt-3 pb-1">
          <span className="select-none" aria-hidden>
            {breadcrumb}
          </span>
          <CommandPaletteHint onClick={() => setCommandPaletteOpen(true)} />
        </div>
        {/* ========== MATCH / PROFILE MATCHER ========== */}
        {activeTab === 'discover' && (
          <div className="flex-1 flex flex-col items-center px-4 pb-4 md:px-8 md:pb-8 w-full">
            <div className="w-full max-w-[960px] flex justify-between items-end mb-5 gap-3">
              <div>
                <h1 className="text-lg font-semibold tracking-tight text-fg">Discover</h1>
                <p className="text-[13px] text-fg-muted mt-0.5">
                  {discoverView === 'deck' ? 'Swipe to match' : 'Browse & filter candidates'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="mono-label hidden sm:inline">{likesCount} liked</span>
                <LayoutGroup>
                  <div className="glass relative flex p-0.5 rounded-xl">
                    {(
                      [
                        { key: 'deck' as const, label: 'Deck', icon: Layers },
                        { key: 'browse' as const, label: 'Browse', icon: LayoutGrid },
                      ] as const
                    ).map(({ key, label, icon: Icon }) => {
                      const active = discoverView === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setDiscoverView(key)}
                          aria-pressed={active}
                          className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-[10px] text-[12px] font-medium transition-colors duration-200 ${
                            active ? 'text-fg' : 'text-fg-muted'
                          }`}
                        >
                          {active && (
                            <motion.div
                              layoutId="discover-view-pill"
                              className="absolute inset-0 rounded-[10px] bg-white/10"
                              transition={reducedMotion ? { duration: 0 } : SPRING_PILL}
                            />
                          )}
                          <Icon className="relative z-10 w-3.5 h-3.5" />
                          <span className="relative z-10">{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </LayoutGroup>
              </div>
            </div>

            {/* ---- DECK (Match Screen) ---- */}
            {discoverView === 'deck' && (
              <div className="relative flex flex-col items-center w-full max-w-[640px]">
                {/* Atmosphere layer — wider than the card so blobs stay visible */}
                {!reducedMotion && (
                  <div className="pointer-events-none absolute inset-0 z-0 overflow-visible" aria-hidden>
                    <div className="discover-blob-a" />
                    <div className="discover-blob-b" />
                  </div>
                )}

                {/* Extra bottom space so scaled/peeking cards aren't clipped */}
                <div className="relative z-[1] w-full max-w-[380px] aspect-[3/4.2] mb-8 overflow-visible">
                  {loadingCandidates && profiles.length === 0 ? (
                    <div className="absolute inset-0 glass rounded-[18px] flex items-center justify-center z-[3]">
                      <Spinner label="loading candidates" />
                    </div>
                  ) : candidatesError ? (
                    <div className="absolute inset-0 glass rounded-[18px] flex flex-col items-center justify-center p-8 text-center z-[1]">
                      <h3 className="text-base font-semibold text-fg mb-1.5">Couldn’t load candidates</h3>
                      <p className="text-[13px] text-fg-muted max-w-[240px] leading-relaxed">
                        Something went wrong fetching the feed. Try again.
                      </p>
                      <button
                        type="button"
                        onClick={() => fetchCandidates()}
                        className="btn-ghost mt-6 px-4 py-2 rounded-[12px] text-[13px]"
                      >
                        Try again
                      </button>
                    </div>
                  ) : profiles.length === 0 ? (
                    <div className="absolute inset-0 glass rounded-[18px] flex flex-col items-center justify-center p-8 text-center z-[1]">
                      <div className="w-12 h-12 rounded-full bg-white/6 border border-white/12 flex items-center justify-center mb-5">
                        <Compass className="w-5 h-5 text-fg-subtle" />
                      </div>
                      <h3 className="text-base font-semibold text-fg mb-1.5">You’re all caught up</h3>
                      <p className="text-[13px] text-fg-muted max-w-[240px] leading-relaxed">
                        No more profiles to review right now. Check back soon.
                      </p>
                      <button
                        type="button"
                        onClick={() => fetchCandidates()}
                        className="btn-ghost mt-6 px-4 py-2 rounded-[12px] text-[13px]"
                      >
                        Check again
                      </button>
                    </div>
                  ) : (
                    <AnimatePresence mode="popLayout">
                      {profiles.slice(0, 3).map((profile, index) => {
                        const isTop = index === 0;
                        return (
                          <motion.div
                            key={profile.id}
                            layout
                            initial={false}
                            animate={
                              isTop
                                ? { scale: 1 }
                                : stackAnimate(index, reducedMotion)
                            }
                            exit={
                              reducedMotion
                                ? { opacity: 0 }
                                : { opacity: 0, scale: 0.92, transition: { duration: 0.2 } }
                            }
                            transition={SPRING_STACK}
                            drag={isTop && !reducedMotion}
                            dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                            dragElastic={0.65}
                            onDragEnd={isTop ? handleDragEnd : undefined}
                            style={
                              isTop
                                ? {
                                    x: dragX,
                                    y: dragY,
                                    rotate: reducedMotion ? 0 : rotate,
                                    opacity: cardOpacity,
                                    zIndex: 3,
                                    pointerEvents: 'auto',
                                  }
                                : {
                                    zIndex: index === 1 ? 2 : 1,
                                    pointerEvents: 'none',
                                  }
                            }
                            className={`absolute inset-0 rounded-[18px] overflow-hidden border border-white/12 origin-top ${
                              isTop
                                ? 'cursor-grab active:cursor-grabbing shadow-[0_20px_50px_-20px_rgba(0,0,0,0.55)]'
                                : 'shadow-[0_12px_32px_-18px_rgba(0,0,0,0.45)]'
                            }`}
                          >
                            {isTop ? (
                              <>
                                {/* MERGE — diff-green, 12deg, top-right */}
                                <motion.div
                                  style={{ opacity: likeOpacity, scale: likeScale }}
                                  className="absolute top-7 right-5 z-30 rotate-12 px-3.5 py-1.5 border-[2.5px] border-[#3FB950] text-[#3FB950] rounded-md font-mono font-bold text-xl tracking-[0.18em] uppercase pointer-events-none bg-transparent"
                                >
                                  Merge
                                </motion.div>
                                {/* CLOSE — diff-red, -12deg, top-left */}
                                <motion.div
                                  style={{ opacity: nopeOpacity, scale: nopeScale }}
                                  className="absolute top-7 left-5 z-30 -rotate-12 px-3.5 py-1.5 border-[2.5px] border-[#E5534B] text-[#E5534B] rounded-md font-mono font-bold text-xl tracking-[0.18em] uppercase pointer-events-none bg-transparent"
                                >
                                  Close
                                </motion.div>
                                <motion.div
                                  style={{ opacity: superLikeOpacity, scale: superLikeScale }}
                                  className="absolute top-1/3 left-1/2 z-30 -translate-x-1/2 px-4 py-1.5 border-[2.5px] border-[#E3B341] text-[#E3B341] rounded-md font-mono font-bold text-lg tracking-[0.18em] uppercase pointer-events-none whitespace-nowrap bg-transparent"
                                >
                                  Star
                                </motion.div>

                                <ParallaxPhoto
                                  src={profile.image}
                                  alt={profile.name}
                                  enabled={parallaxEnabled}
                                />

                                <div className="absolute top-3.5 right-3.5 flex items-center gap-1.5 px-2.5 py-1 rounded-full glass z-20">
                                  <span className="relative flex h-1.5 w-1.5">
                                    {!reducedMotion && (
                                      <span className="absolute inline-flex h-full w-full rounded-full bg-accent-brand opacity-60 animate-ping" />
                                    )}
                                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent-brand" />
                                  </span>
                                  <MapPin className="w-3 h-3 text-fg-muted" />
                                  <span className="mono-label !text-fg-muted">{profile.distance}</span>
                                </div>

                                <div
                                  className="absolute inset-x-0 bottom-0 z-20 p-5 pt-16"
                                  style={{
                                    background:
                                      'linear-gradient(to top, rgba(10,14,18,0.96) 0%, rgba(10,14,18,0.78) 35%, rgba(10,14,18,0.35) 65%, transparent 100%)',
                                  }}
                                >
                                  <div className="glass-raised p-5 rounded-[16px]">
                                    <div className="flex items-baseline gap-2">
                                      <h2 className="text-xl font-semibold tracking-tight text-fg">
                                        {profile.name}
                                      </h2>
                                      <span className="text-lg text-fg-muted font-normal">
                                        {profile.age}
                                      </span>
                                    </div>
                                    <p className="mt-2 text-[13px] text-fg-muted leading-relaxed line-clamp-3">
                                      {profile.bio}
                                    </p>
                                    {profile.interests.length > 0 && (
                                      <div className="mt-3.5 flex flex-wrap gap-1.5">
                                        {profile.interests.slice(0, 5).map((interest, idx) => (
                                          <span
                                            key={idx}
                                            className="px-2 py-0.5 rounded-md text-[11px] font-mono text-fg-muted bg-white/6 border border-white/12"
                                          >
                                            {interest}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </>
                            ) : (
                              <>
                                <img
                                  src={profile.image}
                                  alt=""
                                  draggable={false}
                                  className="absolute inset-0 w-full h-full object-cover select-none"
                                />
                                <div className="absolute inset-0 bg-bg-base/45" />
                              </>
                            )}
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  )}
                </div>

                {/* Action hierarchy: primary 64px / secondary 48px */}
                <div className="w-full max-w-[380px] flex justify-center items-center gap-5 mt-2 relative z-10">
                  <motion.button
                    type="button"
                    whileTap={reducedMotion ? undefined : { scale: 0.9 }}
                    transition={SPRING_PRESS}
                    onClick={handleRewind}
                    disabled={history.length === 0}
                    title="Undo last swipe"
                    style={{ width: 48, height: 48 }}
                    className="rounded-full border border-white/10 glass flex items-center justify-center text-fg-subtle opacity-70 hover:opacity-100 hover:text-fg-muted disabled:opacity-35 disabled:pointer-events-none transition-opacity duration-200"
                  >
                    <Undo2 className="w-4 h-4" />
                  </motion.button>
                  <motion.button
                    type="button"
                    whileTap={reducedMotion ? undefined : { scale: 0.9 }}
                    whileHover={
                      reducedMotion
                        ? undefined
                        : {
                            scale: 1.05,
                            boxShadow: '0 0 24px rgba(229, 83, 75, 0.55)',
                          }
                    }
                    transition={SPRING_PRESS}
                    onClick={() => activeProfile && handlePass(activeProfile.id)}
                    disabled={!activeProfile}
                    title="Close"
                    style={{ width: 64, height: 64 }}
                    className="rounded-full border border-[#E5534B]/50 glass flex items-center justify-center text-[#E5534B] hover:bg-[#E5534B]/10 disabled:opacity-35 disabled:pointer-events-none"
                  >
                    <CircleSlash className="w-6 h-6" strokeWidth={2.25} />
                  </motion.button>
                  <motion.button
                    type="button"
                    whileTap={reducedMotion ? undefined : { scale: 0.9 }}
                    transition={SPRING_PRESS}
                    onClick={() => activeProfile && handleSuperLike(activeProfile.id)}
                    disabled={!activeProfile}
                    title="Star"
                    style={{ width: 48, height: 48 }}
                    className="rounded-full border border-white/10 glass flex items-center justify-center text-[#E3B341] opacity-70 hover:opacity-100 hover:border-[#E3B341]/40 hover:bg-[#E3B341]/10 disabled:opacity-35 disabled:pointer-events-none transition-opacity duration-200"
                  >
                    <Star className="w-4 h-4" />
                  </motion.button>
                  <motion.button
                    type="button"
                    whileTap={reducedMotion ? undefined : { scale: 0.9 }}
                    whileHover={
                      reducedMotion
                        ? undefined
                        : {
                            scale: 1.05,
                            boxShadow: '0 0 24px rgba(63, 185, 80, 0.55)',
                          }
                    }
                    transition={SPRING_PRESS}
                    onClick={() => activeProfile && handleLike(activeProfile.id)}
                    disabled={!activeProfile}
                    title="Merge"
                    style={{ width: 64, height: 64 }}
                    className="rounded-full border border-[#3FB950]/50 glass flex items-center justify-center text-[#3FB950] hover:bg-[#3FB950]/10 disabled:opacity-35 disabled:pointer-events-none"
                  >
                    <GitMerge className="w-6 h-6" />
                  </motion.button>
                </div>
              </div>
            )}

            {/* ---- BROWSE (Profile Matcher) ---- */}
            {discoverView === 'browse' && (
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
                            onClick={() => toggleFilter(chip)}
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
                            onClick={() => setBrowseSort(key)}
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

                  {loadingCandidates && profiles.length === 0 ? (
                    <RequestSkeleton />
                  ) : candidatesError ? (
                    <div className="glass rounded-[18px] p-12 text-center">
                      <p className="text-sm text-fg-muted">{candidatesError}</p>
                      <button
                        type="button"
                        onClick={() => fetchCandidates()}
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
                          onClick={() => setBrowseFilters([])}
                          className="btn-ghost mt-4 px-4 py-2 rounded-[12px] text-[13px]"
                        >
                          Clear filters
                        </button>
                      )}
                    </div>
                  ) : (
                    /* One unified grid — featured = index 0 only; span via CSS classes */
                    <div className="browse-grid">
                      {filteredBrowse.map((p, idx) => {
                        const score = browseScore(p);
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
                              onClick={() => setSelectedBrowseId(p.id)}
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
                                  <div className="absolute top-3 right-3 z-10 pointer-events-auto">
                                    <CompatibilityRing
                                      score={score}
                                      size={52}
                                      layoutId={`compat-${p.id}`}
                                    />
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
                                  handleBrowseAction(p.id, 'PASS');
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
                                  handleBrowseAction(p.id, 'LIKE');
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

                  {/* Browse detail sheet */}
                  <AnimatePresence>
                    {selectedBrowse && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-bg-base/80 backdrop-blur-md"
                        onClick={() => setSelectedBrowseId(null)}
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
                              <CompatibilityRing
                              score={browseScore(selectedBrowse)}
                              size={52}
                              layoutId={`compat-${selectedBrowse.id}`}
                            />
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
                                handleLike(selectedBrowse.id);
                                setSelectedBrowseId(null);
                                setDiscoverView('deck');
                              }}
                              className="btn-primary flex-1 py-2.5 rounded-[12px] text-sm"
                            >
                              Merge
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedBrowseId(null)}
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
            )}

            {/* Match modal + Bloom */}
            <AnimatePresence>
              {showMatchModal && matchModalData && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg-base/85 backdrop-blur-md"
                >
                  <div className="relative w-full max-w-sm">
                    {!matchBloomDone ? (
                      <MatchBloom
                        myInitials={myProfile ? getInitials(myProfile.user.name) : 'ME'}
                        theirName={matchModalData.name}
                        theirAvatar={matchModalData.avatar}
                        onComplete={() => setMatchBloomDone(true)}
                      />
                    ) : (
                      <motion.div
                        initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.22, ease: EASE }}
                        className="glass-raised rounded-[18px] p-8 text-center"
                      >
                        <p className="mono-label mb-3">merged</p>
                        <h1 className="display-italic text-[28px] text-gradient-brand mb-2">
                          It’s a match
                        </h1>
                        <p className="text-sm text-fg-muted mb-8">
                          You and{' '}
                          <span className="text-fg font-medium">{matchModalData.name}</span> liked
                          each other.
                        </p>
                        <div className="flex flex-col gap-2.5">
                          <button
                            type="button"
                            onClick={handleSendMessageFromModal}
                            className="btn-primary w-full py-2.5 rounded-[12px] text-sm"
                          >
                            Send a message
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowMatchModal(false);
                              setMatchBloomDone(false);
                            }}
                            className="btn-ghost w-full py-2.5 rounded-[12px] text-sm"
                          >
                            Keep browsing
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ========== CHAT ========== */}
        {activeTab === 'matches' && (
          <div className="flex-1 flex min-h-0">
            <div
              className={`w-full md:w-[320px] md:border-r border-white/12 flex-col min-h-0 bg-bg-base/40 ${
                selectedMatch ? 'hidden md:flex' : 'flex'
              }`}
            >
              <div className="h-14 px-5 flex items-center justify-between border-b border-white/12 flex-shrink-0">
                <h2 className="text-[15px] font-semibold tracking-tight text-fg">Matches</h2>
                <span className="mono-label">{matches.length}</span>
              </div>

              <div className="flex-1 overflow-y-auto p-2.5 space-y-0.5">
                {loadingMatches ? (
                  <Spinner label="loading matches" />
                ) : matches.length > 0 ? (
                  <LayoutGroup id="active-match-list">
                    {matches.map((match) => {
                      const selected = selectedMatch?.id === match.id;
                      const online = isMatchOnline(match.id);
                      return (
                        <motion.button
                          key={match.id}
                          type="button"
                          onClick={() => {
                            setSelectedMatch(match);
                            setMatches(
                              matches.map((m) => (m.id === match.id ? { ...m, unread: false } : m))
                            );
                            stickToBottom.current = true;
                            setShowNewMsgPill(false);
                          }}
                          className={`group relative w-full flex items-center gap-3 p-2.5 pl-3.5 rounded-[12px] text-left transition-colors duration-150 ${
                            selected ? 'bg-white/[0.09]' : 'hover:bg-white/[0.06]'
                          }`}
                        >
                          {selected && (
                            <motion.div
                              layoutId="active-match-indicator"
                              className="absolute left-0 top-2 bottom-2 w-[4px] rounded-r-full bg-accent-brand"
                              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                            />
                          )}
                          <motion.div
                            className="w-full flex items-center gap-3 min-w-0"
                            whileHover={reducedMotion ? undefined : { x: 2 }}
                            transition={{ duration: 0.15, ease: EASE }}
                          >
                            <div className="relative flex-shrink-0">
                              <div className="w-10 h-10 rounded-full overflow-hidden border border-white/12">
                                <img
                                  src={match.avatar}
                                  alt={match.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              {online && <OnlinePresence reducedMotion={reducedMotion} />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-baseline gap-2">
                                <span
                                  className={`text-[13px] truncate flex items-center gap-1.5 ${
                                    match.unread
                                      ? 'font-semibold text-fg'
                                      : 'font-normal text-fg-muted'
                                  }`}
                                >
                                  {match.name}
                                  {match.unread && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-accent-brand flex-shrink-0" />
                                  )}
                                  {match.type === 'project' && (
                                    <span className="px-1.5 py-px rounded bg-white/8 text-fg-muted text-[10px] font-mono flex-shrink-0 font-normal">
                                      project
                                    </span>
                                  )}
                                </span>
                                <span className="mono-label flex-shrink-0">{match.time}</span>
                              </div>
                              <p
                                className={`text-xs truncate mt-0.5 ${
                                  match.unread ? 'text-fg-muted' : 'text-fg-subtle'
                                }`}
                              >
                                {match.lastMessage}
                              </p>
                            </div>
                          </motion.div>
                        </motion.button>
                      );
                    })}
                  </LayoutGroup>
                ) : (
                  <div className="text-center py-14 px-6">
                    <p className="text-[13px] text-fg-muted">No matches yet.</p>
                    <p className="text-xs text-fg-subtle mt-1">Like a few profiles to get started.</p>
                  </div>
                )}
              </div>
            </div>

            <div className={`flex-1 flex-col min-h-0 bg-bg-base/20 ${selectedMatch ? 'flex' : 'hidden md:flex'}`}>
              {selectedMatch ? (
                <>
                  <div className="h-14 px-4 md:px-5 border-b border-white/12 flex items-center justify-between flex-shrink-0 glass">
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        type="button"
                        onClick={() => setSelectedMatch(null)}
                        aria-label="Back to matches"
                        className="md:hidden p-1.5 -ml-1.5 rounded-md text-fg-subtle hover:text-fg transition-colors duration-200"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <div className="relative flex-shrink-0">
                        <div className="w-8 h-8 rounded-full overflow-hidden border border-white/12">
                          <img
                            src={selectedMatch.avatar}
                            alt={selectedMatch.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        {isMatchOnline(selectedMatch.id) && (
                          <OnlinePresence reducedMotion={reducedMotion} size="sm" tone="human" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h3 className="display text-[15px] text-fg truncate leading-tight flex items-center gap-1.5">
                          {selectedMatch.name}
                          {isMatchOnline(selectedMatch.id) && (
                            <span className="w-1.5 h-1.5 rounded-full bg-fg-muted" title="Online" />
                          )}
                        </h3>
                        {selectedMatch.type === 'project' && selectedMatch.projectTitle && (
                          <p className="text-[11px] text-fg-subtle truncate leading-tight mt-0.5">
                            {selectedMatch.projectTitle}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedMatch(null)}
                      aria-label="Close conversation"
                      className="hidden md:block p-1.5 rounded-md text-fg-subtle hover:text-fg hover:bg-white/5 transition-colors duration-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="relative flex-1 flex flex-col min-h-0">
                    <div
                      ref={chatScrollRef}
                      onScroll={onChatScroll}
                      className="flex-1 overflow-y-auto px-4 md:px-6 py-5 flex flex-col min-h-0"
                    >
                      {currentMessages.length === 0 ? (
                        <MatchEmptyChat
                          key={selectedMatch.id}
                          name={selectedMatch.name}
                          avatar={selectedMatch.avatar}
                          reducedMotion={reducedMotion}
                          onSuggest={(text) => {
                            setChatInput(text);
                            requestAnimationFrame(() => chatInputRef.current?.focus());
                          }}
                        />
                      ) : (
                        <div className="space-y-2.5">
                          <DateSeparator label="Today" />
                          <AnimatePresence initial={!reducedMotion}>
                            {currentMessages.map((msg, idx) => {
                              const isSystemBrief = msg.text.startsWith('[SYSTEM: PROJECT BRIEF]');
                              const enter = reducedMotion
                                ? false
                                : { opacity: 0, y: 8, scale: 0.95 };
                              const stagger = {
                                duration: reducedMotion ? 0 : 0.28,
                                delay: reducedMotion ? 0 : Math.min(idx, 8) * 0.06,
                                ease: EASE,
                              };

                              if (isSystemBrief) {
                                const titleLine = msg.text.split('\n')[1] || '';
                                const stackLine = msg.text.split('\n')[2] || '';
                                const descLines = msg.text.split('\n').slice(4).join('\n') || '';
                                return (
                                  <motion.div
                                    key={`${selectedMatch.id}-sys-${idx}`}
                                    initial={enter}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.98 }}
                                    transition={stagger}
                                    className="w-full flex justify-center py-2"
                                  >
                                    <div className="w-full max-w-md glass rounded-[16px] p-4 space-y-2.5">
                                      <div className="flex items-center justify-between border-b border-white/12 pb-2">
                                        <span className="text-[11px] text-fg-subtle">Project brief</span>
                                        <span className="text-[11px] text-fg-subtle">{msg.time}</span>
                                      </div>
                                      <h4 className="text-sm font-semibold text-fg">
                                        {titleLine.replace('Project: ', '')}
                                      </h4>
                                      <p className="text-[12px] text-fg-muted">{stackLine.replace('Stack: ', '')}</p>
                                      <p className="text-[13px] text-fg-muted leading-relaxed whitespace-pre-wrap">
                                        {descLines.replace('Description: ', '')}
                                      </p>
                                    </div>
                                  </motion.div>
                                );
                              }

                              const mine = msg.sender === 'me';
                              return (
                                <motion.div
                                  key={`${selectedMatch.id}-msg-${idx}`}
                                  initial={enter}
                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.98 }}
                                  transition={stagger}
                                  className={`group/bubble flex ${mine ? 'justify-end' : 'justify-start'}`}
                                >
                                  <div
                                    className={`max-w-[75%] px-3.5 py-2.5 text-sm leading-relaxed backdrop-blur-md border ${
                                      mine
                                        ? 'bg-white/[0.1] border-white/16 text-fg rounded-[20px] rounded-br-[4px]'
                                        : 'bg-white/[0.05] border-white/10 text-fg rounded-[20px] rounded-bl-[4px]'
                                    }`}
                                    style={
                                      mine
                                        ? { borderRadius: '20px 20px 4px 20px' }
                                        : { borderRadius: '20px 20px 20px 4px' }
                                    }
                                  >
                                    <p className="whitespace-pre-wrap">{msg.text}</p>
                                    <span
                                      className={`flex items-center justify-end gap-1 mt-1 text-[10px] text-fg-subtle transition-opacity duration-200 ${
                                        reducedMotion
                                          ? 'opacity-70'
                                          : 'opacity-0 group-hover/bubble:opacity-100'
                                      }`}
                                    >
                                      {msg.time}
                                      {mine && (
                                        <span className="inline-flex">
                                          {msg.read ? (
                                            <CheckCheck className="w-3 h-3" />
                                          ) : (
                                            <Check className="w-3 h-3" />
                                          )}
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                </motion.div>
                              );
                            })}
                          </AnimatePresence>

                          {isTyping && (
                            <motion.div
                              className="flex justify-start"
                              initial={reducedMotion ? false : { opacity: 0, y: 6, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              transition={{ duration: 0.22, ease: EASE }}
                            >
                              <div className="px-3 py-2.5 flex gap-1.5 items-center rounded-full bg-white/[0.06] border border-white/12 backdrop-blur-md">
                                {[0, 1, 2].map((i) => (
                                  <motion.span
                                    key={i}
                                    className="w-1.5 h-1.5 rounded-full bg-fg-muted"
                                    animate={
                                      reducedMotion ? { opacity: 0.55 } : { y: [0, -3.5, 0] }
                                    }
                                    transition={
                                      reducedMotion
                                        ? { duration: 0 }
                                        : {
                                            duration: 0.95,
                                            repeat: Infinity,
                                            delay: i * 0.1,
                                            ease: 'easeInOut',
                                          }
                                    }
                                  />
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </div>
                      )}
                    </div>

                    <AnimatePresence>
                      {showNewMsgPill && (
                        <motion.button
                          type="button"
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 8 }}
                          transition={{ duration: 0.18, ease: EASE }}
                          onClick={scrollChatToBottom}
                          className="absolute bottom-3 left-1/2 -translate-x-1/2 glass-raised px-3 py-1.5 rounded-full text-[12px] font-medium text-fg flex items-center gap-1.5 shadow-none"
                        >
                          <ArrowDown className="w-3 h-3 text-fg-muted" />
                          New message
                        </motion.button>
                      )}
                    </AnimatePresence>
                  </div>

                  <form
                    onSubmit={handleSendChatMessage}
                    className="p-3.5 border-t border-white/12 glass flex-shrink-0"
                  >
                    <div
                      className={`field flex items-center gap-2 pl-3.5 pr-1.5 py-1.5 transition-[box-shadow,border-color] duration-200 ${
                        chatFocused ? '!border-white/25 !shadow-[0_0_0_3px_rgba(230,237,243,0.06)]' : ''
                      }`}
                    >
                      <input
                        ref={chatInputRef}
                        type="text"
                        placeholder={`Message ${selectedMatch.name}`}
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onFocus={() => setChatFocused(true)}
                        onBlur={() => setChatFocused(false)}
                        className="flex-1 bg-transparent text-sm text-fg placeholder-fg-subtle focus:outline-none border-none"
                      />
                      <motion.button
                        type="submit"
                        disabled={!chatInput.trim()}
                        aria-label="Send message"
                        animate={
                          chatInput.trim()
                            ? {
                                scale: 1,
                                backgroundColor: 'rgba(185, 144, 255, 1)',
                                color: 'rgba(10, 14, 18, 1)',
                              }
                            : {
                                scale: 0.92,
                                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                                color: 'rgba(107, 115, 137, 1)',
                              }
                        }
                        transition={{ type: 'spring', stiffness: 520, damping: 28 }}
                        className="p-2 rounded-[10px] disabled:pointer-events-none"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </motion.button>
                    </div>
                  </form>
                </>
              ) : (
                <NoConversationOpen
                  matches={matches}
                  reducedMotion={reducedMotion}
                  onSelect={(match) => {
                    setSelectedMatch(match);
                    setMatches(
                      matches.map((m) => (m.id === match.id ? { ...m, unread: false } : m))
                    );
                    stickToBottom.current = true;
                    setShowNewMsgPill(false);
                  }}
                />
              )}
            </div>
          </div>
        )}

        {/* ========== PROFILE (own) ========== */}
        {activeTab === 'profile' && (
          <ProfilePage
            myProfile={myProfile}
            loadingProfile={loadingProfile}
            matches={matches}
            projects={projects}
            projectStatuses={projectStatuses}
            onLogout={onLogout}
            onRetry={fetchProfile}
            onSaved={fetchProfile}
            getInitials={getInitials}
          />
        )}

        {/* ========== PROJECT HELP (multi-page hub) ========== */}
        {activeTab === 'projectHelp' && (
          <ProjectHelpHub
            myProfile={myProfile}
            projects={projects}
            loadingProjects={loadingProjects}
            projectStatuses={projectStatuses}
            setProjectStatuses={setProjectStatuses}
            onRefreshProjects={fetchProjects}
            onOfferHelp={handleProjectOfferHelp}
            onViewOwnProfile={() => goToTab('profile')}
          />
        )}
      </main>

      <nav className="mobile-tab-bar" aria-label="Primary">
        {navItems.map(({ key, label, icon: Icon }) => {
          const active = activeTab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => goToTab(key)}
              className={`relative flex flex-col items-center justify-center gap-1 px-3 py-1 text-[10px] font-medium transition-colors duration-200 ${
                active ? 'text-accent-brand' : 'text-fg-subtle'
              }`}
            >
              <Icon className="w-5 h-5" strokeWidth={active ? 2.25 : 1.75} />
              <span className="font-mono tracking-wide">{label}</span>
              {key === 'matches' && matches.length > 0 && (
                <span className="absolute -top-0.5 right-1 nav-count-chip !min-w-[1rem] !h-4 !text-[9px]">
                  {matches.length}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onNavigateTab={goToTab}
        onOpenMatch={(m) => {
          const full = matches.find((x) => x.id === m.id);
          if (full) setSelectedMatch(full);
          goToTab('matches');
        }}
        onOpenProject={(p) => {
          window.location.hash = projectHelpHash('detail', p.id);
          goToTab('projectHelp');
        }}
        matches={matches.map((m) => ({ id: m.id, name: m.name }))}
        projects={projects.map((p) => ({ id: p.id, title: p.title }))}
        reducedMotion={reducedMotion}
      />
    </div>
  );
};