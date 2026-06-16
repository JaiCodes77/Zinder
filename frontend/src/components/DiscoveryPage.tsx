import React, { useState } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { 
  Sparkles, 
  Heart, 
  X, 
  RotateCcw, 
  Star, 
  MessageSquare, 
  User, 
  Compass, 
  LogOut, 
  MapPin, 
  Info,
  ChevronLeft,
  ChevronRight,
  Send,
  Zap,
  Activity,
  Code2,
  Plus,
  Loader2
} from 'lucide-react';
import { GatewayNetwork } from './GatewayNetwork';

// ==========================================
// MOCK DATA TYPES & INTERFACES
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
  id: number;
  name: string;
  avatar: string;
  lastMessage: string;
  time: string;
  unread: boolean;
}

const INITIAL_PROFILES: Profile[] = [
  {
    id: 1,
    name: 'Sophia',
    age: 26,
    distance: '4 miles away',
    bio: 'Backend developer who loves building high-performance systems. Looking for someone to debug life with. ☕️💻',
    image: '/profile_1.png',
    interests: ['Tech', 'Coffee', 'Hiking', 'System Design']
  },
  {
    id: 2,
    name: 'Ethan',
    age: 28,
    distance: '12 miles away',
    bio: 'Product designer obsessed with minimalist designs and micro-animations. Let\'s make something beautiful.',
    image: '/profile_2.png',
    interests: ['Design', 'Music', 'Fitness', 'Travel']
  },
  {
    id: 3,
    name: 'Olivia',
    age: 24,
    distance: '7 miles away',
    bio: 'Outdoors enthusiast, amateur chef, and running addict. Always searching for the next adventure.',
    image: '/profile_3.png',
    interests: ['Fitness', 'Food', 'Outdoors', 'Photography']
  }
];

const MOCK_MATCHES: Match[] = [
  { id: 1, name: 'Sophia', avatar: '/profile_1.png', lastMessage: 'Hey! Are you using REST or gRPC? 🔌', time: '5m ago', unread: true },
  { id: 3, name: 'Olivia', avatar: '/profile_3.png', lastMessage: 'That hiking trail was amazing!', time: '2h ago', unread: false }
];

interface DiscoveryPageProps {
  onLogout: () => void;
}

export const DiscoveryPage: React.FC<DiscoveryPageProps> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState<'discover' | 'matches' | 'profile' | 'projectHelp'>('discover');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  
  // Authenticated User Profile & Projects States
  const [myProfile, setMyProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState<boolean>(true);
  const [projects, setProjects] = useState<any[]>([]);
  const [loadingProjects, setLoadingProjects] = useState<boolean>(false);

  // Help Request Form States
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [techStackInput, setTechStackInput] = useState('');
  const [techStack, setTechStack] = useState<string[]>([]);
  const [submittingProject, setSubmittingProject] = useState(false);
  const [formExpanded, setFormExpanded] = useState(false);

  // Helper function to extract initials
  const getInitials = (name: string) => {
    if (!name) return '??';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Fetch functions
  const fetchProfile = async () => {
    try {
      setLoadingProfile(true);
      const res = await fetch('http://localhost:8080/api/v1/profiles/me', {
        credentials: 'include'
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
        credentials: 'include'
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

  // Tech stack interactive tag handlers
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
    setTechStack(techStack.filter(t => t !== tag));
  };

  const handlePostProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || techStack.length === 0) {
      alert("Please fill in all fields and add at least one tech stack badge.");
      return;
    }
    setSubmittingProject(true);
    try {
      const res = await fetch('http://localhost:8080/api/v1/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          tech_stack: techStack
        }),
        credentials: 'include'
      });
      if (res.ok) {
        setTitle('');
        setDescription('');
        setTechStack([]);
        setFormExpanded(false);
        fetchProjects(); // Reload feed
      } else {
        const errData = await res.json();
        alert(errData.detail || "Failed to post request.");
      }
    } catch (err) {
      console.error(err);
      alert("Network error. Could not post request.");
    } finally {
      setSubmittingProject(false);
    }
  };

  // Fetch data on mount / tab change
  React.useEffect(() => {
    fetchProfile();
  }, []);

  React.useEffect(() => {
    if (activeTab === 'projectHelp') {
      fetchProjects();
    }
  }, [activeTab]);

  // Matcher Deck States
  const [profiles, setProfiles] = useState<Profile[]>(INITIAL_PROFILES);
  const [history, setHistory] = useState<Profile[]>([]);
  const [likesCount, setLikesCount] = useState<number>(0);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | 'up' | null>(null);

  // Chat / Messages States
  const [matches, setMatches] = useState<Match[]>(MOCK_MATCHES);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'me' | 'them'; text: string; time: string }>>([
    { sender: 'them', text: 'Hey there! Saw you also like distributed systems.', time: '10:42 AM' },
    { sender: 'me', text: 'Yes! Zinder is built entirely on microservices.', time: '10:43 AM' },
    { sender: 'them', text: 'Hey! Are you using REST or gRPC? 🔌', time: '10:44 AM' }
  ]);

  // Framer Motion values for drag gestures
  const dragX = useMotionValue(0);
  const dragY = useMotionValue(0);
  
  // Transform drag values into rotation & opacity values
  const rotate = useTransform(dragX, [-200, 200], [-25, 25]);
  const cardOpacity = useTransform(dragX, [-200, -150, 0, 150, 200], [0.5, 0.9, 1, 0.9, 0.5]);
  
  const likeOpacity = useTransform(dragX, [0, 120], [0, 1]);
  const passOpacity = useTransform(dragX, [-120, 0], [1, 0]);
  const superLikeOpacity = useTransform(dragY, [-120, 0], [1, 0]);

  // ==========================================
  // MICROSERVICE INTERACTION HOOKS (PLACEHOLDERS)
  // ==========================================
  const handleLike = (userId: number) => {
    /*
      =======================================================
      MICROSERVICES ARCHITECTURE INTEGRATION HOOK:
      -------------------------------------------------------
      ENDPOINT: POST gateway.zinder.internal/api/v1/matcher/like
      BODY: { targetUserId: userId, action: 'LIKE' }
      HEADERS: Authorization: Bearer <sessionToken>
      
      MICROSERVICE WORKFLOW:
      1. Dispatches event to Kafka topic 'user-swipes'.
      2. Matcher Service processes the event and checks Redis for a reciprocal LIKE.
      3. If mutual, creates a match in DB, generates a Chat Room, and publishes 'match-found' event.
      4. Push Notification Service triggers an alert on the socket gateway.
      =======================================================
    */
    console.log(`[Microservice Dispatch] Action: LIKE, TargetUserId: ${userId}`);
    
    // UI update
    setLikesCount((prev) => prev + 1);
    popCard('right');
  };

  const handlePass = (userId: number) => {
    /*
      =======================================================
      MICROSERVICES ARCHITECTURE INTEGRATION HOOK:
      -------------------------------------------------------
      ENDPOINT: POST gateway.zinder.internal/api/v1/matcher/pass
      BODY: { targetUserId: userId, action: 'PASS' }
      HEADERS: Authorization: Bearer <sessionToken>
      =======================================================
    */
    console.log(`[Microservice Dispatch] Action: PASS, TargetUserId: ${userId}`);
    popCard('left');
  };

  const handleSuperLike = (userId: number) => {
    /*
      =======================================================
      MICROSERVICES ARCHITECTURE INTEGRATION HOOK:
      -------------------------------------------------------
      ENDPOINT: POST gateway.zinder.internal/api/v1/matcher/superlike
      BODY: { targetUserId: userId, action: 'SUPERLIKE' }
      HEADERS: Authorization: Bearer <sessionToken>
      =======================================================
    */
    console.log(`[Microservice Dispatch] Action: SUPERLIKE, TargetUserId: ${userId}`);
    popCard('up');
  };

  const handleRewind = () => {
    /*
      =======================================================
      MICROSERVICES ARCHITECTURE INTEGRATION HOOK:
      -------------------------------------------------------
      ENDPOINT: POST gateway.zinder.internal/api/v1/matcher/rewind
      HEADERS: Authorization: Bearer <sessionToken>
      =======================================================
    */
    if (history.length === 0) return;
    console.log(`[Microservice Dispatch] Action: REWIND`);
    
    const prevHistory = [...history];
    const lastSwiped = prevHistory.pop()!;
    setHistory(prevHistory);
    setProfiles([lastSwiped, ...profiles]);
  };

  const popCard = (direction: 'left' | 'right' | 'up') => {
    setSwipeDirection(direction);
    // Timeout to match exiting transition duration
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

  // Drag Release Logic
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
      // Snaps back
      dragX.set(0);
      dragY.set(0);
    }
  };

  const handleSendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    setChatMessages((prev) => [
      ...prev,
      { sender: 'me', text: chatInput, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
    ]);
    setChatInput('');

    // Simulate reply after 1.5s
    setTimeout(() => {
      setChatMessages((prev) => [
        ...prev,
        { sender: 'them', text: 'Gateway ping successful. Reply buffered! 🤖', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
      ]);
    }, 1500);
  };

  // Profile Card Component
  const activeProfile = profiles[0];

  return (
    <div className="relative min-h-screen w-full flex bg-[#070b12] text-zinc-100 overflow-hidden select-none">
      
      {/* Background Animated Layer */}
      <GatewayNetwork />
      
      {/* Ambient Gradient Orbs */}
      <div className="absolute top-[10%] left-[25%] w-80 h-80 rounded-full bg-brand-teal/5 blur-[100px] pointer-events-none z-0 animate-pulse-slow" />
      <div className="absolute bottom-[10%] right-[25%] w-96 h-96 rounded-full bg-brand-magenta/5 blur-[120px] pointer-events-none z-0 animate-pulse-slow [animation-delay:3s]" />

      {/* ==========================================
          DESKTOP SIDEBAR NAVIGATION
          ========================================== */}
      <aside className={`hidden md:flex flex-col h-screen glass-card border-r border-white/5 transition-all duration-300 z-20 ${
        sidebarCollapsed ? 'w-20' : 'w-64'
      }`}>
        {/* Brand Header */}
        <div className="p-6 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-purple to-brand-magenta p-[2px] flex items-center justify-center flex-shrink-0">
              <div className="w-full h-full bg-[#0a0f1e] rounded-xl flex items-center justify-center">
                <Sparkles className="w-4.5 h-4.5 text-white" />
              </div>
            </div>
            {!sidebarCollapsed && (
              <span className="font-extrabold text-lg tracking-wider bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                ZINDER
              </span>
            )}
          </div>
          <button 
            type="button"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition-colors"
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 px-3 py-6 space-y-2">
          <button
            type="button"
            onClick={() => setActiveTab('discover')}
            className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'discover' 
                ? 'bg-gradient-to-r from-brand-teal/15 to-brand-purple/15 text-brand-teal border border-brand-teal/20' 
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5 border border-transparent'
            }`}
          >
            <Compass className="w-5 h-5 flex-shrink-0" />
            {!sidebarCollapsed && <span>Discover</span>}
          </button>
          
          <button
            type="button"
            onClick={() => setActiveTab('matches')}
            className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-sm font-medium transition-all relative ${
              activeTab === 'matches' 
                ? 'bg-gradient-to-r from-brand-purple/15 to-brand-magenta/15 text-brand-magenta border border-brand-magenta/20' 
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5 border border-transparent'
            }`}
          >
            <MessageSquare className="w-5 h-5 flex-shrink-0" />
            {!sidebarCollapsed && (
              <>
                <span>Matches</span>
                {matches.some(m => m.unread) && (
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-brand-magenta" />
                )}
              </>
            )}
            {sidebarCollapsed && matches.some(m => m.unread) && (
              <span className="absolute right-3.5 top-3.5 w-2 h-2 rounded-full bg-brand-magenta" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('projectHelp')}
            className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'projectHelp' 
                ? 'bg-gradient-to-r from-brand-teal/15 to-brand-magenta/15 text-brand-teal border border-brand-teal/20' 
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5 border border-transparent'
            }`}
          >
            <Code2 className="w-5 h-5 flex-shrink-0" />
            {!sidebarCollapsed && <span>Project Help</span>}
          </button>
          
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'profile' 
                ? 'bg-gradient-to-r from-brand-purple/15 to-brand-teal/15 text-brand-purple border border-brand-purple/20' 
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5 border border-transparent'
            }`}
          >
            <User className="w-5 h-5 flex-shrink-0" />
            {!sidebarCollapsed && <span>My Profile</span>}
          </button>
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-white/5 space-y-4">
          <div className="flex items-center gap-3 px-2">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-brand-teal to-brand-purple p-[1.5px]">
              <div className="w-full h-full rounded-full bg-[#0a0f1e] overflow-hidden flex items-center justify-center font-bold text-xs text-brand-teal text-center">
                {myProfile ? getInitials(myProfile.user.name) : '??'}
              </div>
            </div>
            {!sidebarCollapsed && (
              <div className="flex-1 overflow-hidden">
                <p className="text-xs font-semibold text-zinc-200 truncate">{myProfile ? myProfile.user.name : 'Connecting...'}</p>
                <span className="text-[10px] text-green-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping" />
                  {myProfile ? 'Gateway Authorized' : 'Connecting...'}
                </span>
              </div>
            )}
          </div>
          
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-500/5 transition-all border border-transparent"
          >
            <LogOut className="w-4.5 h-4.5 flex-shrink-0" />
            {!sidebarCollapsed && <span>Disconnect Session</span>}
          </button>
        </div>
      </aside>

      {/* ==========================================
          MOBILE NAVIGATION BAR (BOTTOM)
          ========================================== */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#0a0f1e]/90 backdrop-blur-lg border-t border-white/5 flex justify-around items-center z-25 px-4">
        <button
          type="button"
          onClick={() => setActiveTab('discover')}
          className={`flex flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-all ${
            activeTab === 'discover' ? 'text-brand-teal scale-105' : 'text-zinc-500'
          }`}
        >
          <Compass className="w-5.5 h-5.5" />
          <span>Discover</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('matches')}
          className={`flex flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-all relative ${
            activeTab === 'matches' ? 'text-brand-magenta scale-105' : 'text-zinc-500'
          }`}
        >
          <MessageSquare className="w-5.5 h-5.5" />
          <span>Matches</span>
          {matches.some(m => m.unread) && (
            <span className="absolute top-1 right-2.5 w-2 h-2 rounded-full bg-brand-magenta" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('projectHelp')}
          className={`flex flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-all ${
            activeTab === 'projectHelp' ? 'text-brand-teal scale-105' : 'text-zinc-500'
          }`}
        >
          <Code2 className="w-5.5 h-5.5" />
          <span>Projects</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-all ${
            activeTab === 'profile' ? 'text-brand-purple scale-105' : 'text-zinc-500'
          }`}
        >
          <User className="w-5.5 h-5.5" />
          <span>Profile</span>
        </button>
      </nav>

      {/* ==========================================
          MAIN CONTENT VIEW ROUTER
          ========================================== */}
      <main className="flex-1 flex flex-col min-h-screen pb-16 md:pb-0 z-10 overflow-y-auto">
        
        {/* Discover Screen */}
        {activeTab === 'discover' && (
          <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 max-w-4xl mx-auto w-full">
            
            {/* Top Deck Stats Header */}
            <div className="w-full max-w-[380px] md:max-w-[420px] flex justify-between items-center mb-6">
              <div className="flex items-center gap-2 text-zinc-400 text-xs font-semibold uppercase tracking-wider">
                <Activity className="w-4.5 h-4.5 text-brand-teal" />
                <span>Microservice Feeder</span>
              </div>
              <div className="text-zinc-500 text-xs font-semibold">
                Likes: <span className="text-brand-teal">{likesCount}</span>
              </div>
            </div>

            {/* Profile Card Container (Relative viewport stack) */}
            <div className="relative w-full max-w-[380px] md:max-w-[420px] aspect-[3/4.5] flex items-center justify-center">
              <AnimatePresence>
                {activeProfile ? (
                  <motion.div
                    key={activeProfile.id}
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.6}
                    onDragEnd={handleDragEnd}
                    style={{ x: dragX, y: dragY, rotate, opacity: cardOpacity }}
                    animate={
                      swipeDirection === 'right' 
                        ? { x: 400, opacity: 0, scale: 0.95 }
                        : swipeDirection === 'left'
                        ? { x: -400, opacity: 0, scale: 0.95 }
                        : swipeDirection === 'up'
                        ? { y: -450, opacity: 0, scale: 0.95 }
                        : { x: 0, y: 0, opacity: 1, scale: 1 }
                    }
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    className="absolute inset-0 rounded-[28px] overflow-hidden glass-card shadow-[0_30px_70px_rgba(0,0,0,0.6)] border border-white/10 cursor-grab active:cursor-grabbing flex flex-col z-10"
                  >
                    
                    {/* Swipe Overlay Indicators */}
                    {/* LIKE INDICATOR */}
                    <motion.div 
                      style={{ opacity: likeOpacity }} 
                      className="absolute top-8 left-8 -rotate-12 px-5 py-2 border-3 border-emerald-500 text-emerald-500 rounded-xl font-extrabold text-2xl tracking-widest uppercase z-30 pointer-events-none"
                    >
                      Like
                    </motion.div>
                    
                    {/* PASS INDICATOR */}
                    <motion.div 
                      style={{ opacity: passOpacity }} 
                      className="absolute top-8 right-8 rotate-12 px-5 py-2 border-3 border-rose-500 text-rose-500 rounded-xl font-extrabold text-2xl tracking-widest uppercase z-30 pointer-events-none"
                    >
                      Pass
                    </motion.div>
                    
                    {/* SUPER LIKE INDICATOR */}
                    <motion.div 
                      style={{ opacity: superLikeOpacity }} 
                      className="absolute bottom-40 left-1/2 -translate-x-1/2 -rotate-6 px-6 py-2 border-3 border-brand-purple text-brand-purple rounded-xl font-extrabold text-2xl tracking-widest uppercase z-30 pointer-events-none"
                    >
                      Super Like
                    </motion.div>

                    {/* Profile Picture Placeholder */}
                    <div className="relative flex-1 bg-zinc-950/80 overflow-hidden">
                      <img 
                        src={activeProfile.image} 
                        alt={activeProfile.name} 
                        className="w-full h-full object-cover select-none pointer-events-none transition-transform duration-700 hover:scale-105"
                      />
                      
                      {/* Editorial shadow gradient overlay */}
                      <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent" />
                      
                      {/* Distant Microservice Status Tag */}
                      <div className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-md bg-zinc-950/40 border border-white/5 text-[10px] text-zinc-300 font-semibold tracking-wider uppercase">
                        <MapPin className="w-3.5 h-3.5 text-brand-teal" />
                        <span>{activeProfile.distance}</span>
                      </div>
                    </div>

                    {/* Profile Details Card Footer */}
                    <div className="p-6 bg-zinc-950/90 border-t border-white/5">
                      <div className="flex items-baseline gap-2.5">
                        <h2 className="text-2xl font-bold text-white tracking-tight">{activeProfile.name}</h2>
                        <span className="text-xl font-medium text-zinc-400">{activeProfile.age}</span>
                      </div>

                      <p className="mt-3 text-sm text-zinc-400 leading-relaxed font-normal">
                        {activeProfile.bio}
                      </p>

                      {/* Interest Badges */}
                      <div className="mt-4 flex flex-wrap gap-2">
                        {activeProfile.interests.map((interest, idx) => (
                          <span 
                            key={idx}
                            className="px-3 py-1 rounded-full text-[10px] font-semibold tracking-wider text-zinc-300 uppercase bg-white/5 border border-white/5 hover:border-white/20 transition-all hover:bg-white/10 cursor-default"
                          >
                            {interest}
                          </span>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  // fallback deck exhausted view
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute inset-0 rounded-[28px] glass-card flex flex-col items-center justify-center p-8 text-center border border-white/5 z-0"
                  >
                    <div className="w-16 h-16 rounded-full bg-brand-purple/10 flex items-center justify-center mb-6">
                      <Zap className="w-8 h-8 text-brand-purple animate-pulse" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Gateway Exhausted</h3>
                    <p className="text-sm text-zinc-500 max-w-[260px] leading-relaxed">
                      You've swiped all profiles currently cached by the Matcher microservice.
                    </p>
                    <button
                      type="button"
                      onClick={() => setProfiles(INITIAL_PROFILES)}
                      className="mt-6 px-6 py-3 rounded-xl bg-gradient-to-r from-brand-teal to-brand-purple text-sm font-semibold text-white shadow-lg shadow-brand-teal/15 hover:shadow-brand-teal/30 hover:scale-105 active:scale-95 transition-all duration-300"
                    >
                      Reset Swipes Cache
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Action Controllers Deck */}
            <div className="w-full max-w-[380px] md:max-w-[420px] flex justify-between items-center mt-8 px-4 z-10">
              
              {/* Rewind */}
              <motion.button
                type="button"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleRewind}
                disabled={history.length === 0}
                className="w-12 h-12 rounded-full border border-white/5 bg-zinc-950/60 flex items-center justify-center text-zinc-400 hover:text-white disabled:opacity-40 disabled:hover:text-zinc-400 disabled:pointer-events-none transition-colors"
                title="Rewind swipe"
              >
                <RotateCcw className="w-5 h-5" />
              </motion.button>

              {/* Pass (Cross) */}
              <motion.button
                type="button"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => activeProfile && handlePass(activeProfile.id)}
                disabled={!activeProfile}
                className="w-14 h-14 rounded-full border border-red-500/20 bg-red-500/5 flex items-center justify-center text-red-500 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-40 disabled:pointer-events-none transition-all"
                title="Pass"
              >
                <X className="w-6 h-6" />
              </motion.button>

              {/* Super Like (Star) */}
              <motion.button
                type="button"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => activeProfile && handleSuperLike(activeProfile.id)}
                disabled={!activeProfile}
                className="w-12 h-12 rounded-full border border-brand-purple/20 bg-brand-purple/5 flex items-center justify-center text-brand-purple hover:text-brand-purple-light hover:bg-brand-purple/10 disabled:opacity-40 disabled:pointer-events-none transition-all"
                title="Super Like"
              >
                <Star className="w-5 h-5" />
              </motion.button>

              {/* Like (Heart) */}
              <motion.button
                type="button"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => activeProfile && handleLike(activeProfile.id)}
                disabled={!activeProfile}
                className="w-14 h-14 rounded-full border-brand-teal/20 bg-brand-teal/5 flex items-center justify-center text-brand-teal hover:text-brand-teal-light hover:bg-brand-teal/10 disabled:opacity-40 disabled:pointer-events-none transition-all shadow-[0_0_20px_rgba(6,182,212,0.1)]"
                title="Like"
              >
                <Heart className="w-6 h-6 fill-current" />
              </motion.button>
              
            </div>

          </div>
        )}

        {/* Matches / Messages Screen */}
        {activeTab === 'matches' && (
          <div className="flex-1 flex flex-col md:flex-row h-screen">
            
            {/* Matches Sidebar */}
            <div className="w-full md:w-80 h-full border-r border-white/5 flex flex-col bg-zinc-950/30">
              <div className="p-6 border-b border-white/5">
                <h2 className="text-xl font-bold text-white tracking-tight">Your Matches</h2>
                <p className="text-xs text-zinc-500 mt-1">Ready to chat with matching gateways</p>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {matches.map((match) => (
                  <button
                    key={match.id}
                    type="button"
                    onClick={() => {
                      setSelectedMatch(match);
                      // Clear unread
                      setMatches(matches.map(m => m.id === match.id ? { ...m, unread: false } : m));
                    }}
                    className={`w-full flex items-center gap-3.5 p-3.5 rounded-2xl transition-all border text-left ${
                      selectedMatch?.id === match.id
                        ? 'bg-white/5 border-white/10 shadow-lg'
                        : 'bg-transparent border-transparent hover:bg-white/2 hover:border-white/5'
                    }`}
                  >
                    <div className="w-11 h-11 rounded-full overflow-hidden border border-white/10 flex-shrink-0">
                      <img src={match.avatar} alt={match.name} className="w-full h-full object-cover" />
                    </div>
                    
                    <div className="flex-1 overflow-hidden">
                      <div className="flex justify-between items-baseline">
                        <span className="text-sm font-semibold text-white">{match.name}</span>
                        <span className="text-[10px] text-zinc-500">{match.time}</span>
                      </div>
                      <p className={`text-xs truncate mt-1 ${match.unread ? 'text-brand-teal font-semibold' : 'text-zinc-400'}`}>
                        {match.lastMessage}
                      </p>
                    </div>

                    {match.unread && (
                      <span className="w-2.5 h-2.5 rounded-full bg-brand-teal flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Chat Pane */}
            <div className="flex-1 h-full flex flex-col bg-zinc-950/10">
              {selectedMatch ? (
                <>
                  {/* Chat Pane Header */}
                  <div className="p-4 md:p-6 border-b border-white/5 flex items-center justify-between bg-zinc-950/30">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden border border-white/10 flex-shrink-0">
                        <img src={selectedMatch.avatar} alt={selectedMatch.name} className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white">{selectedMatch.name}</h3>
                        <span className="text-[10px] text-green-400 flex items-center gap-1.5 mt-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                          microservice link established
                        </span>
                      </div>
                    </div>
                    
                    <button 
                      type="button" 
                      onClick={() => setSelectedMatch(null)}
                      className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition-colors"
                    >
                      <Info className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Chat Messages Log */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {chatMessages.map((msg, idx) => (
                      <div 
                        key={idx}
                        className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[70%] p-4 rounded-2xl text-sm ${
                          msg.sender === 'me'
                            ? 'bg-gradient-to-tr from-brand-teal to-brand-purple text-white rounded-br-none shadow-md shadow-brand-teal/5'
                            : 'bg-zinc-900/80 border border-white/5 text-zinc-200 rounded-bl-none'
                        }`}>
                          <p className="leading-relaxed">{msg.text}</p>
                          <span className="text-[9px] text-zinc-400 block text-right mt-1.5 font-medium">{msg.time}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Chat Input Area */}
                  <form onSubmit={handleSendChatMessage} className="p-4 border-t border-white/5 bg-zinc-950/40">
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        placeholder="Write encrypted microservice message..."
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        className="w-full glass-input rounded-xl pl-4 pr-12 py-3.5 text-sm text-white focus:outline-none placeholder-zinc-500"
                      />
                      <button
                        type="submit"
                        className="absolute right-2 p-2 rounded-lg bg-gradient-to-r from-brand-teal to-brand-purple text-white hover:opacity-90 active:scale-95 transition-all"
                      >
                        <Send className="w-4.5 h-4.5" />
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                // No chat selected fallback
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                  <div className="w-14 h-14 rounded-full bg-zinc-900 flex items-center justify-center border border-white/5 mb-4 text-zinc-500">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-white">Secure Encrypted Chats</h3>
                  <p className="text-xs text-zinc-500 mt-1.5 max-w-[220px] leading-relaxed">
                    Select a matched user on the sidebar to establish a microservice web socket connection.
                  </p>
                </div>
              )}
            </div>

          </div>
        )}

        {/* Profile Tab Screen */}
        {activeTab === 'profile' && (
          <div className="flex-1 flex items-center justify-center p-6 md:p-12">
            {loadingProfile ? (
              <div className="flex flex-col items-center justify-center">
                <Loader2 className="w-10 h-10 text-brand-teal animate-spin mb-4" />
                <p className="text-sm text-zinc-400">Retrieving node profile details...</p>
              </div>
            ) : myProfile ? (
              <div className="w-full max-w-lg glass-card rounded-3xl p-8 border border-white/5 shadow-2xl">
                
                {/* Profile Avatar Header */}
                <div className="flex flex-col items-center border-b border-white/5 pb-8">
                  <div className="relative group">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-brand-teal via-brand-purple to-brand-magenta p-[3px] shadow-[0_0_30px_rgba(6,182,212,0.15)]">
                      <div className="w-full h-full rounded-full bg-[#0a0f1e] overflow-hidden flex items-center justify-center font-bold text-3xl text-brand-teal">
                        {getInitials(myProfile.user.name)}
                      </div>
                    </div>
                    {/* Status beacon */}
                    <span className="absolute bottom-1.5 right-1.5 w-4.5 h-4.5 rounded-full border-3 border-[#0a0f1e] bg-green-500" />
                  </div>

                  <h2 className="mt-4 text-xl font-bold text-white tracking-tight">{myProfile.user.name}</h2>
                  <p className="text-xs text-zinc-500 mt-1 uppercase tracking-widest font-semibold">{myProfile.user.email}</p>
                </div>

                {/* Profile Specs */}
                <div className="mt-8 space-y-6">
                  <div>
                    <h3 className="text-xs font-semibold text-zinc-400 tracking-wider uppercase">Dating Preferences</h3>
                    <div className="mt-2.5 grid grid-cols-2 gap-3 text-sm">
                      <div className="p-3 bg-zinc-950/40 rounded-xl border border-white/5">
                        <span className="text-[10px] text-zinc-500 block">Looking for</span>
                        <span className="font-semibold text-white mt-0.5 block">{myProfile.profile.looking_for}</span>
                      </div>
                      <div className="p-3 bg-zinc-950/40 rounded-xl border border-white/5">
                        <span className="text-[10px] text-zinc-500 block">Radius limit</span>
                        <span className="font-semibold text-white mt-0.5 block">{myProfile.profile.radius_limit} miles</span>
                      </div>
                    </div>
                  </div>

                  {/* Bio & Interests */}
                  <div>
                    <h3 className="text-xs font-semibold text-zinc-400 tracking-wider uppercase">Bio</h3>
                    <p className="mt-2 text-sm text-zinc-300 bg-zinc-950/20 p-3 rounded-xl border border-white/5">{myProfile.profile.bio}</p>
                  </div>

                  <div>
                    <h3 className="text-xs font-semibold text-zinc-400 tracking-wider uppercase">Interests / Tech Stack</h3>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {myProfile.profile.interests.map((interest: string, idx: number) => (
                        <span 
                          key={idx}
                          className="px-3 py-1 rounded-full text-[10px] font-semibold tracking-wider text-brand-teal uppercase bg-brand-teal/5 border border-brand-teal/10"
                        >
                          {interest}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Connection Status Log */}
                  <div>
                    <h3 className="text-xs font-semibold text-zinc-400 tracking-wider uppercase mb-2">Microservices Nodes Connectivity</h3>
                    <div className="space-y-2 text-xs">
                      
                      <div className="flex justify-between items-center p-3 rounded-xl bg-zinc-950/20 border border-white/5">
                        <span className="text-zinc-400 font-medium">Matcher Service Node (v1.4)</span>
                        <span className="text-green-400 font-bold flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping" />
                          ONLINE
                        </span>
                      </div>

                      <div className="flex justify-between items-center p-3 rounded-xl bg-zinc-950/20 border border-white/5">
                        <span className="text-zinc-400 font-medium">Profile Service Node (v2.1)</span>
                        <span className="text-green-400 font-bold flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping" />
                          ONLINE
                        </span>
                      </div>

                      <div className="flex justify-between items-center p-3 rounded-xl bg-zinc-950/20 border border-white/5">
                        <span className="text-zinc-400 font-medium">Chat Messaging socket (TLS)</span>
                        <span className="text-brand-teal font-bold flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-brand-teal animate-pulse" />
                          LISTENING
                        </span>
                      </div>

                    </div>
                  </div>

                  <div className="pt-4 flex gap-4">
                    <button
                      type="button"
                      onClick={() => {
                        alert("Preferences saved. Gateway config updated.");
                      }}
                      className="flex-1 py-3 px-4 rounded-xl border border-white/10 hover:border-white/20 bg-zinc-950/40 hover:bg-zinc-900/60 text-sm font-semibold transition-all text-center cursor-pointer"
                    >
                      Edit Profile
                    </button>

                    <button
                      type="button"
                      onClick={onLogout}
                      className="flex-1 py-3 px-4 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-sm font-semibold transition-all text-center cursor-pointer"
                    >
                      Disconnect
                    </button>
                  </div>

                </div>

              </div>
            ) : (
              <div className="text-center w-full max-w-lg glass-card rounded-3xl p-8 border border-white/5">
                <p className="text-red-400">Failed to load profile. Please verify Gateway connection.</p>
                <button 
                  onClick={fetchProfile}
                  className="mt-4 px-5 py-2.5 bg-brand-teal/10 border border-brand-teal/20 rounded-xl text-brand-teal text-sm font-semibold hover:bg-brand-teal hover:text-white transition-all cursor-pointer"
                >
                  Retry Connection
                </button>
              </div>
            )}
          </div>
        )}

        {/* Project Help Screen */}
        {activeTab === 'projectHelp' && (
          <div className="flex-1 flex flex-col items-center p-4 md:p-8 max-w-3xl mx-auto w-full">
            
            {/* Header */}
            <div className="w-full flex justify-between items-center mb-8 border-b border-white/5 pb-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                  <Code2 className="w-6 h-6 text-brand-teal" />
                  <span>Project Help Requests</span>
                </h1>
                <p className="text-xs text-zinc-500 mt-1">Collab, debug, or get code reviews from fellow developers</p>
              </div>
              
              <button
                type="button"
                onClick={() => setFormExpanded(!formExpanded)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-teal to-brand-purple text-xs font-semibold text-white hover:opacity-90 active:scale-95 transition-all shadow-md hover:shadow-brand-teal/25 cursor-pointer"
              >
                {formExpanded ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                <span>{formExpanded ? "Close Form" : "New Help Request"}</span>
              </button>
            </div>

            {/* Create Help Request Form */}
            <AnimatePresence>
              {formExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginBottom: 24 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.3 }}
                  className="w-full overflow-hidden"
                >
                  <form onSubmit={handlePostProject} className="w-full glass-card rounded-2xl p-6 border border-white/10 space-y-4 shadow-xl">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Submit New Help Request</h3>
                    
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-zinc-400 tracking-wider uppercase">Project Title</label>
                      <input
                        type="text"
                        placeholder="e.g., Debugging a memory leak in React custom hook"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full glass-input rounded-xl px-4 py-3 text-sm text-white focus:outline-none placeholder-zinc-600"
                        required
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-zinc-400 tracking-wider uppercase">Description / Details</label>
                      <textarea
                        rows={4}
                        placeholder="Provide some details on what you are building, the issues you are facing, and how another developer can help."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full glass-input rounded-xl px-4 py-3 text-sm text-white focus:outline-none placeholder-zinc-600 resize-none"
                        required
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-zinc-400 tracking-wider uppercase">Tech Stack Required (Press Enter or comma to add)</label>
                      <div className="relative flex items-center">
                        <input
                          type="text"
                          placeholder="e.g., React, TypeScript, Node.js"
                          value={techStackInput}
                          onChange={(e) => setTechStackInput(e.target.value)}
                          onKeyDown={handleAddTech}
                          className="w-full glass-input rounded-xl px-4 py-3 text-sm text-white focus:outline-none placeholder-zinc-600 pr-12"
                        />
                      </div>
                      
                      {/* Interactive Tags list */}
                      {techStack.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {techStack.map((tech, idx) => (
                            <span
                              key={idx}
                              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-brand-teal bg-brand-teal/10 border border-brand-teal/20"
                            >
                              <span>{tech}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveTech(tech)}
                                className="text-brand-teal hover:text-white transition-colors"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="pt-2 flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setTitle('');
                          setDescription('');
                          setTechStack([]);
                          setFormExpanded(false);
                        }}
                        className="px-4 py-2.5 rounded-xl border border-white/5 bg-zinc-950/40 hover:bg-zinc-900/60 text-xs font-semibold transition-all cursor-pointer"
                      >
                        Cancel
                      </button>
                      
                      <button
                        type="submit"
                        disabled={submittingProject}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-teal to-brand-purple text-xs font-semibold text-white hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                      >
                        {submittingProject && <Loader2 className="w-4 h-4 animate-spin" />}
                        <span>{submittingProject ? "Publishing..." : "Publish Request"}</span>
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Help Requests Feed */}
            {loadingProjects ? (
              <div className="w-full flex flex-col items-center justify-center py-20">
                <Loader2 className="w-10 h-10 text-brand-teal animate-spin mb-4" />
                <p className="text-sm text-zinc-500">Querying live helper feed...</p>
              </div>
            ) : projects.length > 0 ? (
              <div className="w-full space-y-4">
                {projects.map((proj: any) => (
                  <motion.div
                    key={proj.id}
                    layoutId={`project-card-${proj.id}`}
                    whileHover={{ y: -4, borderColor: 'rgba(255, 255, 255, 0.15)', boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)' }}
                    className="w-full glass-card rounded-2xl p-6 border border-white/5 flex flex-col transition-all duration-300"
                  >
                    {/* Poster Info Header */}
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-brand-teal to-brand-purple p-[1.5px] shadow-sm">
                          <div className="w-full h-full rounded-full bg-[#0a0f1e] overflow-hidden flex items-center justify-center font-bold text-sm text-brand-teal">
                            {getInitials(proj.user_name || 'Anonymous')}
                          </div>
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-white leading-none">{proj.user_name || 'Anonymous'}</h4>
                          <span className="text-[10px] text-zinc-500 mt-1 block">
                            {new Date(proj.timestamp).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      </div>
                      
                      <div className="px-2.5 py-1 rounded-full bg-white/5 border border-white/5 text-[9px] text-zinc-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-teal animate-pulse" />
                        <span>Live Request</span>
                      </div>
                    </div>

                    {/* Title & Description */}
                    <h2 className="text-xl font-bold text-white tracking-tight mb-2 hover:text-brand-teal-light transition-colors cursor-default">
                      {proj.title}
                    </h2>
                    
                    <p className="text-sm text-zinc-400 leading-relaxed font-normal mb-4 whitespace-pre-wrap">
                      {proj.description}
                    </p>

                    {/* Tech Badges & CTA */}
                    <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-white/5">
                      <div className="flex flex-wrap gap-2">
                        {proj.tech_stack.map((tech: string, idx: number) => (
                          <span
                            key={idx}
                            className="px-2.5 py-1 rounded-md text-[10px] font-semibold tracking-wider text-zinc-300 bg-white/5 border border-white/5 uppercase hover:bg-white/10 transition-colors"
                          >
                            {tech}
                          </span>
                        ))}
                      </div>
                      
                      <button
                        type="button"
                        onClick={() => {
                          alert(`Connection established with ${proj.user_name || 'Anonymous'}. Redirecting to secure chat channel...`);
                          setActiveTab('matches');
                        }}
                        className="px-4 py-2 rounded-xl border border-brand-teal/20 bg-brand-teal/5 text-[11px] font-bold text-brand-teal hover:bg-brand-teal hover:text-white transition-all shadow-[0_0_15px_rgba(6,182,212,0.05)] cursor-pointer"
                      >
                        Help Out
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="w-full glass-card rounded-2xl p-12 text-center border border-white/5 flex flex-col items-center justify-center">
                <Code2 className="w-12 h-12 text-zinc-500 mb-4" />
                <h3 className="text-lg font-bold text-white">No help requests yet</h3>
                <p className="text-sm text-zinc-400 mt-1 max-w-sm">Be the first to post a collaboration request, code review, or debugging issue!</p>
                <button
                  type="button"
                  onClick={() => setFormExpanded(true)}
                  className="mt-6 px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-teal to-brand-purple text-xs font-semibold text-white shadow-lg hover:shadow-brand-teal/30 hover:scale-105 transition-all cursor-pointer"
                >
                  Create Request
                </button>
              </div>
            )}
            
          </div>
        )}

      </main>

    </div>
  );
};
