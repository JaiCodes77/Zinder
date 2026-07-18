import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, LayoutGroup } from 'framer-motion';
import {
  MessageCircle,
  User,
  Compass,
  Code2,
  LayoutGrid,
  Layers,
} from 'lucide-react';
import { GatewayNetwork } from './GatewayNetwork';
import { MatchModal } from './MatchModal';
import { type RequestStatus } from './RequestStepper';
import { ProfilePage } from './ProfilePage';
import { PublicProfileView } from './PublicProfileView';
import { ProjectHelpHub, type ProjectRequest } from './projectHelp';
import { projectHelpHash } from './projectHelp/routes';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { ActivityBar, type ActivityTab } from './ActivityBar';
import { CommandPalette, CommandPaletteHint } from './CommandPalette';
import { apiFetch } from '../api/client';
import { fetchLatestMessage, previewChatText } from '../api/chat';
import { toUiStatus } from '../api/projects';
import { useMatchChat } from '../hooks/useMatchChat';
import { DiscoverDeck } from './DiscoverDeck';
import { DiscoverBrowse } from './DiscoverBrowse';
import {
  matchConversationIdFromHash,
  publicProfileUserIdFromHash,
  setMatchConversationHash,
  setPublicProfileHash,
  setTabHash,
  tabFromHash,
} from '../lib/appRoutes';
import {
  hashForDiscover,
  parseDiscoverHash,
  replaceDiscoverHash,
  type BrowseSort,
  type DiscoverView,
} from '../lib/discoverRoutes';
import {
  nearbyGeoMessage,
  profileHasCoords,
  readBrowserCoords,
  type NearbyGeoStatus,
} from '../lib/geolocation';
import { MatchesInbox, type Match } from './matches';

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

interface DiscoveryPageProps {
  onLogout: () => void | Promise<void>;
}

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

function extractBrowsePage(
  data: unknown
): { items: unknown[]; nextCursor: string | null } | null {
  if (Array.isArray(data)) return { items: data, nextCursor: null };
  if (data && typeof data === 'object' && Array.isArray((data as { items?: unknown }).items)) {
    const next = (data as { next_cursor?: unknown }).next_cursor;
    return {
      items: (data as { items: unknown[] }).items,
      nextCursor: typeof next === 'string' && next.length > 0 ? next : null,
    };
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

const SPRING_PILL = { type: 'spring' as const, stiffness: 380, damping: 32 };

// ==========================================
export const DiscoveryPage: React.FC<DiscoveryPageProps> = ({ onLogout }) => {
  const reducedMotion = usePrefersReducedMotion();
  const [activeTab, setActiveTab] = useState<ActivityTab>(() => tabFromHash());
  const [viewingUserId, setViewingUserId] = useState<number | null>(() =>
    publicProfileUserIdFromHash()
  );
  const [hashMatchId, setHashMatchId] = useState<string | null>(() =>
    matchConversationIdFromHash()
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readActivityBarCollapsed);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const initialDiscover = parseDiscoverHash();
  const [discoverView, setDiscoverView] = useState<DiscoverView>(initialDiscover.view);

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
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [projectStatuses, setProjectStatuses] = useState<Record<number, RequestStatus>>({});

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [history, setHistory] = useState<Profile[]>([]);
  const [likesCount, setLikesCount] = useState(0);
  const [loadingCandidates, setLoadingCandidates] = useState(true);
  /** Set when browse fetch fails or returns an unparseable body — never treat as empty. */
  const [candidatesError, setCandidatesError] = useState<string | null>(null);
  const [browseFilters, setBrowseFilters] = useState<string[]>(initialDiscover.tags);
  const [browseSort, setBrowseSort] = useState<BrowseSort>(initialDiscover.sort);
  const [browseCursor, setBrowseCursor] = useState<string | null>(null);
  const [loadingMoreCandidates, setLoadingMoreCandidates] = useState(false);
  const [selectedBrowseId, setSelectedBrowseId] = useState<number | null>(null);
  const [nearbyGeoStatus, setNearbyGeoStatus] = useState<NearbyGeoStatus>('idle');
  const geoSyncGen = useRef(0);

  const [matches, setMatches] = useState<Match[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [matchesError, setMatchesError] = useState<string | null>(null);
  const [presenceByMatchId, setPresenceByMatchId] = useState<Record<number, boolean>>({});
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [matchBloomDone, setMatchBloomDone] = useState(false);
  const [matchModalData, setMatchModalData] = useState<{
    id: number;
    matchId?: number;
    name: string;
    avatar: string;
  } | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [chatFocused, setChatFocused] = useState(false);
  const [showNewMsgPill, setShowNewMsgPill] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const stickToBottom = useRef(true);

  const myUserId: number | null =
    typeof myProfile?.user?.id === 'number'
      ? myProfile.user.id
      : typeof myProfile?.user_id === 'number'
        ? myProfile.user_id
        : null;

  const liveMatchId =
    selectedMatch?.type !== 'project' && typeof selectedMatch?.matchId === 'number'
      ? selectedMatch.matchId
      : null;

  const liveChat = useMatchChat({
    matchId: liveMatchId,
    myUserId,
    onPreview: (text) => {
      if (liveMatchId == null) return;
      setMatches((prev) =>
        prev.map((m) =>
          m.matchId === liveMatchId ? { ...m, lastMessage: text, unread: false } : m
        )
      );
    },
    onPresence: (matchId, online) => {
      setPresenceByMatchId((prev) =>
        prev[matchId] === online ? prev : { ...prev, [matchId]: online }
      );
    },
  });

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
      const data = await apiFetch<any>('/profiles/me');
      setMyProfile(data);
    } catch (err) {
      console.error('Failed to fetch profile', err);
    } finally {
      setLoadingProfile(false);
    }
  };

  const fetchProjects = async () => {
    try {
      setLoadingProjects(true);
      setProjectsError(null);
      const data = await apiFetch<ProjectRequest[]>('/projects');
      setProjects(data);
      setProjectStatuses(() => {
        const next: Record<number, RequestStatus> = {};
        for (const p of data) next[p.id] = toUiStatus(p.status);
        return next;
      });
      setProjectsError(null);
    } catch (err) {
      console.error('Failed to fetch projects', err);
      setProjects([]);
      setProjectsError("Couldn't load project help. Try again.");
    } finally {
      setLoadingProjects(false);
    }
  };

  const fetchCandidates = useCallback(
    async (opts?: { cursor?: string | null }) => {
      const append = Boolean(opts?.cursor);
      try {
        if (append) setLoadingMoreCandidates(true);
        else {
          setLoadingCandidates(true);
          setBrowseCursor(null);
        }
        setCandidatesError(null);

        const sortParam =
          browseSort === 'newest' ? 'newest' : browseSort === 'nearby' ? 'nearby' : 'best';
        const params = new URLSearchParams({ sort: sortParam, limit: '20' });
        if (opts?.cursor) params.set('cursor', opts.cursor);
        if (browseFilters.length > 0) params.set('tags', browseFilters.join(','));

        const data = await apiFetch<unknown>(`/matcher/browse?${params.toString()}`);
        const page = extractBrowsePage(data);
        if (!page) {
          if (!append) setProfiles([]);
          setBrowseCursor(null);
          setCandidatesError("Couldn't load candidates. Try again.");
          return;
        }

        const mapped = page.items.map(mapBrowseItem);
        if (append) {
          setProfiles((prev) => {
            const seen = new Set(prev.map((p) => p.id));
            return [...prev, ...mapped.filter((p) => !seen.has(p.id))];
          });
        } else {
          setProfiles(mapped);
        }
        setBrowseCursor(page.nextCursor);
        setCandidatesError(null);
      } catch (err) {
        console.error('Failed to fetch candidate profiles', err);
        if (!append) {
          setProfiles([]);
          setBrowseCursor(null);
        }
        setCandidatesError("Couldn't load candidates. Try again.");
      } finally {
        setLoadingCandidates(false);
        setLoadingMoreCandidates(false);
      }
    },
    [browseSort, browseFilters]
  );

  const hydrateMatchPreviews = async (matchIds: number[]) => {
    await Promise.all(
      matchIds.map(async (matchId) => {
        try {
          const latest = await fetchLatestMessage(matchId);
          if (!latest) return;
          const time = new Date(latest.created_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          });
          const preview = previewChatText(latest.text);
          setMatches((prev) =>
            prev.map((m) =>
              m.matchId === matchId
                ? { ...m, lastMessage: preview, time }
                : m
            )
          );
        } catch {
          /* preview is best-effort */
        }
      })
    );
  };

  const fetchMatches = async () => {
    try {
      setLoadingMatches(true);
      setMatchesError(null);
      const data = await apiFetch<
        Array<{
          match_id: number;
          matched_user_id: number;
          matched_user_name: string;
          image?: string;
          timestamp: string;
        }>
      >('/matcher/matches');
      setMatches((prev) => {
        const serverMatches = data.map((m) => {
          const existing = prev.find((p) => p.matchId === m.match_id);
          return {
            id: m.match_id,
            matchId: m.match_id,
            peerUserId: m.matched_user_id,
            name: m.matched_user_name,
            avatar: m.image || '/profile_3.png',
            lastMessage: existing?.lastMessage || 'You matched — say hi',
            time: new Date(m.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            }),
            unread: existing?.unread ?? false,
            type: 'match' as const,
          };
        });
        return serverMatches;
      });
      setMatchesError(null);
      void hydrateMatchPreviews(data.map((m) => m.match_id));
    } catch (err) {
      console.error('Failed to fetch matches', err);
      setMatches([]);
      setMatchesError("Couldn't load matches. Try again.");
    } finally {
      setLoadingMatches(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    fetchMatches();
  }, []);

  // Unified hash routes: `#/discover[?…]` · `#/matches[/:id]` · `#/profile[/:id]` · `#/project-help…`
  useEffect(() => {
    const syncFromHash = () => {
      const tab = tabFromHash();
      setActiveTab(tab);
      setViewingUserId(publicProfileUserIdFromHash());
      setHashMatchId(matchConversationIdFromHash());
      if (tab === 'discover') {
        const d = parseDiscoverHash();
        setDiscoverView(d.view);
        setBrowseSort(d.sort);
        setBrowseFilters(d.tags);
      }
    };
    syncFromHash();
    // Normalize empty hash so refresh always has a restoreable URL
    if (!window.location.hash || window.location.hash === '#' || window.location.hash === '#/') {
      setTabHash('discover');
    }
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, []);

  // Persist Discover view / sort / tags in the hash (survives refresh).
  useEffect(() => {
    if (activeTab !== 'discover') return;
    replaceDiscoverHash({
      view: discoverView,
      sort: browseSort,
      tags: browseFilters,
    });
  }, [activeTab, discoverView, browseSort, browseFilters]);

  // Restore / clear selected conversation from `#/matches/:id`
  useEffect(() => {
    if (hashMatchId == null) {
      if (activeTab === 'matches') setSelectedMatch(null);
      return;
    }
    const found = matches.find((m) => String(m.id) === hashMatchId);
    if (found) setSelectedMatch(found);
  }, [hashMatchId, matches, activeTab]);

  const goToTab = (key: ActivityTab) => {
    setActiveTab(key);
    if (key === 'profile') setViewingUserId(null);
    if (key === 'matches') setHashMatchId(null);
    if (key === 'discover') {
      const target = hashForDiscover({
        view: discoverView,
        sort: browseSort,
        tags: browseFilters,
      });
      if (window.location.hash !== target) {
        window.location.hash = target;
      }
      return;
    }
    setTabHash(key);
  };

  const openMatchConversation = (match: Match) => {
    setSelectedMatch(match);
    setActiveTab('matches');
    setHashMatchId(String(match.id));
    setMatchConversationHash(match.id);
    setMatches((prev) =>
      prev.map((m) => (m.id === match.id ? { ...m, unread: false } : m))
    );
    stickToBottom.current = true;
    setShowNewMsgPill(false);
  };

  const goToPublicProfile = (userId: number) => {
    if (myUserId != null && userId === myUserId) {
      goToTab('profile');
      return;
    }
    setViewingUserId(userId);
    setActiveTab('profile');
    setPublicProfileHash(userId);
  };

  const publicProfileId =
    viewingUserId != null && viewingUserId !== myUserId ? viewingUserId : null;

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
        return;
      }

      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);
      if (typing || commandPaletteOpen || showMatchModal) return;
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [commandPaletteOpen, showMatchModal]);

  useEffect(() => {
    if (activeTab === 'projectHelp' || activeTab === 'profile') fetchProjects();
    else if (activeTab === 'discover') fetchCandidates();
    else if (activeTab === 'matches') fetchMatches();
  }, [activeTab, fetchCandidates]);

  const hasProfileCoords = profileHasCoords(myProfile);
  const nearbyGeoAttempted = useRef(false);

  // Nearby sort needs viewer lat/lng on the profile (matcher haversine).
  useEffect(() => {
    if (activeTab !== 'discover' || browseSort !== 'nearby') {
      if (browseSort !== 'nearby') {
        setNearbyGeoStatus('idle');
        nearbyGeoAttempted.current = false;
      }
      return;
    }
    if (hasProfileCoords) {
      setNearbyGeoStatus('ready');
      return;
    }
    if (loadingProfile || nearbyGeoAttempted.current) return;
    nearbyGeoAttempted.current = true;

    const gen = ++geoSyncGen.current;
    let cancelled = false;
    const snapshot = myProfile;

    (async () => {
      setNearbyGeoStatus('locating');
      const result = await readBrowserCoords();
      if (cancelled || gen !== geoSyncGen.current) return;
      if (!result.ok) {
        setNearbyGeoStatus(result.reason === 'denied' ? 'denied' : 'unavailable');
        return;
      }
      try {
        const { syncProfileLocation } = await import('../api/profiles');
        await syncProfileLocation(snapshot, result.coords);
        if (cancelled || gen !== geoSyncGen.current) return;
        setMyProfile((prev: typeof myProfile) =>
          prev
            ? { ...prev, lat: result.coords.lat, lng: result.coords.lng }
            : prev
        );
        setNearbyGeoStatus('ready');
        void fetchCandidates();
      } catch (err) {
        console.error('Failed to save location for Nearby', err);
        if (!cancelled && gen === geoSyncGen.current) {
          setNearbyGeoStatus('unavailable');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- snapshot myProfile once per Nearby attempt
  }, [activeTab, browseSort, hasProfileCoords, loadingProfile, fetchCandidates]);

  // ------------------------------------------
  // SWIPE / MATCH
  // ------------------------------------------
  const postSwipe = async (targetUserId: number, action: 'LIKE' | 'PASS' | 'SUPERLIKE') => {
    try {
      const data = await apiFetch<{ is_match?: boolean; match_id?: number }>('/matcher/swipe', {
        method: 'POST',
        json: { swiped_id: targetUserId, action },
      });
      if (data?.is_match) {
        const matchedProfile = profiles.find((p) => p.id === targetUserId);
        setMatchModalData({
          id: targetUserId,
          matchId: data.match_id,
          name: matchedProfile?.name || 'Developer',
          avatar: matchedProfile?.image || '/profile_3.png',
        });
        setMatchBloomDone(false);
        setShowMatchModal(true);
        fetchMatches();
      }
    } catch (err) {
      console.error('Failed to post swipe', err);
    }
  };

  const handleSendMessageFromModal = () => {
    if (matchModalData) {
      const targetUserId = matchModalData.id;
      const existingMatch = matches.find(
        (m) =>
          m.matchId === matchModalData.matchId ||
          m.peerUserId === targetUserId ||
          m.id === targetUserId
      );
      const matchObj =
        existingMatch ||
        ({
          id: matchModalData.matchId ?? targetUserId,
          matchId: matchModalData.matchId,
          peerUserId: targetUserId,
          name: matchModalData.name,
          avatar: matchModalData.avatar,
          lastMessage: 'You matched — say hi',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          unread: false,
          type: 'match' as const,
        } as Match);
      if (!existingMatch) setMatches((prev) => [matchObj, ...prev]);
      openMatchConversation(matchObj);
    }
    setShowMatchModal(false);
    setMatchBloomDone(false);
  };

  const handleDeckLike = (userId: number) => {
    postSwipe(userId, 'LIKE');
    setLikesCount((prev) => prev + 1);
  };

  const handleDeckPass = (userId: number) => {
    postSwipe(userId, 'PASS');
  };

  const handleDeckSuperLike = (userId: number) => {
    postSwipe(userId, 'SUPERLIKE');
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

  const handleRewind = async () => {
    if (history.length === 0) return;
    const snapshotHistory = history;
    const snapshotProfiles = profiles;
    const lastSwiped = history[history.length - 1]!;
    setHistory(history.slice(0, -1));
    setProfiles([lastSwiped, ...profiles]);
    try {
      await apiFetch<{ undone: boolean }>('/matcher/swipe/last', { method: 'DELETE' });
      void fetchMatches();
    } catch (err) {
      console.error('Failed to undo swipe', err);
      setHistory(snapshotHistory);
      setProfiles(snapshotProfiles);
    }
  };

  // ------------------------------------------
  // CHAT
  // ------------------------------------------
  const isLiveChat = liveMatchId != null;

  const currentMessages = selectedMatch && isLiveChat ? liveChat.messages : [];

  const isTyping = isLiveChat ? liveChat.peerTyping : false;

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

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !selectedMatch) return;
    const text = chatInput.trim();
    setChatInput('');
    stickToBottom.current = true;

    if (!isLiveChat) return;

    liveChat.notifyTyping(false);
    try {
      await liveChat.send(text);
    } catch (err) {
      console.error('Failed to send chat message', err);
      setChatInput(text);
    }
  };

  const toggleFilter = (chip: string) => {
    setBrowseFilters((prev) =>
      prev.includes(chip) ? prev.filter((c) => c !== chip) : [...prev, chip]
    );
  };

  const handleMergeAndGoToDeck = (userId: number) => {
    handleBrowseAction(userId, 'LIKE');
    setDiscoverView('deck');
  };

  const activeProfile = profiles[0];

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
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
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

      <main id="main-content" className="main-content" tabIndex={-1}>
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
              <DiscoverDeck
                profiles={profiles}
                setProfiles={setProfiles}
                setHistory={setHistory}
                historyLength={history.length}
                loading={loadingCandidates}
                error={candidatesError}
                reducedMotion={reducedMotion}
                activeProfile={activeProfile}
                onLike={handleDeckLike}
                onPass={handleDeckPass}
                onSuperLike={handleDeckSuperLike}
                onRewind={handleRewind}
                onRetry={() => fetchCandidates()}
              />
            )}

            {/* ---- BROWSE (Profile Matcher) ---- */}
            {discoverView === 'browse' && (
              <DiscoverBrowse
                profiles={profiles}
                myProfile={myProfile}
                browseFilters={browseFilters}
                browseSort={browseSort}
                browseCursor={browseCursor}
                loadingCandidates={loadingCandidates}
                loadingMoreCandidates={loadingMoreCandidates}
                candidatesError={candidatesError}
                nearbyGeoHint={
                  browseSort === 'nearby' ? nearbyGeoMessage(nearbyGeoStatus) : null
                }
                selectedBrowseId={selectedBrowseId}
                reducedMotion={reducedMotion}
                onToggleFilter={toggleFilter}
                onBrowseSortChange={setBrowseSort}
                onClearFilters={() => setBrowseFilters([])}
                onRetry={() => fetchCandidates()}
                onLoadMore={() => void fetchCandidates({ cursor: browseCursor })}
                onSelectBrowseId={setSelectedBrowseId}
                onBrowseAction={handleBrowseAction}
                onMergeAndGoToDeck={handleMergeAndGoToDeck}
              />
            )}

            <MatchModal
              open={showMatchModal}
              data={matchModalData}
              bloomDone={matchBloomDone}
              reducedMotion={reducedMotion}
              myInitials={myProfile ? getInitials(myProfile.user.name) : 'ME'}
              onBloomComplete={() => setMatchBloomDone(true)}
              onSendMessage={handleSendMessageFromModal}
              onDismiss={() => {
                setShowMatchModal(false);
                setMatchBloomDone(false);
              }}
            />
          </div>
        )}

        {/* ========== CHAT (extracted MatchesInbox) ========== */}
        {activeTab === 'matches' && (
          <MatchesInbox
            matches={matches}
            loadingMatches={loadingMatches}
            matchesError={matchesError}
            onRetryMatches={() => void fetchMatches()}
            selectedMatch={selectedMatch}
            reducedMotion={reducedMotion}
            messages={currentMessages}
            isTyping={isTyping}
            isLiveChat={isLiveChat}
            liveLoading={liveChat.loading}
            liveError={liveChat.error}
            peerOnline={liveChat.peerOnline}
            presenceByMatchId={presenceByMatchId}
            chatInput={chatInput}
            chatFocused={chatFocused}
            showNewMsgPill={showNewMsgPill}
            chatScrollRef={chatScrollRef}
            chatInputRef={chatInputRef}
            onSelectMatch={openMatchConversation}
            onCloseConversation={() => {
              setSelectedMatch(null);
              setMatchConversationHash(null);
            }}
            onViewProfile={goToPublicProfile}
            onChatScroll={onChatScroll}
            onScrollToBottom={scrollChatToBottom}
            onChatInputChange={setChatInput}
            onChatFocusChange={setChatFocused}
            onLiveTypingChange={(v) => liveChat.onInputChange(v)}
            onLiveTypingBlur={() => liveChat.onInputChange('')}
            onSend={handleSendChatMessage}
            onSuggestStarter={(text) => {
              setChatInput(text);
              if (isLiveChat) liveChat.onInputChange(text);
              requestAnimationFrame(() => chatInputRef.current?.focus());
            }}
          />
        )}

        {/* ========== PROFILE (own or public `#/profile/:id`) ========== */}
        {activeTab === 'profile' && publicProfileId != null && (
          <PublicProfileView
            userId={publicProfileId}
            onBack={() => goToTab('profile')}
            getInitials={getInitials}
          />
        )}
        {activeTab === 'profile' && publicProfileId == null && (
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
            projectsError={projectsError}
            projectStatuses={projectStatuses}
            setProjectStatuses={setProjectStatuses}
            onRefreshProjects={fetchProjects}
            onViewOwnProfile={() => goToTab('profile')}
            onViewProfile={goToPublicProfile}
          />
        )}
      </main>

      <nav className="mobile-tab-bar" aria-label="Primary">
        {navItems.map(({ key, label, icon: Icon }) => {
          const active = activeTab === key;
          const matchBadge = key === 'matches' && matches.length > 0;
          return (
            <button
              key={key}
              type="button"
              onClick={() => goToTab(key)}
              aria-current={active ? 'page' : undefined}
              aria-label={matchBadge ? `${label}, ${matches.length} conversations` : label}
              className={`relative flex flex-col items-center justify-center gap-1 px-3 py-1 text-[10px] font-medium transition-colors duration-200 ${
                active ? 'text-accent-brand' : 'text-fg-muted'
              }`}
            >
              <Icon className="w-5 h-5" strokeWidth={active ? 2.25 : 1.75} aria-hidden />
              <span className="font-mono tracking-wide" aria-hidden>
                {label}
              </span>
              {matchBadge && (
                <span
                  className="absolute -top-0.5 right-1 nav-count-chip !min-w-[1rem] !h-4 !text-[9px]"
                  aria-hidden
                >
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
        onOpenDiscoverDeck={() => {
          setDiscoverView('deck');
          setActiveTab('discover');
          window.location.hash = hashForDiscover({
            view: 'deck',
            sort: browseSort,
            tags: browseFilters,
          });
        }}
        onOpenDiscoverBrowse={() => {
          setDiscoverView('browse');
          setActiveTab('discover');
          window.location.hash = hashForDiscover({
            view: 'browse',
            sort: browseSort,
            tags: browseFilters,
          });
        }}
        onNewProjectHelp={() => {
          window.location.hash = projectHelpHash('new');
          setActiveTab('projectHelp');
        }}
        onOpenMatch={(m) => {
          const full = matches.find((x) => x.id === m.id);
          if (full) openMatchConversation(full);
          else goToTab('matches');
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