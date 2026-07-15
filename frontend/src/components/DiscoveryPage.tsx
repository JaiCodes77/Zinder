import React, { useState } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
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
  Plus,
  Send,
  Loader2,
  ChevronLeft,
  ChevronRight,
  MapPin,
} from 'lucide-react';
import { GatewayNetwork } from './GatewayNetwork';

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

interface DiscoveryPageProps {
  onLogout: () => void;
}

// ==========================================
// SMALL SHARED PIECES
// ==========================================
const Avatar: React.FC<{ initials: string; size?: string; className?: string }> = ({
  initials,
  size = 'w-9 h-9 text-xs',
  className = '',
}) => (
  <div
    className={`${size} ${className} rounded-full bg-ink-750 border border-white/8 flex items-center justify-center font-semibold text-fg-muted flex-shrink-0 select-none`}
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

export const DiscoveryPage: React.FC<DiscoveryPageProps> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState<'discover' | 'matches' | 'profile' | 'projectHelp'>('discover');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

  // Authenticated user profile & projects
  const [myProfile, setMyProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState<boolean>(true);
  const [projects, setProjects] = useState<any[]>([]);
  const [loadingProjects, setLoadingProjects] = useState<boolean>(false);

  // Help request form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [techStackInput, setTechStackInput] = useState('');
  const [techStack, setTechStack] = useState<string[]>([]);
  const [submittingProject, setSubmittingProject] = useState(false);
  const [formExpanded, setFormExpanded] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const getInitials = (name: string) => {
    if (!name) return '??';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // ==========================================
  // DATA FETCHING
  // ==========================================
  const fetchProfile = async () => {
    try {
      setLoadingProfile(true);
      const res = await fetch('http://localhost:8080/api/v1/profiles/me', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setMyProfile(data);
      }
    } catch (err) {
      console.error('Failed to fetch profile', err);
    } finally {
      setLoadingProfile(false);
    }
  };

  const fetchProjects = async () => {
    try {
      setLoadingProjects(true);
      const res = await fetch('http://localhost:8080/api/v1/projects', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
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
            time: new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
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

  // Tech stack tag input
  const handleAddTech = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const tag = techStackInput.trim().replace(/,/g, '');
      if (tag && !techStack.includes(tag)) {
        setTechStack([...techStack, tag]);
      }
      setTechStackInput('');
    }
  };

  const handleRemoveTech = (tag: string) => {
    setTechStack(techStack.filter((t) => t !== tag));
  };

  const handlePostProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || techStack.length === 0) {
      setFormError('Add a title, a description, and at least one technology.');
      return;
    }
    setFormError(null);
    setSubmittingProject(true);
    try {
      const res = await fetch('http://localhost:8080/api/v1/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          tech_stack: techStack,
        }),
        credentials: 'include',
      });
      if (res.ok) {
        setTitle('');
        setDescription('');
        setTechStack([]);
        setFormExpanded(false);
        fetchProjects();
      } else {
        const errData = await res.json();
        setFormError(errData.detail || 'Could not publish your request.');
      }
    } catch (err) {
      console.error(err);
      setFormError('Network error — could not publish your request.');
    } finally {
      setSubmittingProject(false);
    }
  };

  // Initial load + per-tab refresh
  React.useEffect(() => {
    fetchProfile();
    fetchMatches();
  }, []);

  React.useEffect(() => {
    if (activeTab === 'projectHelp') {
      fetchProjects();
    } else if (activeTab === 'discover') {
      fetchCandidates();
    } else if (activeTab === 'matches') {
      fetchMatches();
    }
  }, [activeTab]);

  // Deck state
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [history, setHistory] = useState<Profile[]>([]);
  const [likesCount, setLikesCount] = useState<number>(0);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | 'up' | null>(null);
  const [loadingCandidates, setLoadingCandidates] = useState<boolean>(true);

  // Matches & chat state
  const [matches, setMatches] = useState<Match[]>([]);
  const [loadingMatches, setLoadingMatches] = useState<boolean>(false);
  const [showMatchModal, setShowMatchModal] = useState<boolean>(false);
  const [matchModalData, setMatchModalData] = useState<{ id: number; name: string; avatar: string } | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [chatInput, setChatInput] = useState('');

  // Profile edit state
  const [isEditingProfile, setIsEditingProfile] = useState<boolean>(false);
  const [editAge, setEditAge] = useState<number>(25);
  const [editLookingFor, setEditLookingFor] = useState<string>('');
  const [editRadiusLimit, setEditRadiusLimit] = useState<number>(10);
  const [editBio, setEditBio] = useState<string>('');
  const [editInterests, setEditInterests] = useState<string[]>([]);
  const [editInterestsInput, setEditInterestsInput] = useState<string>('');
  const [savingProfile, setSavingProfile] = useState<boolean>(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Per-chat message log
  const [chatHistory, setChatHistory] = useState<
    Record<string | number, Array<{ sender: 'me' | 'them'; text: string; time: string }>>
  >({});

  const getInitialMessagesForMatch = (match: Match) => {
    if (match.type === 'project') {
      return [
        {
          sender: 'them' as const,
          text: `[SYSTEM: PROJECT BRIEF]\nProject: ${match.projectTitle}\nStack: ${match.projectTech?.join(', ') || 'None'}\n\nDescription: ${match.projectDesc}`,
          time: match.time,
        },
        {
          sender: 'them' as const,
          text: `Hey — thanks for offering to help with “${match.projectTitle}”. Happy to walk you through where I’m stuck.`,
          time: match.time,
        },
      ];
    }
    // Real matches start with an empty thread.
    return [];
  };

  const currentMessages = selectedMatch
    ? chatHistory[selectedMatch.id] || getInitialMessagesForMatch(selectedMatch)
    : [];

  // Drag gesture motion values
  const dragX = useMotionValue(0);
  const dragY = useMotionValue(0);
  const rotate = useTransform(dragX, [-200, 200], [-18, 18]);
  const cardOpacity = useTransform(dragX, [-200, -150, 0, 150, 200], [0.6, 0.95, 1, 0.95, 0.6]);
  const likeOpacity = useTransform(dragX, [0, 120], [0, 1]);
  const passOpacity = useTransform(dragX, [-120, 0], [1, 0]);
  const superLikeOpacity = useTransform(dragY, [-120, 0], [1, 0]);

  // ==========================================
  // SWIPE ACTIONS
  // ==========================================
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
      const matchObj = existingMatch || {
        id: targetUserId,
        name: matchModalData.name,
        avatar: matchModalData.avatar,
        lastMessage: 'You matched — say hi',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        unread: false,
      };
      if (!existingMatch) {
        setMatches((prev) => [matchObj, ...prev]);
      }
      setSelectedMatch(matchObj);
      setActiveTab('matches');
    }
    setShowMatchModal(false);
  };

  const handleLike = (userId: number) => {
    postSwipe(userId, 'LIKE');
    setLikesCount((prev) => prev + 1);
    popCard('right');
  };

  const handlePass = (userId: number) => {
    postSwipe(userId, 'PASS');
    popCard('left');
  };

  const handleSuperLike = (userId: number) => {
    postSwipe(userId, 'SUPERLIKE');
    popCard('up');
  };

  const handleRewind = () => {
    if (history.length === 0) return;
    const prevHistory = [...history];
    const lastSwiped = prevHistory.pop()!;
    setHistory(prevHistory);
    setProfiles([lastSwiped, ...profiles]);
  };

  const popCard = (direction: 'left' | 'right' | 'up') => {
    setSwipeDirection(direction);
    setTimeout(() => {
      if (profiles.length > 0) {
        const swiped = profiles[0];
        setHistory([...history, swiped]);
        setProfiles(profiles.slice(1));
      }
      setSwipeDirection(null);
      dragX.set(0);
      dragY.set(0);
    }, 200);
  };

  const handleDragEnd = (_event: any, info: any) => {
    const thresholdX = 140;
    const thresholdY = -120;

    if (info.offset.x > thresholdX) {
      handleLike(profiles[0].id);
    } else if (info.offset.x < -thresholdX) {
      handlePass(profiles[0].id);
    } else if (info.offset.y < thresholdY) {
      handleSuperLike(profiles[0].id);
    } else {
      dragX.set(0);
      dragY.set(0);
    }
  };

  // ==========================================
  // PROFILE EDITING
  // ==========================================
  const startEditing = () => {
    if (myProfile) {
      setEditAge(myProfile.age || 25);
      setEditLookingFor(myProfile.looking_for || '');
      setEditRadiusLimit(myProfile.radius_limit || 10);
      setEditBio(myProfile.bio || '');
      setEditInterests(myProfile.interests || []);
      setEditInterestsInput('');
      setProfileError(null);
      setIsEditingProfile(true);
    }
  };

  const handleAddInterest = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const interest = editInterestsInput.trim().replace(/,/g, '');
      if (interest && !editInterests.includes(interest)) {
        setEditInterests([...editInterests, interest]);
      }
      setEditInterestsInput('');
    }
  };

  const handleRemoveInterest = (interest: string) => {
    setEditInterests(editInterests.filter((i) => i !== interest));
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileError(null);
    try {
      const payload = {
        age: editAge,
        looking_for: editLookingFor,
        radius_limit: editRadiusLimit,
        bio: editBio,
        interests: editInterests,
        distance: myProfile?.distance || '3 miles away',
      };

      const res = await fetch('http://localhost:8080/api/v1/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });

      if (res.ok) {
        await fetchProfile();
        setIsEditingProfile(false);
      } else {
        const errData = await res.json();
        setProfileError(errData.detail || 'Could not save your profile.');
      }
    } catch (err) {
      console.error(err);
      setProfileError('Network error — could not save your profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  // ==========================================
  // CHAT
  // ==========================================
  const handleSendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !selectedMatch) return;

    const newMsg = {
      sender: 'me' as const,
      text: chatInput,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChatHistory((prev) => {
      const matchId = selectedMatch.id;
      const log = prev[matchId] || getInitialMessagesForMatch(selectedMatch);
      return { ...prev, [matchId]: [...log, newMsg] };
    });

    setChatInput('');

    // Simulated reply while the chat service is offline
    setTimeout(() => {
      let replyText = 'Sounds good — let me take a look and get back to you.';
      if (selectedMatch.type === 'project') {
        const titleLower = (selectedMatch.projectTitle || '').toLowerCase();
        const techStr = (selectedMatch.projectTech || []).map((t) => t.toLowerCase()).join(' ');

        if (
          titleLower.includes('websocket') ||
          techStr.includes('websocket') ||
          titleLower.includes('scale') ||
          titleLower.includes('scaling')
        ) {
          replyText =
            'Thanks for reaching out! For scaling WebSockets we were considering a Redis pub/sub backplane. What do you think?';
        } else if (techStr.includes('react') || techStr.includes('next.js') || techStr.includes('tailwind')) {
          replyText =
            'Hey, thanks for offering to help. I’m hitting performance bottlenecks during state updates — have you worked with concurrent rendering?';
        } else if (
          techStr.includes('python') ||
          techStr.includes('fastapi') ||
          techStr.includes('sqlite') ||
          techStr.includes('postgresql')
        ) {
          replyText =
            'Appreciate it! We’re running into database connection limits under load with FastAPI. Any suggestions on tuning the pool?';
        } else {
          replyText = `Thanks for helping out! Which part of ${selectedMatch.projectTech?.join(', ') || 'the stack'} do you know best?`;
        }
      }

      const replyMsg = {
        sender: 'them' as const,
        text: replyText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatHistory((prev) => {
        const matchId = selectedMatch.id;
        const log = prev[matchId] || getInitialMessagesForMatch(selectedMatch);
        return { ...prev, [matchId]: [...log, replyMsg] };
      });

      setMatches((prevMatches) =>
        prevMatches.map((m) => (m.id === selectedMatch.id ? { ...m, lastMessage: replyText } : m))
      );
    }, 1500);
  };

  const activeProfile = profiles[0];

  // ==========================================
  // NAV CONFIG
  // ==========================================
  const navItems = [
    { key: 'discover' as const, label: 'Discover', icon: Compass },
    { key: 'matches' as const, label: 'Matches', icon: MessageCircle },
    { key: 'projectHelp' as const, label: 'Project help', icon: Code2 },
    { key: 'profile' as const, label: 'Profile', icon: User },
  ];

  const hasUnread = matches.some((m) => m.unread);

  return (
    <div className="relative min-h-screen w-full flex bg-ink-950 text-fg overflow-hidden">
      <GatewayNetwork />

      {/* ==========================================
          SIDEBAR (desktop)
          ========================================== */}
      <aside
        className={`hidden md:flex flex-col h-screen sticky top-0 border-r border-white/6 bg-ink-950/70 backdrop-blur-sm transition-[width] duration-200 z-20 ${
          sidebarCollapsed ? 'w-[64px]' : 'w-60'
        }`}
      >
        {/* Brand */}
        <div className={`h-14 flex items-center border-b border-white/6 ${sidebarCollapsed ? 'justify-center px-0' : 'justify-between px-4'}`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="brand-mark w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-[13px] font-bold text-white leading-none select-none">Z</span>
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
              className="p-1 rounded-md text-fg-subtle hover:text-fg-muted hover:bg-white/5 transition-colors"
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
            className="mx-auto mt-3 p-1.5 rounded-md text-fg-subtle hover:text-fg-muted hover:bg-white/5 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}

        {/* Nav */}
        <nav className="flex-1 px-2.5 py-4 space-y-0.5">
          {navItems.map(({ key, label, icon: Icon }) => {
            const active = activeTab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                title={sidebarCollapsed ? label : undefined}
                className={`w-full flex items-center gap-2.5 rounded-md text-[13px] font-medium transition-colors relative h-9 ${
                  sidebarCollapsed ? 'justify-center px-0' : 'px-3'
                } ${
                  active ? 'bg-white/6 text-fg' : 'text-fg-muted hover:text-fg hover:bg-white/4'
                }`}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-accent' : ''}`} />
                {!sidebarCollapsed && <span className="truncate">{label}</span>}
                {key === 'matches' && hasUnread && (
                  <span
                    className={`absolute w-1.5 h-1.5 rounded-full bg-accent ${
                      sidebarCollapsed ? 'top-1.5 right-1.5' : 'right-3 top-1/2 -translate-y-1/2'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="border-t border-white/6 p-3">
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
                  className="p-1.5 rounded-md text-fg-subtle hover:text-pass hover:bg-pass/10 transition-colors flex-shrink-0"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* ==========================================
          MOBILE BOTTOM NAV
          ========================================== */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-ink-900/90 backdrop-blur-lg border-t border-white/6 flex justify-around items-center z-30 px-2">
        {navItems.map(({ key, label, icon: Icon }) => {
          const active = activeTab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`relative flex flex-col items-center justify-center gap-1 px-3 py-1 text-[10px] font-medium transition-colors ${
                active ? 'text-accent' : 'text-fg-subtle'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{label}</span>
              {key === 'matches' && hasUnread && (
                <span className="absolute top-0.5 right-2 w-1.5 h-1.5 rounded-full bg-accent" />
              )}
            </button>
          );
        })}
      </nav>

      {/* ==========================================
          MAIN
          ========================================== */}
      <main className="flex-1 flex flex-col min-h-screen pb-16 md:pb-0 z-10 overflow-y-auto">
        {/* ---------- Discover ---------- */}
        {activeTab === 'discover' && (
          <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 w-full">
            {/* Header */}
            <div className="w-full max-w-[380px] flex justify-between items-end mb-5">
              <div>
                <h1 className="text-lg font-semibold tracking-tight text-fg">Discover</h1>
                <p className="text-[13px] text-fg-muted mt-0.5">Developers near you</p>
              </div>
              <span className="mono-label pb-1">{likesCount} liked</span>
            </div>

            {/* Deck */}
            <div className="relative w-full max-w-[380px] aspect-[3/4.2]">
              <AnimatePresence>
                {loadingCandidates ? (
                  <motion.div
                    key="loading-candidates"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 rounded-2xl card flex items-center justify-center z-10"
                  >
                    <Spinner label="loading candidates" />
                  </motion.div>
                ) : activeProfile ? (
                  <motion.div
                    key={activeProfile.id}
                    drag
                    dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                    dragElastic={0.6}
                    onDragEnd={handleDragEnd}
                    style={{ x: dragX, y: dragY, rotate, opacity: cardOpacity }}
                    animate={
                      swipeDirection === 'right'
                        ? { x: 400, opacity: 0, scale: 0.96 }
                        : swipeDirection === 'left'
                        ? { x: -400, opacity: 0, scale: 0.96 }
                        : swipeDirection === 'up'
                        ? { y: -450, opacity: 0, scale: 0.96 }
                        : { x: 0, y: 0, opacity: 1, scale: 1 }
                    }
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    className="absolute inset-0 rounded-2xl overflow-hidden card cursor-grab active:cursor-grabbing flex flex-col z-10"
                  >
                    {/* Swipe verdict stamps */}
                    <motion.div
                      style={{ opacity: likeOpacity }}
                      className="absolute top-6 left-6 -rotate-6 px-3 py-1 border-2 border-like text-like rounded-md font-bold text-lg tracking-widest uppercase z-30 pointer-events-none"
                    >
                      Like
                    </motion.div>
                    <motion.div
                      style={{ opacity: passOpacity }}
                      className="absolute top-6 right-6 rotate-6 px-3 py-1 border-2 border-pass text-pass rounded-md font-bold text-lg tracking-widest uppercase z-30 pointer-events-none"
                    >
                      Pass
                    </motion.div>
                    <motion.div
                      style={{ opacity: superLikeOpacity }}
                      className="absolute bottom-36 left-1/2 -translate-x-1/2 -rotate-3 px-4 py-1 border-2 border-super text-super rounded-md font-bold text-lg tracking-widest uppercase z-30 pointer-events-none whitespace-nowrap"
                    >
                      Super like
                    </motion.div>

                    {/* Photo */}
                    <div className="relative flex-1 bg-ink-850 overflow-hidden">
                      <img
                        src={activeProfile.image}
                        alt={activeProfile.name}
                        draggable={false}
                        className="w-full h-full object-cover select-none pointer-events-none"
                      />
                      <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-ink-900 to-transparent" />
                      <div className="absolute top-3.5 right-3.5 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-ink-950/60 backdrop-blur-md border border-white/10">
                        <MapPin className="w-3 h-3 text-fg-muted" />
                        <span className="mono-label !text-fg-muted">{activeProfile.distance}</span>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="p-5 bg-ink-900 border-t border-white/6">
                      <div className="flex items-baseline gap-2">
                        <h2 className="text-xl font-semibold tracking-tight text-fg">{activeProfile.name}</h2>
                        <span className="text-lg text-fg-muted font-normal">{activeProfile.age}</span>
                      </div>
                      <p className="mt-2 text-[13px] text-fg-muted leading-relaxed line-clamp-3">
                        {activeProfile.bio}
                      </p>
                      {activeProfile.interests.length > 0 && (
                        <div className="mt-3.5 flex flex-wrap gap-1.5">
                          {activeProfile.interests.slice(0, 5).map((interest, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded-md text-[11px] font-mono text-fg-muted bg-white/4 border border-white/6"
                            >
                              {interest}
                            </span>
                          ))}
                          {activeProfile.interests.length > 5 && (
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-mono text-fg-subtle">
                              +{activeProfile.interests.length - 5}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute inset-0 rounded-2xl card flex flex-col items-center justify-center p-8 text-center z-0"
                  >
                    <div className="w-12 h-12 rounded-full bg-white/4 border border-white/8 flex items-center justify-center mb-5">
                      <Compass className="w-5 h-5 text-fg-subtle" />
                    </div>
                    <h3 className="text-base font-semibold text-fg mb-1.5">You’re all caught up</h3>
                    <p className="text-[13px] text-fg-muted max-w-[240px] leading-relaxed">
                      No more profiles to review right now. Check back soon.
                    </p>
                    <button
                      type="button"
                      onClick={fetchCandidates}
                      className="btn-ghost mt-6 px-4 py-2 rounded-lg text-[13px]"
                    >
                      Check again
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Actions */}
            <div className="w-full max-w-[380px] flex justify-center items-center gap-4 mt-6">
              <motion.button
                type="button"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.94 }}
                onClick={handleRewind}
                disabled={history.length === 0}
                title="Undo last swipe"
                className="w-10 h-10 rounded-full border border-white/8 bg-ink-900 flex items-center justify-center text-fg-subtle hover:text-fg-muted hover:border-white/15 disabled:opacity-35 disabled:pointer-events-none transition-colors"
              >
                <Undo2 className="w-4 h-4" />
              </motion.button>

              <motion.button
                type="button"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.94 }}
                onClick={() => activeProfile && handlePass(activeProfile.id)}
                disabled={!activeProfile}
                title="Pass"
                className="w-13 h-13 rounded-full border border-pass/25 bg-ink-900 flex items-center justify-center text-pass hover:bg-pass/10 hover:border-pass/40 disabled:opacity-35 disabled:pointer-events-none transition-colors"
              >
                <X className="w-5.5 h-5.5" />
              </motion.button>

              <motion.button
                type="button"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.94 }}
                onClick={() => activeProfile && handleSuperLike(activeProfile.id)}
                disabled={!activeProfile}
                title="Super like"
                className="w-10 h-10 rounded-full border border-super/25 bg-ink-900 flex items-center justify-center text-super hover:bg-super/10 hover:border-super/40 disabled:opacity-35 disabled:pointer-events-none transition-colors"
              >
                <Star className="w-4 h-4" />
              </motion.button>

              <motion.button
                type="button"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.94 }}
                onClick={() => activeProfile && handleLike(activeProfile.id)}
                disabled={!activeProfile}
                title="Like"
                className="w-13 h-13 rounded-full border border-like/25 bg-ink-900 flex items-center justify-center text-like hover:bg-like/10 hover:border-like/40 disabled:opacity-35 disabled:pointer-events-none transition-colors"
              >
                <Heart className="w-5.5 h-5.5 fill-current" />
              </motion.button>
            </div>

            {/* Match modal */}
            <AnimatePresence>
              {showMatchModal && matchModalData && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/85 backdrop-blur-md"
                >
                  <motion.div
                    initial={{ scale: 0.95, y: 12 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.95, y: 12 }}
                    transition={{ type: 'spring', damping: 26, stiffness: 300 }}
                    className="relative w-full max-w-sm card rounded-2xl p-8 text-center"
                  >
                    <p className="mono-label mb-3">mutual like</p>
                    <h1 className="text-[28px] font-semibold tracking-tight text-gradient-brand mb-2">
                      It’s a match
                    </h1>
                    <p className="text-sm text-fg-muted mb-8">
                      You and <span className="text-fg font-medium">{matchModalData.name}</span> liked each
                      other.
                    </p>

                    <div className="flex items-center justify-center gap-5 mb-8">
                      <div className="w-18 h-18 rounded-full p-[2px] bg-gradient-to-br from-accent to-brand-violet">
                        <div className="w-full h-full rounded-full bg-ink-900 flex items-center justify-center font-semibold text-lg text-fg-muted">
                          {myProfile ? getInitials(myProfile.user.name) : 'ME'}
                        </div>
                      </div>
                      <Heart className="w-5 h-5 text-accent fill-current flex-shrink-0" />
                      <div className="w-18 h-18 rounded-full p-[2px] bg-gradient-to-br from-brand-violet to-accent">
                        <div className="w-full h-full rounded-full bg-ink-900 overflow-hidden">
                          <img
                            src={matchModalData.avatar}
                            alt={matchModalData.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2.5">
                      <button
                        type="button"
                        onClick={handleSendMessageFromModal}
                        className="btn-primary w-full py-2.5 rounded-lg text-sm"
                      >
                        Send a message
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowMatchModal(false)}
                        className="btn-ghost w-full py-2.5 rounded-lg text-sm"
                      >
                        Keep browsing
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ---------- Matches ---------- */}
        {activeTab === 'matches' && (
          <div className="flex-1 flex md:h-screen">
            {/* Match list */}
            <div
              className={`w-full md:w-[320px] md:border-r border-white/6 flex-col bg-ink-950/40 ${
                selectedMatch ? 'hidden md:flex' : 'flex'
              }`}
            >
              <div className="h-14 px-5 flex items-center justify-between border-b border-white/6 flex-shrink-0">
                <h2 className="text-[15px] font-semibold tracking-tight text-fg">Matches</h2>
                <span className="mono-label">{matches.length}</span>
              </div>

              <div className="flex-1 overflow-y-auto p-2.5 space-y-0.5">
                {loadingMatches ? (
                  <Spinner label="loading matches" />
                ) : matches.length > 0 ? (
                  matches.map((match) => (
                    <button
                      key={match.id}
                      type="button"
                      onClick={() => {
                        setSelectedMatch(match);
                        setMatches(matches.map((m) => (m.id === match.id ? { ...m, unread: false } : m)));
                      }}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-lg transition-colors text-left ${
                        selectedMatch?.id === match.id ? 'bg-white/6' : 'hover:bg-white/4'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full overflow-hidden border border-white/8 flex-shrink-0">
                        <img src={match.avatar} alt={match.name} className="w-full h-full object-cover" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline gap-2">
                          <span className="text-[13px] font-medium text-fg truncate flex items-center gap-1.5">
                            {match.name}
                            {match.type === 'project' && (
                              <span className="px-1.5 py-px rounded bg-super/10 text-super text-[10px] font-mono flex-shrink-0">
                                project
                              </span>
                            )}
                          </span>
                          <span className="mono-label flex-shrink-0">{match.time}</span>
                        </div>
                        <p
                          className={`text-xs truncate mt-0.5 ${
                            match.unread ? 'text-fg font-medium' : 'text-fg-subtle'
                          }`}
                        >
                          {match.lastMessage}
                        </p>
                      </div>

                      {match.unread && <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />}
                    </button>
                  ))
                ) : (
                  <div className="text-center py-14 px-6">
                    <p className="text-[13px] text-fg-muted">No matches yet.</p>
                    <p className="text-xs text-fg-subtle mt-1">Like a few profiles to get started.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Conversation */}
            <div className={`flex-1 flex-col bg-ink-950/20 ${selectedMatch ? 'flex' : 'hidden md:flex'}`}>
              {selectedMatch ? (
                <>
                  <div className="h-14 px-4 md:px-5 border-b border-white/6 flex items-center justify-between flex-shrink-0 bg-ink-950/40">
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        type="button"
                        onClick={() => setSelectedMatch(null)}
                        aria-label="Back to matches"
                        className="md:hidden p-1.5 -ml-1.5 rounded-md text-fg-subtle hover:text-fg transition-colors"
                      >
                        <ChevronLeft className="w-4.5 h-4.5" />
                      </button>
                      <div className="w-8 h-8 rounded-full overflow-hidden border border-white/8 flex-shrink-0">
                        <img
                          src={selectedMatch.avatar}
                          alt={selectedMatch.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-[13px] font-medium text-fg truncate leading-tight">
                          {selectedMatch.name}
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
                      className="hidden md:block p-1.5 rounded-md text-fg-subtle hover:text-fg hover:bg-white/5 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto px-4 md:px-6 py-5 space-y-3">
                    {currentMessages.length === 0 && (
                      <div className="h-full flex flex-col items-center justify-center text-center">
                        <div className="w-12 h-12 rounded-full overflow-hidden border border-white/8 mb-3">
                          <img
                            src={selectedMatch.avatar}
                            alt={selectedMatch.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <p className="text-[13px] text-fg-muted">
                          You matched with <span className="text-fg font-medium">{selectedMatch.name}</span>
                        </p>
                        <p className="text-xs text-fg-subtle mt-1">Say hi and start the conversation.</p>
                      </div>
                    )}

                    {currentMessages.map((msg, idx) => {
                      const isSystemBrief = msg.text.startsWith('[SYSTEM: PROJECT BRIEF]');
                      if (isSystemBrief) {
                        const titleLine = msg.text.split('\n')[1] || '';
                        const stackLine = msg.text.split('\n')[2] || '';
                        const descLines = msg.text.split('\n').slice(4).join('\n') || '';

                        return (
                          <div key={idx} className="w-full flex justify-center py-2">
                            <div className="w-full max-w-md card rounded-xl p-4 space-y-2.5">
                              <div className="flex items-center justify-between border-b border-white/6 pb-2">
                                <span className="mono-label !text-accent">project brief</span>
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
                          </div>
                        );
                      }

                      return (
                        <div key={idx} className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={`max-w-[75%] px-3.5 py-2.5 text-sm leading-relaxed ${
                              msg.sender === 'me'
                                ? 'bg-accent text-[#053b34] rounded-2xl rounded-br-md font-medium'
                                : 'bg-white/6 border border-white/6 text-fg rounded-2xl rounded-bl-md'
                            }`}
                          >
                            <p className="whitespace-pre-wrap">{msg.text}</p>
                            <span
                              className={`block text-right mt-1 text-[10px] font-mono ${
                                msg.sender === 'me' ? 'text-[#053b34]/60' : 'text-fg-subtle'
                              }`}
                            >
                              {msg.time}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Composer */}
                  <form
                    onSubmit={handleSendChatMessage}
                    className="p-3.5 border-t border-white/6 bg-ink-950/40 flex-shrink-0"
                  >
                    <div className="field flex items-center gap-2 pl-3.5 pr-1.5 py-1.5">
                      <input
                        type="text"
                        placeholder={`Message ${selectedMatch.name}`}
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        className="flex-1 bg-transparent text-sm text-fg placeholder-fg-subtle focus:outline-none border-none"
                      />
                      <button
                        type="submit"
                        disabled={!chatInput.trim()}
                        aria-label="Send message"
                        className="p-2 rounded-md bg-accent text-ink-950 hover:bg-accent-bright disabled:opacity-35 disabled:pointer-events-none transition-colors"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-white/4 border border-white/8 flex items-center justify-center mb-4 text-fg-subtle">
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

        {/* ---------- Profile ---------- */}
        {activeTab === 'profile' && (
          <div className="flex-1 flex justify-center p-4 md:p-10 overflow-y-auto">
            {loadingProfile ? (
              <div className="self-center">
                <Spinner label="loading profile" />
              </div>
            ) : myProfile ? (
              isEditingProfile ? (
                <form
                  onSubmit={handleSaveProfile}
                  className="w-full max-w-xl card rounded-2xl p-6 md:p-8 space-y-5 self-start animate-fade-up"
                >
                  <div className="border-b border-white/6 pb-4">
                    <h2 className="text-lg font-semibold tracking-tight text-fg">Edit profile</h2>
                    <p className="text-[13px] text-fg-muted mt-1">
                      What other developers see when you show up in Discover.
                    </p>
                  </div>

                  {profileError && (
                    <div className="px-3.5 py-3 rounded-lg bg-pass/8 border border-pass/20 text-pass text-[13px]">
                      {profileError}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label htmlFor="editAge" className="block text-[13px] font-medium text-fg-muted">
                        Age
                      </label>
                      <input
                        id="editAge"
                        type="number"
                        min={18}
                        max={120}
                        value={editAge}
                        onChange={(e) => setEditAge(parseInt(e.target.value) || 18)}
                        className="field w-full px-3.5 py-2.5 text-sm text-fg focus:outline-none"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="editRadiusLimit" className="block text-[13px] font-medium text-fg-muted">
                        Radius (miles)
                      </label>
                      <input
                        id="editRadiusLimit"
                        type="number"
                        min={0}
                        value={editRadiusLimit}
                        onChange={(e) => setEditRadiusLimit(parseInt(e.target.value) || 0)}
                        className="field w-full px-3.5 py-2.5 text-sm text-fg focus:outline-none"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="editLookingFor" className="block text-[13px] font-medium text-fg-muted">
                      Looking for
                    </label>
                    <input
                      id="editLookingFor"
                      type="text"
                      placeholder="Backend partner, co-founder, code reviews…"
                      value={editLookingFor}
                      onChange={(e) => setEditLookingFor(e.target.value)}
                      className="field w-full px-3.5 py-2.5 text-sm text-fg placeholder-fg-subtle focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="editBio" className="block text-[13px] font-medium text-fg-muted">
                      Bio
                    </label>
                    <textarea
                      id="editBio"
                      rows={3}
                      placeholder="What you build, what you’re into, what you’re looking for."
                      value={editBio}
                      onChange={(e) => setEditBio(e.target.value)}
                      className="field w-full px-3.5 py-2.5 text-sm text-fg placeholder-fg-subtle focus:outline-none resize-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="editInterests" className="block text-[13px] font-medium text-fg-muted">
                      Stack & interests
                    </label>
                    {editInterests.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pb-1">
                        {editInterests.map((interest, idx) => (
                          <span
                            key={idx}
                            className="pl-2 pr-1 py-0.5 rounded-md bg-white/5 border border-white/8 text-xs font-mono text-fg-muted flex items-center gap-1"
                          >
                            {interest}
                            <button
                              type="button"
                              onClick={() => handleRemoveInterest(interest)}
                              aria-label={`Remove ${interest}`}
                              className="p-0.5 rounded text-fg-subtle hover:text-pass transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <input
                      id="editInterests"
                      type="text"
                      placeholder="Type and press Enter to add"
                      value={editInterestsInput}
                      onChange={(e) => setEditInterestsInput(e.target.value)}
                      onKeyDown={handleAddInterest}
                      className="field w-full px-3.5 py-2.5 text-sm text-fg placeholder-fg-subtle focus:outline-none"
                    />
                  </div>

                  <div className="pt-2 flex gap-3">
                    <button
                      type="submit"
                      disabled={savingProfile}
                      className="btn-primary flex-1 py-2.5 rounded-lg text-sm flex items-center justify-center gap-2"
                    >
                      {savingProfile && <Loader2 className="w-4 h-4 animate-spin" />}
                      <span>{savingProfile ? 'Saving…' : 'Save changes'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingProfile(false)}
                      className="btn-ghost flex-1 py-2.5 rounded-lg text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="w-full max-w-xl card rounded-2xl p-6 md:p-8 self-start animate-fade-up">
                  {/* Identity */}
                  <div className="flex items-center gap-4 border-b border-white/6 pb-6">
                    <div className="w-14 h-14 rounded-full p-[2px] bg-gradient-to-br from-accent to-brand-violet flex-shrink-0">
                      <div className="w-full h-full rounded-full bg-ink-900 flex items-center justify-center font-semibold text-base text-fg">
                        {getInitials(myProfile.user.name)}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-lg font-semibold tracking-tight text-fg truncate">
                        {myProfile.user.name}
                      </h2>
                      <p className="mono-label truncate mt-0.5">{myProfile.user.email}</p>
                    </div>
                  </div>

                  <div className="mt-6 space-y-6">
                    {/* Preferences */}
                    <div>
                      <h3 className="text-[13px] font-medium text-fg-muted mb-2.5">Preferences</h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3.5 rounded-lg bg-white/3 border border-white/6">
                          <p className="mono-label mb-1">looking for</p>
                          <p className="text-sm font-medium text-fg">
                            {myProfile.looking_for || 'Not set'}
                          </p>
                        </div>
                        <div className="p-3.5 rounded-lg bg-white/3 border border-white/6">
                          <p className="mono-label mb-1">radius</p>
                          <p className="text-sm font-medium text-fg">
                            {myProfile.radius_limit !== null ? `${myProfile.radius_limit} miles` : 'Not set'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Bio */}
                    <div>
                      <h3 className="text-[13px] font-medium text-fg-muted mb-2.5">Bio</h3>
                      <p className="text-sm text-fg leading-relaxed">
                        {myProfile.bio || <span className="text-fg-subtle">No bio yet.</span>}
                      </p>
                    </div>

                    {/* Stack */}
                    <div>
                      <h3 className="text-[13px] font-medium text-fg-muted mb-2.5">Stack & interests</h3>
                      <div className="flex flex-wrap gap-1.5">
                        {myProfile.interests && myProfile.interests.length > 0 ? (
                          myProfile.interests.map((interest: string, idx: number) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded-md text-xs font-mono text-fg-muted bg-white/4 border border-white/6"
                            >
                              {interest}
                            </span>
                          ))
                        ) : (
                          <span className="text-[13px] text-fg-subtle">Nothing added yet.</span>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-3 border-t border-white/6 mt-2 pt-6">
                      <button type="button" onClick={startEditing} className="btn-ghost flex-1 py-2.5 rounded-lg text-sm">
                        Edit profile
                      </button>
                      <button
                        type="button"
                        onClick={onLogout}
                        className="flex-1 py-2.5 rounded-lg text-sm font-medium text-pass bg-pass/8 border border-pass/15 hover:bg-pass/15 transition-colors"
                      >
                        Sign out
                      </button>
                    </div>
                  </div>
                </div>
              )
            ) : (
              <div className="self-center text-center card rounded-2xl p-8 max-w-sm">
                <p className="text-sm text-fg-muted">Couldn’t load your profile.</p>
                <button type="button" onClick={fetchProfile} className="btn-ghost mt-4 px-4 py-2 rounded-lg text-[13px]">
                  Try again
                </button>
              </div>
            )}
          </div>
        )}

        {/* ---------- Project help ---------- */}
        {activeTab === 'projectHelp' && (
          <div className="flex-1 flex flex-col items-center p-4 md:p-10 w-full">
            <div className="w-full max-w-2xl">
              {/* Header */}
              <div className="flex justify-between items-end mb-6">
                <div>
                  <h1 className="text-lg font-semibold tracking-tight text-fg">Project help</h1>
                  <p className="text-[13px] text-fg-muted mt-0.5">
                    Get unblocked by other developers — or lend a hand.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormExpanded(!formExpanded)}
                  className={`${formExpanded ? 'btn-ghost' : 'btn-primary'} flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] flex-shrink-0`}
                >
                  {formExpanded ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>{formExpanded ? 'Close' : 'New request'}</span>
                </button>
              </div>

              {/* New request form */}
              <AnimatePresence>
                {formExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                    animate={{ opacity: 1, height: 'auto', marginBottom: 20 }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    className="w-full overflow-hidden"
                  >
                    <form onSubmit={handlePostProject} className="w-full card rounded-xl p-5 space-y-4">
                      {formError && (
                        <div className="px-3.5 py-2.5 rounded-lg bg-pass/8 border border-pass/20 text-pass text-[13px]">
                          {formError}
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <label htmlFor="projTitle" className="block text-[13px] font-medium text-fg-muted">
                          Title
                        </label>
                        <input
                          id="projTitle"
                          type="text"
                          placeholder="Memory leak in a React custom hook"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          className="field w-full px-3.5 py-2.5 text-sm text-fg placeholder-fg-subtle focus:outline-none"
                          required
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label htmlFor="projDesc" className="block text-[13px] font-medium text-fg-muted">
                          Description
                        </label>
                        <textarea
                          id="projDesc"
                          rows={4}
                          placeholder="What you’re building, where you’re stuck, and what kind of help you need."
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          className="field w-full px-3.5 py-2.5 text-sm text-fg placeholder-fg-subtle focus:outline-none resize-none"
                          required
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label htmlFor="projStack" className="block text-[13px] font-medium text-fg-muted">
                          Tech stack
                        </label>
                        {techStack.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pb-1">
                            {techStack.map((tech, idx) => (
                              <span
                                key={idx}
                                className="pl-2 pr-1 py-0.5 rounded-md bg-white/5 border border-white/8 text-xs font-mono text-fg-muted flex items-center gap-1"
                              >
                                {tech}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveTech(tech)}
                                  aria-label={`Remove ${tech}`}
                                  className="p-0.5 rounded text-fg-subtle hover:text-pass transition-colors"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                        <input
                          id="projStack"
                          type="text"
                          placeholder="Type and press Enter to add — React, FastAPI, Postgres…"
                          value={techStackInput}
                          onChange={(e) => setTechStackInput(e.target.value)}
                          onKeyDown={handleAddTech}
                          className="field w-full px-3.5 py-2.5 text-sm text-fg placeholder-fg-subtle focus:outline-none"
                        />
                      </div>

                      <div className="pt-1 flex justify-end gap-2.5">
                        <button
                          type="button"
                          onClick={() => {
                            setTitle('');
                            setDescription('');
                            setTechStack([]);
                            setFormError(null);
                            setFormExpanded(false);
                          }}
                          className="btn-ghost px-4 py-2 rounded-lg text-[13px]"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={submittingProject}
                          className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg text-[13px]"
                        >
                          {submittingProject && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          <span>{submittingProject ? 'Publishing…' : 'Publish request'}</span>
                        </button>
                      </div>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Feed */}
              {loadingProjects ? (
                <Spinner label="loading requests" />
              ) : projects.length > 0 ? (
                <div className="space-y-3">
                  {projects.map((proj: any) => (
                    <div key={proj.id} className="card card-hover rounded-xl p-5">
                      {/* Poster */}
                      <div className="flex items-center justify-between mb-3.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar initials={getInitials(proj.user_name || 'Anonymous')} size="w-8 h-8 text-[11px]" />
                          <div>
                            <p className="text-[13px] font-medium text-fg leading-tight">
                              {proj.user_name || 'Anonymous'}
                            </p>
                            <p className="mono-label leading-tight mt-0.5">
                              {new Date(proj.timestamp).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Body */}
                      <h2 className="text-[15px] font-semibold tracking-tight text-fg mb-1.5">{proj.title}</h2>
                      <p className="text-[13px] text-fg-muted leading-relaxed whitespace-pre-wrap">
                        {proj.description}
                      </p>

                      {/* Footer */}
                      <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t border-white/6">
                        <div className="flex flex-wrap gap-1.5">
                          {proj.tech_stack.map((tech: string, idx: number) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded-md text-[11px] font-mono text-fg-muted bg-white/4 border border-white/6"
                            >
                              {tech}
                            </span>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            const projectHelpId = `project_help_${proj.id}`;
                            const projectMatchItem: Match = {
                              id: projectHelpId,
                              name: proj.user_name || 'Anonymous',
                              avatar: '/profile_3.png',
                              lastMessage: `Help request: ${proj.title}`,
                              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                              unread: true,
                              type: 'project',
                              projectTitle: proj.title,
                              projectDesc: proj.description,
                              projectTech: proj.tech_stack,
                            };

                            setMatches((prev) => {
                              if (prev.some((m) => m.id === projectHelpId)) {
                                return prev;
                              }
                              return [projectMatchItem, ...prev];
                            });

                            setSelectedMatch(projectMatchItem);
                            setActiveTab('matches');
                          }}
                          className="btn-ghost px-3.5 py-1.5 rounded-lg text-xs hover:!text-accent hover:!border-accent/30"
                        >
                          Offer help
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="card rounded-xl p-12 text-center flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-white/4 border border-white/8 flex items-center justify-center mb-4">
                    <Code2 className="w-5 h-5 text-fg-subtle" />
                  </div>
                  <h3 className="text-base font-semibold text-fg">No requests yet</h3>
                  <p className="text-[13px] text-fg-muted mt-1.5 max-w-xs">
                    Be the first to ask for a code review, debugging help, or a collaborator.
                  </p>
                  <button
                    type="button"
                    onClick={() => setFormExpanded(true)}
                    className="btn-primary mt-6 px-4 py-2 rounded-lg text-[13px]"
                  >
                    Create a request
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
