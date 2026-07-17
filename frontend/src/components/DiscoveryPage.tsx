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
  Heart,
  X,
  Undo2,
  Star,
  MessageCircle,
  User,
  Compass,
  LogOut,
  Code2,
  Send,
  Loader2,
  ChevronLeft,
  ChevronRight,
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
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

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
}

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
  if (mine.size === 0) return 42 + (candidate.id % 30);
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
    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono tracking-wide text-fg-subtle bg-white/6 border border-white/10">
      {label}
    </span>
  </div>
);

const OnlinePresence: React.FC<{ reducedMotion: boolean; size?: 'sm' | 'md' }> = ({
  reducedMotion,
  size = 'md',
}) => {
  const dot = size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5';
  return (
    <span className={`absolute bottom-0 right-0 ${dot} flex items-center justify-center`}>
      {!reducedMotion && (
        <motion.span
          className="absolute inset-0 rounded-full bg-accent-cool/55"
          animate={{ scale: [1, 1.75], opacity: [0.55, 0] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }}
        />
      )}
      <span className={`relative ${dot} rounded-full bg-accent-cool border-[1.5px] border-bg-base`} />
    </span>
  );
};

const MatchEmptyChat: React.FC<{
  name: string;
  avatar: string;
  reducedMotion: boolean;
  onSuggest: (text: string) => void;
}> = ({ name, avatar, reducedMotion, onSuggest }) => (
  <div className="h-full flex flex-col items-center justify-center text-center px-4">
    <div className="relative mb-5 flex items-center justify-center">
      {[0, 1].map((i) => (
        <motion.div
          key={i}
          className="absolute rounded-full border border-accent-cool/35 pointer-events-none"
          style={{ width: 64 + i * 28, height: 64 + i * 28 }}
          initial={false}
          animate={
            reducedMotion
              ? { opacity: 0.22, scale: 1 }
              : { scale: [1, 1.55], opacity: [0.4, 0] }
          }
          transition={
            reducedMotion
              ? { duration: 0 }
              : {
                  duration: 2.6,
                  repeat: Infinity,
                  delay: i * 0.75,
                  ease: 'easeOut',
                }
          }
        />
      ))}
      <div className="relative z-10 w-14 h-14 rounded-full overflow-hidden border border-white/14 shadow-[0_0_0_1px_rgba(94,234,212,0.12)]">
        <img src={avatar} alt={name} className="w-full h-full object-cover" />
      </div>
    </div>

    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: reducedMotion ? 0 : 0.55, duration: 0.4, ease: EASE }}
      className="space-y-1"
    >
      <p className="text-[13px] text-fg-muted">
        You matched with <span className="text-fg font-medium">{name}</span>
      </p>
      <p className="text-xs text-fg-subtle">Say hi and start the conversation.</p>
    </motion.div>

    <div className="mt-5 flex flex-wrap items-center justify-center gap-2 max-w-[320px]">
      {CHAT_STARTERS.map((label, i) => (
        <motion.button
          key={label}
          type="button"
          onClick={() => onSuggest(label)}
          initial={reducedMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: reducedMotion ? 0 : 0.75 + i * 0.1,
            duration: reducedMotion ? 0 : 0.35,
            ease: EASE,
          }}
          className="px-3 py-1.5 rounded-full text-[12px] text-fg-muted bg-white/6 border border-white/12 hover:bg-white/10 hover:text-fg hover:border-accent-warm/30 transition-colors duration-200"
        >
          <motion.span
            className="inline-block"
            animate={reducedMotion ? undefined : { y: [0, -3, 0] }}
            transition={
              reducedMotion
                ? { duration: 0 }
                : {
                    delay: 1.15 + i * 0.4,
                    duration: 3.4 + i * 0.45,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }
            }
          >
            {label}
          </motion.span>
        </motion.button>
      ))}
    </div>
  </div>
);

function parseDistanceMiles(distance: string): number {
  const n = parseFloat(distance.replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : 99;
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
const SPRING_STACK = { type: 'spring' as const, stiffness: 320, damping: 28 };
const SPRING_PILL = { type: 'spring' as const, stiffness: 380, damping: 32 };

/** Peeking stack card (non-interactive) behind the active deck card. */
const StackPeekCard: React.FC<{ profile: Profile; stackPos: number; reducedMotion: boolean }> = ({
  profile,
  stackPos,
  reducedMotion,
}) => {
  const scale = stackPos === 1 ? 0.95 : 0.9;
  const y = stackPos === 1 ? 12 : 24;
  const opacity = stackPos === 1 ? 0.6 : 0.35;

  return (
    <motion.div
      className="absolute inset-0 rounded-[18px] overflow-hidden border border-white/10 pointer-events-none"
      style={{ zIndex: 10 - stackPos }}
      initial={false}
      animate={
        reducedMotion
          ? { scale: 1, y: 0, opacity: 0.45 }
          : { scale, y, opacity }
      }
      transition={reducedMotion ? { duration: 0 } : SPRING_STACK}
    >
      <img
        src={profile.image}
        alt=""
        draggable={false}
        className="w-full h-full object-cover select-none"
      />
      <div className="absolute inset-0 bg-bg-base/40" />
    </motion.div>
  );
};

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
  const [activeTab, setActiveTab] = useState<'discover' | 'matches' | 'profile' | 'projectHelp'>(
    'discover'
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [discoverView, setDiscoverView] = useState<'deck' | 'browse'>('deck');

  const [myProfile, setMyProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [projects, setProjects] = useState<any[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [projectStatuses, setProjectStatuses] = useState<Record<number, RequestStatus>>({});

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [history, setHistory] = useState<Profile[]>([]);
  const [likesCount, setLikesCount] = useState(0);
  const [loadingCandidates, setLoadingCandidates] = useState(true);
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
  const likeOpacity = useTransform(dragX, [0, 60, 130], [0, 0, 1]);
  const likeScale = useTransform(dragX, [60, 130], [0.75, 1]);
  const nopeOpacity = useTransform(dragX, [-130, -60, 0], [1, 0, 0]);
  const nopeScale = useTransform(dragX, [-130, -60], [1, 0.75]);
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

  const fetchCandidates = async () => {
    try {
      setLoadingCandidates(true);
      const res = await fetch('http://localhost:8080/api/v1/matcher/browse', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setProfiles(
          data.map((p: any) => ({
            id: p.user_id,
            name: p.user?.name || 'Developer',
            age: p.age || 25,
            distance: p.distance || '1 mile away',
            bio: p.bio || 'This developer hasn’t written a bio yet.',
            image: p.image || '/profile_3.png',
            interests: p.interests || [],
          }))
        );
      }
    } catch (err) {
      console.error('Failed to fetch candidate profiles', err);
    } finally {
      setLoadingCandidates(false);
    }
  };

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

  useEffect(() => {
    if (activeTab === 'projectHelp' || activeTab === 'profile') fetchProjects();
    else if (activeTab === 'discover') fetchCandidates();
    else if (activeTab === 'matches') fetchMatches();
  }, [activeTab]);

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
  const allInterestChips = useMemo(() => {
    const set = new Set<string>();
    profiles.forEach((p) => p.interests.forEach((i) => set.add(i)));
    (myProfile?.interests || []).forEach((i: string) => set.add(i));
    return Array.from(set).slice(0, 12);
  }, [profiles, myProfile]);

  const filteredBrowse = useMemo(() => {
    let list =
      browseFilters.length === 0
        ? [...profiles]
        : profiles.filter((p) =>
            browseFilters.every((f) =>
              p.interests.some((i) => i.toLowerCase() === f.toLowerCase())
            )
          );

    if (browseSort === 'match') {
      list.sort(
        (a, b) => scoreCompatibility(b, myProfile) - scoreCompatibility(a, myProfile)
      );
    } else if (browseSort === 'nearby') {
      list.sort((a, b) => parseDistanceMiles(a.distance) - parseDistanceMiles(b.distance));
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
    { key: 'discover' as const, label: 'Discover', icon: Compass },
    { key: 'matches' as const, label: 'Matches', icon: MessageCircle },
    { key: 'projectHelp' as const, label: 'Project help', icon: Code2 },
    { key: 'profile' as const, label: 'Profile', icon: User },
  ];

  const hasUnread = matches.some((m) => m.unread);

  const actionPress = reducedMotion
    ? {}
    : { whileTap: { scale: 0.9 }, transition: SPRING_PRESS };

  return (
    <div className="relative min-h-screen w-full flex bg-bg-base text-fg overflow-hidden">
      <GatewayNetwork />

      {/* SIDEBAR */}
      <aside
        className={`hidden md:flex flex-col h-screen sticky top-0 border-r border-white/12 bg-bg-base/70 backdrop-blur-[20px] transition-[width] duration-200 z-20 ${
          sidebarCollapsed ? 'w-[64px]' : 'w-60'
        }`}
      >
        <div
          className={`h-14 flex items-center border-b border-white/12 ${
            sidebarCollapsed ? 'justify-center px-0' : 'justify-between px-4'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="brand-mark w-7 h-7 rounded-[10px] flex items-center justify-center flex-shrink-0">
              <span className="text-[13px] font-bold text-bg-base leading-none select-none">Z</span>
            </div>
            {!sidebarCollapsed && (
              <span className="font-semibold text-[15px] tracking-tight text-fg truncate">Zinder</span>
            )}
          </div>
          {!sidebarCollapsed && (
            <button
              type="button"
              onClick={() => setSidebarCollapsed(true)}
              aria-label="Collapse sidebar"
              className="p-1 rounded-md text-fg-subtle hover:text-fg-muted hover:bg-white/5 transition-colors duration-200"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {sidebarCollapsed && (
          <button
            type="button"
            onClick={() => setSidebarCollapsed(false)}
            aria-label="Expand sidebar"
            className="mx-auto mt-3 p-1.5 rounded-md text-fg-subtle hover:text-fg-muted hover:bg-white/5 transition-colors duration-200"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}

        <nav className="flex-1 px-2.5 py-4 space-y-0.5">
          {navItems.map(({ key, label, icon: Icon }) => {
            const active = activeTab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                title={sidebarCollapsed ? label : undefined}
                className={`w-full flex items-center gap-2.5 rounded-[10px] text-[13px] font-medium transition-colors duration-200 relative h-9 ${
                  sidebarCollapsed ? 'justify-center px-0' : 'px-3'
                } ${active ? 'bg-white/10 text-fg' : 'text-fg-muted hover:text-fg hover:bg-white/5'}`}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-accent-warm' : ''}`} />
                {!sidebarCollapsed && <span className="truncate">{label}</span>}
                {key === 'matches' && hasUnread && (
                  <span
                    className={`absolute w-1.5 h-1.5 rounded-full bg-accent-cool ${
                      sidebarCollapsed ? 'top-1.5 right-1.5' : 'right-3 top-1/2 -translate-y-1/2'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-white/12 p-3">
          <div className={`flex items-center gap-2.5 ${sidebarCollapsed ? 'justify-center' : ''}`}>
            <Avatar initials={myProfile ? getInitials(myProfile.user.name) : '··'} size="w-8 h-8 text-[11px]" />
            {!sidebarCollapsed && (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-fg truncate leading-tight">
                    {myProfile ? myProfile.user.name : 'Loading…'}
                  </p>
                  <p className="text-[11px] text-fg-subtle truncate leading-tight mt-0.5">
                    {myProfile ? myProfile.user.email : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onLogout}
                  title="Sign out"
                  className="p-1.5 rounded-md text-fg-subtle hover:text-danger hover:bg-danger/10 transition-colors duration-200 flex-shrink-0"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* MOBILE NAV */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-bg-base/85 backdrop-blur-[20px] border-t border-white/12 flex justify-around items-center z-30 px-2">
        {navItems.map(({ key, label, icon: Icon }) => {
          const active = activeTab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`relative flex flex-col items-center justify-center gap-1 px-3 py-1 text-[10px] font-medium transition-colors duration-200 ${
                active ? 'text-accent-warm' : 'text-fg-subtle'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{label}</span>
              {key === 'matches' && hasUnread && (
                <span className="absolute top-0.5 right-2 w-1.5 h-1.5 rounded-full bg-accent-cool" />
              )}
            </button>
          );
        })}
      </nav>

      <main className="flex-1 flex flex-col min-h-screen pb-16 md:pb-0 z-10 overflow-y-auto">
        {/* ========== MATCH / PROFILE MATCHER ========== */}
        {activeTab === 'discover' && (
          <div className="flex-1 flex flex-col items-center p-4 md:p-8 w-full">
            <div className="w-full max-w-[720px] flex justify-between items-end mb-5 gap-3">
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
              <div className="flex flex-col items-center w-full">
                <div className="relative w-full max-w-[380px] aspect-[3/4.2]">
                  {/* Ambient drifting blobs */}
                  {!reducedMotion && (
                    <>
                      <motion.div
                        aria-hidden
                        className="absolute -top-24 -left-28 w-[280px] h-[280px] rounded-full pointer-events-none"
                        style={{
                          background:
                            'radial-gradient(circle, rgba(232,166,89,0.08) 0%, transparent 70%)',
                        }}
                        animate={{ x: [0, 28, -12, 0], y: [0, 18, -14, 0] }}
                        transition={{ duration: 24, repeat: Infinity, ease: 'linear' }}
                      />
                      <motion.div
                        aria-hidden
                        className="absolute -bottom-28 -right-24 w-[300px] h-[300px] rounded-full pointer-events-none"
                        style={{
                          background:
                            'radial-gradient(circle, rgba(94,234,212,0.06) 0%, transparent 70%)',
                        }}
                        animate={{ x: [0, -22, 16, 0], y: [0, -16, 12, 0] }}
                        transition={{ duration: 28, repeat: Infinity, ease: 'linear' }}
                      />
                    </>
                  )}

                  <AnimatePresence>
                    {loadingCandidates ? (
                      <motion.div
                        key="loading-candidates"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 glass rounded-[18px] flex items-center justify-center z-20"
                      >
                        <Spinner label="loading candidates" />
                      </motion.div>
                    ) : activeProfile ? (
                      <>
                        {/* Peeking stack behind active card */}
                        {profiles.slice(1, 3).map((p, i) => (
                          <StackPeekCard
                            key={p.id}
                            profile={p}
                            stackPos={i + 1}
                            reducedMotion={reducedMotion}
                          />
                        ))}

                        <motion.div
                          key={activeProfile.id}
                          drag={!reducedMotion}
                          dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                          dragElastic={0.65}
                          onDragEnd={handleDragEnd}
                          style={{
                            x: dragX,
                            y: dragY,
                            rotate: reducedMotion ? 0 : rotate,
                            opacity: cardOpacity,
                            zIndex: 20,
                          }}
                          initial={false}
                          animate={
                            reducedMotion
                              ? { scale: 1, y: 0 }
                              : { scale: 1, y: 0 }
                          }
                          transition={SPRING_STACK}
                          className="absolute inset-0 rounded-[18px] overflow-hidden cursor-grab active:cursor-grabbing flex flex-col border border-white/12 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.55)]"
                        >
                          {/* LIKE stamp — amber, top-right */}
                          <motion.div
                            style={{ opacity: likeOpacity, scale: likeScale }}
                            className="absolute top-7 right-5 rotate-12 px-3.5 py-1.5 border-[2.5px] border-accent-warm text-accent-warm rounded-md font-bold text-xl tracking-[0.2em] uppercase z-30 pointer-events-none origin-center"
                          >
                            Like
                          </motion.div>
                          {/* NOPE stamp — coral, top-left */}
                          <motion.div
                            style={{ opacity: nopeOpacity, scale: nopeScale }}
                            className="absolute top-7 left-5 -rotate-12 px-3.5 py-1.5 border-[2.5px] border-danger text-danger rounded-md font-bold text-xl tracking-[0.2em] uppercase z-30 pointer-events-none origin-center"
                          >
                            Nope
                          </motion.div>
                          <motion.div
                            style={{ opacity: superLikeOpacity, scale: superLikeScale }}
                            className="absolute top-1/3 left-1/2 -translate-x-1/2 px-4 py-1.5 border-[2.5px] border-accent-cool text-accent-cool rounded-md font-bold text-lg tracking-[0.18em] uppercase z-30 pointer-events-none whitespace-nowrap"
                          >
                            Super
                          </motion.div>

                          <ParallaxPhoto
                            src={activeProfile.image}
                            alt={activeProfile.name}
                            enabled={parallaxEnabled}
                          />

                          <div className="absolute top-3.5 right-3.5 flex items-center gap-1.5 px-2.5 py-1 rounded-full glass z-20">
                            <span className="relative flex h-1.5 w-1.5">
                              {!reducedMotion && (
                                <span className="absolute inline-flex h-full w-full rounded-full bg-accent-cool opacity-60 animate-ping" />
                              )}
                              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent-cool" />
                            </span>
                            <MapPin className="w-3 h-3 text-fg-muted" />
                            <span className="mono-label !text-fg-muted">{activeProfile.distance}</span>
                          </div>

                          {/* Multi-stop bottom gradient + frosted info */}
                          <div
                            className="absolute inset-x-0 bottom-0 z-20 p-5 pt-16"
                            style={{
                              background:
                                'linear-gradient(to top, rgba(10,13,20,0.96) 0%, rgba(10,13,20,0.78) 35%, rgba(10,13,20,0.35) 65%, transparent 100%)',
                            }}
                          >
                            <div className="glass-raised p-5 rounded-[16px]">
                              <div className="flex items-baseline gap-2">
                                <h2 className="text-xl font-semibold tracking-tight text-fg">
                                  {activeProfile.name}
                                </h2>
                                <span className="text-lg text-fg-muted font-normal">
                                  {activeProfile.age}
                                </span>
                              </div>
                              <p className="mt-2 text-[13px] text-fg-muted leading-relaxed line-clamp-3">
                                {activeProfile.bio}
                              </p>
                              {activeProfile.interests.length > 0 && (
                                <div className="mt-3.5 flex flex-wrap gap-1.5">
                                  {activeProfile.interests.slice(0, 5).map((interest, idx) => (
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
                        </motion.div>
                      </>
                    ) : (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute inset-0 glass rounded-[18px] flex flex-col items-center justify-center p-8 text-center z-0"
                      >
                        <div className="w-12 h-12 rounded-full bg-white/6 border border-white/12 flex items-center justify-center mb-5">
                          <Compass className="w-5 h-5 text-fg-subtle" />
                        </div>
                        <h3 className="text-base font-semibold text-fg mb-1.5">You’re all caught up</h3>
                        <p className="text-[13px] text-fg-muted max-w-[240px] leading-relaxed">
                          No more profiles to review right now. Check back soon.
                        </p>
                        <button
                          type="button"
                          onClick={fetchCandidates}
                          className="btn-ghost mt-6 px-4 py-2 rounded-[12px] text-[13px]"
                        >
                          Check again
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Action hierarchy: secondary 48 · primary 64 · secondary 48 · primary 64 */}
                <div className="w-full max-w-[380px] flex justify-center items-center gap-5 mt-7">
                  <motion.button
                    type="button"
                    {...actionPress}
                    onClick={handleRewind}
                    disabled={history.length === 0}
                    title="Undo last swipe"
                    className="w-12 h-12 rounded-full border border-white/10 glass flex items-center justify-center text-fg-subtle/70 hover:text-fg-muted hover:border-white/20 disabled:opacity-35 disabled:pointer-events-none transition-colors duration-200"
                  >
                    <Undo2 className="w-4 h-4" />
                  </motion.button>
                  <motion.button
                    type="button"
                    {...actionPress}
                    whileHover={
                      reducedMotion
                        ? undefined
                        : {
                            boxShadow: '0 0 0 4px rgba(232,101,79,0.28)',
                          }
                    }
                    onClick={() => activeProfile && handlePass(activeProfile.id)}
                    disabled={!activeProfile}
                    title="Pass"
                    className="w-16 h-16 rounded-full border border-danger/40 glass flex items-center justify-center text-danger hover:bg-danger/10 disabled:opacity-35 disabled:pointer-events-none transition-colors duration-200"
                  >
                    <X className="w-6 h-6" strokeWidth={2.25} />
                  </motion.button>
                  <motion.button
                    type="button"
                    {...actionPress}
                    onClick={() => activeProfile && handleSuperLike(activeProfile.id)}
                    disabled={!activeProfile}
                    title="Super like"
                    className="w-12 h-12 rounded-full border border-white/10 glass flex items-center justify-center text-accent-cool/55 hover:text-accent-cool hover:border-accent-cool/35 hover:bg-accent-cool/10 disabled:opacity-35 disabled:pointer-events-none transition-colors duration-200"
                  >
                    <Star className="w-4 h-4" />
                  </motion.button>
                  <motion.button
                    type="button"
                    {...actionPress}
                    whileHover={
                      reducedMotion
                        ? undefined
                        : {
                            boxShadow: '0 0 0 4px rgba(232,166,89,0.32)',
                          }
                    }
                    onClick={() => activeProfile && handleLike(activeProfile.id)}
                    disabled={!activeProfile}
                    title="Like"
                    className="w-16 h-16 rounded-full border border-accent-warm/45 glass flex items-center justify-center text-accent-warm hover:bg-accent-warm/10 disabled:opacity-35 disabled:pointer-events-none transition-colors duration-200"
                  >
                    <Heart className="w-6 h-6 fill-current" />
                  </motion.button>
                </div>
              </div>
            )}

            {/* ---- BROWSE (Profile Matcher) ---- */}
            {discoverView === 'browse' && (
              <LayoutGroup>
                <div className="w-full max-w-[720px]">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    {allInterestChips.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {allInterestChips.map((chip) => {
                          const on = browseFilters.includes(chip);
                          return (
                            <motion.button
                              key={chip}
                              type="button"
                              onClick={() => toggleFilter(chip)}
                              layout
                              animate={{ scale: on ? 1.03 : 1 }}
                              transition={
                                reducedMotion
                                  ? { duration: 0 }
                                  : { type: 'spring', stiffness: 480, damping: 16 }
                              }
                              className={`px-3 py-1.5 rounded-full text-[12px] font-mono border transition-colors duration-200 ${
                                on
                                  ? 'bg-accent-warm border-accent-warm text-bg-base'
                                  : 'bg-white/5 border-white/12 text-fg-muted hover:border-white/20'
                              }`}
                            >
                              {chip}
                            </motion.button>
                          );
                        })}
                      </div>
                    ) : (
                      <div />
                    )}

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

                  {loadingCandidates ? (
                    <RequestSkeleton />
                  ) : filteredBrowse.length === 0 ? (
                    <div className="glass rounded-[18px] p-12 text-center">
                      <p className="text-sm text-fg-muted">No candidates match these filters.</p>
                      <button
                        type="button"
                        onClick={() => setBrowseFilters([])}
                        className="btn-ghost mt-4 px-4 py-2 rounded-[12px] text-[13px]"
                      >
                        Clear filters
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 auto-rows-[minmax(148px,auto)]">
                      {filteredBrowse.map((p, idx) => {
                        const score = scoreCompatibility(p, myProfile);
                        const featured = score >= 80;
                        const elevated = score >= 65 && score < 80;
                        const spanClass = featured
                          ? 'col-span-2 sm:col-span-3 row-span-2'
                          : elevated
                            ? 'col-span-2 sm:col-span-3'
                            : 'col-span-1 sm:col-span-2';

                        return (
                          <motion.div
                            key={p.id}
                            initial={reducedMotion ? false : { opacity: 0, y: 14 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                              duration: reducedMotion ? 0.15 : 0.28,
                              delay: reducedMotion ? 0 : Math.min(idx, 16) * 0.03,
                              ease: EASE,
                            }}
                            whileHover={
                              reducedMotion
                                ? undefined
                                : {
                                    y: -4,
                                    boxShadow: '0 16px 40px -18px rgba(0,0,0,0.55)',
                                  }
                            }
                            className={`group relative glass rounded-[18px] overflow-hidden text-left ${spanClass} ${
                              featured ? 'min-h-[300px]' : elevated ? 'min-h-[168px]' : ''
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => setSelectedBrowseId(p.id)}
                              className="absolute inset-0 z-0"
                              aria-label={`Open ${p.name}`}
                            />

                            {featured ? (
                              <div className="relative h-full flex flex-col pointer-events-none">
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
                                      size={48}
                                      layoutId={`compat-${p.id}`}
                                    />
                                  </div>
                                </div>
                                <div className="relative p-4 -mt-10 z-10">
                                  <p className="text-[15px] font-semibold text-fg truncate">
                                    {p.name}{' '}
                                    <span className="text-fg-muted font-normal">{p.age}</span>
                                  </p>
                                  <p className="mono-label mt-0.5">{p.distance}</p>
                                  <p className="text-[12px] text-fg-muted mt-2 line-clamp-2 leading-relaxed">
                                    {p.bio}
                                  </p>
                                  {p.interests.length > 0 && (
                                    <div className="mt-2.5 flex flex-wrap gap-1">
                                      {p.interests.slice(0, 3).map((i) => (
                                        <span
                                          key={i}
                                          className="px-1.5 py-0.5 rounded text-[10px] font-mono text-fg-muted bg-white/6 border border-white/10"
                                        >
                                          {i}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="relative p-3.5 h-full flex gap-3 pointer-events-none">
                                <div
                                  className={`rounded-[14px] overflow-hidden border border-white/12 flex-shrink-0 ${
                                    elevated ? 'w-20 h-20' : 'w-14 h-14'
                                  }`}
                                >
                                  <img
                                    src={p.image}
                                    alt={p.name}
                                    className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                                  />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="text-[14px] font-semibold text-fg truncate">
                                        {p.name}{' '}
                                        <span className="text-fg-muted font-normal">{p.age}</span>
                                      </p>
                                      <p className="mono-label mt-0.5">{p.distance}</p>
                                    </div>
                                    <div className="pointer-events-auto">
                                      <CompatibilityRing
                                        score={score}
                                        size={elevated ? 44 : 40}
                                        layoutId={`compat-${p.id}`}
                                      />
                                    </div>
                                  </div>
                                  <p className="text-[12px] text-fg-muted mt-2 line-clamp-2 leading-relaxed">
                                    {p.bio}
                                  </p>
                                </div>
                              </div>
                            )}

                            {/* Quick-action overlay */}
                            <div className="absolute inset-x-0 bottom-0 z-20 flex justify-center gap-3 pb-3 pt-8 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-[opacity,transform] duration-200 pointer-events-none group-hover:pointer-events-auto bg-gradient-to-t from-bg-base/90 via-bg-base/50 to-transparent">
                              <motion.button
                                type="button"
                                {...actionPress}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleBrowseAction(p.id, 'PASS');
                                }}
                                title="Pass"
                                className="w-10 h-10 rounded-full glass border border-danger/35 text-danger flex items-center justify-center hover:bg-danger/10"
                              >
                                <X className="w-4 h-4" />
                              </motion.button>
                              <motion.button
                                type="button"
                                {...actionPress}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleBrowseAction(p.id, 'LIKE');
                                }}
                                title="Like"
                                className="w-10 h-10 rounded-full glass border border-accent-warm/40 text-accent-warm flex items-center justify-center hover:bg-accent-warm/10"
                              >
                                <Heart className="w-4 h-4 fill-current" />
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
                              score={scoreCompatibility(selectedBrowse, myProfile)}
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
                              Like
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
                        <p className="mono-label mb-3">mutual like</p>
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
          <div className="flex-1 flex md:h-screen">
            <div
              className={`w-full md:w-[320px] md:border-r border-white/12 flex-col bg-bg-base/40 ${
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
                  <LayoutGroup id="match-list">
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
                          className={`group relative w-full flex items-center gap-3 p-2.5 pl-3.5 rounded-[12px] text-left overflow-hidden transition-colors duration-150 ${
                            selected ? 'bg-white/[0.09]' : 'hover:bg-white/[0.06]'
                          }`}
                        >
                          {selected && (
                            <motion.span
                              layoutId="match-selection-accent"
                              className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-accent-warm"
                              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                            />
                          )}
                          <motion.div
                            className="w-full flex items-center gap-3 min-w-0"
                            whileHover={reducedMotion ? undefined : { x: 2 }}
                            transition={{ duration: 0.15, ease: EASE }}
                          >
                            <div className="relative flex-shrink-0">
                              <motion.div
                                layoutId={`avatar-${match.id}`}
                                className="w-10 h-10 rounded-full overflow-hidden border border-white/12"
                              >
                                <img
                                  src={match.avatar}
                                  alt={match.name}
                                  className="w-full h-full object-cover"
                                />
                              </motion.div>
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
                                    <span className="w-1.5 h-1.5 rounded-full bg-accent-warm flex-shrink-0" />
                                  )}
                                  {match.type === 'project' && (
                                    <span className="px-1.5 py-px rounded bg-accent-cool/10 text-accent-cool text-[10px] font-mono flex-shrink-0 font-normal">
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

            <div className={`flex-1 flex-col bg-bg-base/20 ${selectedMatch ? 'flex' : 'hidden md:flex'}`}>
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
                        <motion.div
                          layoutId={`avatar-${selectedMatch.id}`}
                          className="w-8 h-8 rounded-full overflow-hidden border border-white/12"
                        >
                          <img
                            src={selectedMatch.avatar}
                            alt={selectedMatch.name}
                            className="w-full h-full object-cover"
                          />
                        </motion.div>
                        {isMatchOnline(selectedMatch.id) && (
                          <OnlinePresence reducedMotion={reducedMotion} size="sm" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-[13px] font-medium text-fg truncate leading-tight flex items-center gap-1.5">
                          {selectedMatch.name}
                          {isMatchOnline(selectedMatch.id) && (
                            <span className="w-1.5 h-1.5 rounded-full bg-accent-cool" title="Online" />
                          )}
                        </h3>
                        {selectedMatch.type === 'project' && (
                          <p className="mono-label truncate leading-tight mt-0.5">
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
                      className="flex-1 overflow-y-auto px-4 md:px-6 py-5 space-y-2.5"
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
                        <>
                          <DateSeparator label="Today" />
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
                                  transition={stagger}
                                  className="w-full flex justify-center py-2"
                                >
                                  <div className="w-full max-w-md glass rounded-[16px] p-4 space-y-2.5">
                                    <div className="flex items-center justify-between border-b border-white/12 pb-2">
                                      <span className="mono-label !text-accent-warm">project brief</span>
                                      <span className="mono-label">{msg.time}</span>
                                    </div>
                                    <h4 className="text-sm font-semibold text-fg">
                                      {titleLine.replace('Project: ', '')}
                                    </h4>
                                    <p className="mono-label">{stackLine.replace('Stack: ', '')}</p>
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
                                transition={stagger}
                                className={`group/bubble flex ${mine ? 'justify-end' : 'justify-start'}`}
                              >
                                <div
                                  className={`max-w-[75%] px-3.5 py-2.5 text-sm leading-relaxed backdrop-blur-md border ${
                                    mine
                                      ? 'bg-accent-warm/18 border-accent-warm/30 text-fg rounded-[20px] rounded-br-[4px]'
                                      : 'bg-white/[0.06] border-white/12 text-fg rounded-[20px] rounded-bl-[4px]'
                                  }`}
                                >
                                  <p className="whitespace-pre-wrap">{msg.text}</p>
                                  <span
                                    className={`flex items-center justify-end gap-1 mt-1 text-[10px] font-mono text-fg-subtle transition-opacity duration-200 ${
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
                        </>
                      )}

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
                                  reducedMotion
                                    ? { opacity: 0.55 }
                                    : { y: [0, -3.5, 0] }
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
                          <ArrowDown className="w-3 h-3 text-accent-warm" />
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
                        chatFocused ? '!border-accent-warm/50 !shadow-[0_0_0_3px_rgba(232,166,89,0.14)]' : ''
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
                                backgroundColor: 'rgba(232, 166, 89, 1)',
                                color: 'rgba(10, 13, 20, 1)',
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
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-white/6 border border-white/12 flex items-center justify-center mb-4 text-fg-subtle">
                    <MessageCircle className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-semibold text-fg">Your messages</h3>
                  <p className="text-[13px] text-fg-muted mt-1.5 max-w-[240px] leading-relaxed">
                    Select a match to start the conversation.
                  </p>
                </div>
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
            onViewOwnProfile={() => setActiveTab('profile')}
          />
        )}
      </main>
    </div>
  );
};