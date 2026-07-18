import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  motion,
  AnimatePresence,
  animate,
  LayoutGroup,
  useMotionValue,
  useMotionValueEvent,
} from 'framer-motion';
import {
  User,
  GitMerge,
  HandHelping,
  Code2,
  Plus,
  X,
  Loader2,
  LogOut,
  Camera,
  MapPin,
  Search,
  Users,
  Pencil,
} from 'lucide-react';
import { FloatingField } from './FloatingField';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import type { RequestStatus } from './RequestStepper';
import { languageTone } from '../lib/languageColors';

const EASE = [0.22, 1, 0.36, 1] as const;
const EASE_OUT = [0.16, 1, 0.3, 1] as const;
const SPRING_PILL = { type: 'spring' as const, stiffness: 420, damping: 34, mass: 0.7 };
const MAX_RADIUS = 50;

type ProfileMatch = {
  id: number | string;
  name: string;
  type?: 'match' | 'project';
  projectTitle?: string;
  time: string;
};

type ProfileTab = 'overview' | 'activity' | 'preferences';

type ActivityEvent = {
  id: string;
  kind: 'match' | 'helped' | 'request';
  title: string;
  detail: string;
  timeLabel: string;
  sortKey: number;
};

const LOOKING_FOR_PRESETS = [
  'Collaborator',
  'Mentor',
  'Mentee',
  'Cofounder',
  'Pair programmer',
] as const;

function CountUp({ value, reducedMotion }: { value: number; reducedMotion: boolean }) {
  const mv = useMotionValue(0);
  const [display, setDisplay] = useState(0);

  useMotionValueEvent(mv, 'change', (v) => {
    setDisplay(Math.round(v));
  });

  useEffect(() => {
    if (reducedMotion) {
      mv.set(value);
      setDisplay(value);
      return;
    }

    // Paint 0 first, then ease out to the final value over ~800ms.
    mv.set(0);
    setDisplay(0);
    let controls: ReturnType<typeof animate> | undefined;
    const raf = requestAnimationFrame(() => {
      controls = animate(mv, value, {
        duration: 0.8,
        ease: EASE_OUT,
      });
    });

    return () => {
      cancelAnimationFrame(raf);
      controls?.stop();
    };
  }, [value, reducedMotion, mv]);

  return <span className="tabular-nums">{display}</span>;
}

const Spinner: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex flex-col items-center justify-center gap-3 py-16">
    <Loader2 className="w-5 h-5 text-fg-subtle animate-spin" />
    <p className="mono-label">{label}</p>
  </div>
);

/** Dashed empty-state invite — hover: brand border, + scale, subtle tint */
function AddInvite({
  label,
  onClick,
  className = '',
}: {
  label: string;
  onClick: () => void;
  className?: string;
}) {
  const reducedMotion = usePrefersReducedMotion();
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial="rest"
      whileHover={reducedMotion ? undefined : 'hover'}
      whileTap={reducedMotion ? undefined : 'tap'}
      variants={{
        rest: {
          borderColor: 'rgba(255, 255, 255, 0.18)',
          backgroundColor: 'rgba(185, 144, 255, 0)',
          color: 'rgba(107, 115, 137, 1)',
        },
        hover: {
          borderColor: 'rgba(185, 144, 255, 0.55)',
          backgroundColor: 'rgba(185, 144, 255, 0.07)',
          color: 'rgba(196, 200, 212, 1)',
        },
        tap: { scale: 0.995 },
      }}
      transition={{ duration: 0.18, ease: EASE }}
      className={`w-full flex items-center justify-center gap-2 py-6 rounded-[14px] border border-dashed text-[13px] ${className}`}
    >
      <motion.span
        className="inline-flex"
        variants={{
          rest: { scale: 1 },
          hover: { scale: 1.1 },
          tap: { scale: 1.05 },
        }}
        transition={{ type: 'spring', stiffness: 420, damping: 22 }}
      >
        <Plus className="w-3.5 h-3.5" />
      </motion.span>
      {label}
    </motion.button>
  );
}

function MorphField({
  editing,
  display,
  children,
  className = '',
}: {
  editing: boolean;
  display: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const reducedMotion = usePrefersReducedMotion();
  return (
    <motion.div
      layout={!reducedMotion}
      transition={
        reducedMotion
          ? { duration: 0 }
          : { layout: { duration: 0.32, ease: EASE }, opacity: { duration: 0.22 } }
      }
      className={`overflow-hidden ${className}`}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {editing ? (
          <motion.div
            key="edit"
            layout={!reducedMotion}
            initial={reducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: reducedMotion ? 0 : 0.26, ease: EASE }}
          >
            {children}
          </motion.div>
        ) : (
          <motion.div
            key="view"
            layout={!reducedMotion}
            initial={reducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: reducedMotion ? 0 : 0.26, ease: EASE }}
          >
            {display}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export interface ProfilePageProps {
  myProfile: any | null;
  loadingProfile: boolean;
  matches: ProfileMatch[];
  projects: any[];
  projectStatuses: Record<number, RequestStatus>;
  onLogout: () => void;
  onRetry: () => void;
  onSaved: () => Promise<void> | void;
  getInitials: (name: string) => string;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  myProfile,
  loadingProfile,
  matches,
  projects,
  projectStatuses,
  onLogout,
  onRetry,
  onSaved,
  getInitials,
}) => {
  const reducedMotion = usePrefersReducedMotion();
  const [profileTab, setProfileTab] = useState<ProfileTab>('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [editAge, setEditAge] = useState(25);
  const [editLookingFor, setEditLookingFor] = useState('');
  const [editRadiusLimit, setEditRadiusLimit] = useState(10);
  const [editBio, setEditBio] = useState('');
  const [editInterests, setEditInterests] = useState<string[]>([]);
  const [editInterestsInput, setEditInterestsInput] = useState('');
  const [editImage, setEditImage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [avatarDragging, setAvatarDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const matchCount = matches.filter((m) => m.type !== 'project').length;
  const helpedCount = matches.filter((m) => m.type === 'project').length;
  const interestCount = (myProfile?.interests || []).length;

  const activityEvents = useMemo<ActivityEvent[]>(() => {
    const events: ActivityEvent[] = [];

    matches.forEach((m, i) => {
      if (m.type === 'project') {
        events.push({
          id: `helped-${m.id}`,
          kind: 'helped',
          title: 'Offered help',
          detail: m.projectTitle || m.name,
          timeLabel: m.time,
          sortKey: Date.now() - i * 1000,
        });
      } else {
        events.push({
          id: `match-${m.id}`,
          kind: 'match',
          title: 'New match',
          detail: m.name,
          timeLabel: m.time,
          sortKey: Date.now() - i * 1000 - 10,
        });
      }
    });

    projects.forEach((p: any, i: number) => {
      const status = projectStatuses[p.id] || 'pending';
      events.push({
        id: `req-${p.id}`,
        kind: 'request',
        title: status === 'completed' ? 'Request completed' : 'Posted a request',
        detail: p.title || 'Untitled request',
        timeLabel: p.timestamp
          ? new Date(p.timestamp).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })
          : '—',
        sortKey: p.timestamp ? new Date(p.timestamp).getTime() : Date.now() - 50000 - i,
      });
    });

    return events.sort((a, b) => b.sortKey - a.sortKey);
  }, [matches, projects, projectStatuses]);

  const startEditing = () => {
    if (!myProfile) return;
    setEditAge(myProfile.age || 25);
    setEditLookingFor(myProfile.looking_for || '');
    setEditRadiusLimit(myProfile.radius_limit ?? 10);
    setEditBio(myProfile.bio || '');
    setEditInterests(myProfile.interests || []);
    setEditInterestsInput('');
    setEditImage(myProfile.image || null);
    setProfileError(null);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setProfileError(null);
    setEditImage(null);
    setAvatarDragging(false);
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

  const applyAvatarFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    if (!isEditing) startEditing();
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setEditImage(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditing) return;
    setSaving(true);
    setProfileError(null);
    try {
      const res = await fetch('http://localhost:8080/api/v1/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          age: editAge,
          looking_for: editLookingFor,
          radius_limit: editRadiusLimit,
          bio: editBio,
          interests: editInterests,
          distance: myProfile?.distance || '3 miles away',
          ...(editImage ? { image: editImage } : {}),
        }),
        credentials: 'include',
      });
      if (res.ok) {
        await onSaved();
        setIsEditing(false);
        setEditImage(null);
      } else {
        const errData = await res.json().catch(() => ({}));
        setProfileError(errData.detail || 'Could not save your profile.');
      }
    } catch {
      setProfileError('Network error — could not save your profile.');
    } finally {
      setSaving(false);
    }
  };

  const displayLookingFor = isEditing ? editLookingFor : myProfile?.looking_for || '';
  const displayRadius = isEditing
    ? editRadiusLimit
    : myProfile?.radius_limit !== null && myProfile?.radius_limit !== undefined
      ? myProfile.radius_limit
      : null;
  const displayBio = isEditing ? editBio : myProfile?.bio || '';
  const displayInterests: string[] = isEditing ? editInterests : myProfile?.interests || [];
  const avatarSrc = isEditing
    ? editImage || myProfile?.image
    : myProfile?.image;
  const tagline = myProfile?.looking_for?.trim() || null;

  const tabs: { key: ProfileTab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'activity', label: 'Activity' },
    { key: 'preferences', label: 'Preferences' },
  ];

  if (loadingProfile) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Spinner label="loading profile" />
      </div>
    );
  }

  if (!myProfile) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center glass rounded-[18px] p-8 max-w-sm">
          <p className="text-sm text-fg-muted">Couldn’t load your profile.</p>
          <button
            type="button"
            onClick={onRetry}
            className="btn-ghost mt-4 px-4 py-2 rounded-[12px] text-[13px]"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const radiusPct =
    displayRadius === null ? 0 : Math.min(100, (Number(displayRadius) / MAX_RADIUS) * 100);

  return (
    <form
      onSubmit={handleSave}
      className="flex-1 flex flex-col w-full overflow-y-auto"
    >
      {/* ---- Hero ---- */}
      <div className="relative w-full">
        <div className="profile-banner-mesh h-36 sm:h-44 w-full" aria-hidden />

        <div className="px-4 sm:px-8 max-w-3xl mx-auto -mt-12 sm:-mt-14 relative z-10 pb-2">
          <div className="flex items-end gap-4 sm:gap-5">
            {/* Avatar */}
            <div
              className={`relative flex-shrink-0 group ${
                avatarDragging
                  ? 'ring-2 ring-accent-brand shadow-[0_0_24px_rgba(185,144,255,0.35)]'
                  : ''
              } rounded-full transition-[box-shadow,ring] duration-200`}
              onDragEnter={(e) => {
                e.preventDefault();
                setAvatarDragging(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setAvatarDragging(true);
              }}
              onDragLeave={() => setAvatarDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setAvatarDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) applyAvatarFile(file);
              }}
            >
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full p-[3px] bg-gradient-to-br from-accent-brand to-accent-deep">
                <div className="w-full h-full rounded-full bg-ink-900 overflow-hidden flex items-center justify-center border-2 border-bg-base">
                  {avatarSrc ? (
                    <img
                      src={avatarSrc}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl font-semibold text-fg">
                      {getInitials(myProfile.user.name)}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isEditing) startEditing();
                  fileInputRef.current?.click();
                }}
                aria-label="Upload avatar"
                className="absolute inset-0 rounded-full flex items-center justify-center bg-bg-base/55 opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer"
              >
                <Camera className="w-6 h-6 text-fg" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) applyAvatarFile(file);
                  e.target.value = '';
                }}
              />
            </div>

            <div className="flex-1 min-w-0 pb-1">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="display text-2xl sm:text-[1.75rem] text-fg leading-tight truncate">
                    {myProfile.user.name}
                  </h1>
                  {tagline ? (
                    <p className="text-[13px] text-fg-muted mt-1 truncate">{tagline}</p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        startEditing();
                        setProfileTab('overview');
                      }}
                      className="mt-1.5 inline-flex items-center gap-1.5 text-[12px] text-fg-subtle border border-dashed border-white/18 rounded-full px-2.5 py-0.5 hover:border-accent-brand/40 hover:text-fg-muted transition-colors duration-200"
                    >
                      <Plus className="w-3 h-3" />
                      Add a tagline
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {isEditing ? (
                    <>
                      <button
                        type="submit"
                        disabled={saving}
                        className="btn-primary px-3.5 py-2 rounded-[12px] text-[13px] flex items-center gap-1.5"
                      >
                        {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditing}
                        className="btn-ghost px-3.5 py-2 rounded-[12px] text-[13px]"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={startEditing}
                      className="btn-ghost px-3.5 py-2 rounded-[12px] text-[13px] flex items-center gap-1.5"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Edit profile
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-8 max-w-3xl mx-auto w-full pb-10 space-y-6">
        {profileError && (
          <div className="px-3.5 py-3 rounded-[12px] bg-danger/8 border border-danger/20 text-danger text-[13px]">
            {profileError}
          </div>
        )}

        {/* ---- Stats ---- */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {[
            { label: 'Matches', value: matchCount, icon: GitMerge },
            { label: 'Requests helped', value: helpedCount, icon: HandHelping },
            { label: 'Skills tagged', value: interestCount, icon: Code2 },
          ].map(({ label, value, icon: Icon }) => (
            <div
              key={label}
              className="glass rounded-[16px] px-3 py-3.5 sm:px-4 text-center"
            >
              <Icon className="w-3.5 h-3.5 text-accent-brand mx-auto mb-1.5 opacity-80" />
              <p className="text-xl sm:text-2xl font-semibold tracking-tight text-fg">
                <CountUp value={value} reducedMotion={reducedMotion} />
              </p>
              <p className="mono-label mt-1 !text-[10px] sm:!text-[11px] leading-tight">
                {label}
              </p>
            </div>
          ))}
        </div>

        {/* ---- Tabs ---- */}
        <LayoutGroup id="profile-tabs">
          <div
            role="tablist"
            className="glass inline-flex p-1 rounded-full w-full sm:w-auto relative"
          >
            {tabs.map(({ key, label }) => {
              const active = profileTab === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setProfileTab(key)}
                  className={`relative flex-1 sm:flex-none px-4 py-2 rounded-full text-[13px] font-medium transition-colors duration-200 ${
                    active ? 'text-fg' : 'text-fg-muted hover:text-fg'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="profile-tab-pill"
                      className="absolute inset-0 rounded-full bg-white/10"
                      transition={reducedMotion ? { duration: 0 } : SPRING_PILL}
                    />
                  )}
                  <span className="relative z-10">{label}</span>
                </button>
              );
            })}
          </div>
        </LayoutGroup>

        {/* ---- Tab panels ---- */}
        <div className="relative min-h-[200px]">
        <AnimatePresence mode="wait" initial={false}>
          {profileTab === 'overview' && (
            <motion.div
              key="overview"
              initial={reducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
              transition={{ duration: reducedMotion ? 0 : 0.28, ease: EASE }}
              className="space-y-5"
            >
              {/* Bio — README-style preview */}
              <motion.section
                layout={!reducedMotion}
                transition={reducedMotion ? { duration: 0 } : { layout: { duration: 0.32, ease: EASE } }}
                className="glass rounded-[18px] p-5 sm:p-6"
              >
                <p className="mono-label mb-2 !text-[10px] opacity-80">README.md</p>
                <h2 className="sr-only">Bio</h2>
                <MorphField
                  editing={isEditing}
                  display={
                    displayBio ? (
                      <p className="text-sm text-fg leading-relaxed">{displayBio}</p>
                    ) : (
                      <AddInvite label="Add a bio" onClick={startEditing} />
                    )
                  }
                >
                  <FloatingField
                    label="Bio"
                    as="textarea"
                    rows={4}
                    value={editBio}
                    onChange={setEditBio}
                  />
                </MorphField>
              </motion.section>

              {/* Stack & interests */}
              <motion.section
                layout={!reducedMotion}
                transition={reducedMotion ? { duration: 0 } : { layout: { duration: 0.32, ease: EASE } }}
                className="glass rounded-[18px] p-5 sm:p-6"
              >
                <h2 className="text-[13px] font-medium text-fg-muted mb-3">
                  Stack & interests
                </h2>
                <MorphField
                  editing={isEditing}
                  display={
                    displayInterests.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {displayInterests.map((interest) => {
                          const tone = languageTone(interest);
                          return (
                            <span
                              key={interest}
                              className="inline-flex items-center px-2.5 py-1 rounded-md text-[12px] font-mono border transition-transform duration-200 hover:-translate-y-0.5"
                              style={{
                                background: tone.bg,
                                borderColor: tone.border,
                                color: tone.text,
                              }}
                            >
                              {interest}
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <AddInvite label="Add skills" onClick={startEditing} />
                    )
                  }
                >
                  <div className="space-y-2.5">
                    {editInterests.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {editInterests.map((interest) => {
                          const tone = languageTone(interest);
                          return (
                            <span
                              key={interest}
                              className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-md text-[12px] font-mono border"
                              style={{
                                background: tone.bg,
                                borderColor: tone.border,
                                color: tone.text,
                              }}
                            >
                              {interest}
                              <button
                                type="button"
                                onClick={() =>
                                  setEditInterests(editInterests.filter((i) => i !== interest))
                                }
                                aria-label={`Remove ${interest}`}
                                className="p-0.5 rounded text-fg-subtle hover:text-danger transition-colors duration-200"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                    <div className="field">
                      <input
                        type="text"
                        placeholder="Add interest — Enter to confirm"
                        value={editInterestsInput}
                        onChange={(e) => setEditInterestsInput(e.target.value)}
                        onKeyDown={handleAddInterest}
                        className="w-full bg-transparent text-sm text-fg placeholder-fg-subtle focus:outline-none border-none px-3.5 py-2.5"
                      />
                    </div>
                  </div>
                </MorphField>
              </motion.section>

              {/* Looking for + Radius */}
              <div className="grid sm:grid-cols-2 gap-4">
                <motion.section
                  layout={!reducedMotion}
                  transition={reducedMotion ? { duration: 0 } : { layout: { duration: 0.32, ease: EASE } }}
                  className="glass rounded-[18px] p-5"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Search className="w-3.5 h-3.5 text-accent-brand" />
                    <h2 className="text-[13px] font-medium text-fg-muted">Looking for</h2>
                  </div>
                  <MorphField
                    editing={isEditing}
                    display={
                      displayLookingFor ? (
                        <div className="flex flex-wrap gap-1.5">
                          {LOOKING_FOR_PRESETS.map((opt) => {
                            const on =
                              displayLookingFor.toLowerCase() === opt.toLowerCase();
                            return (
                              <span
                                key={opt}
                                className={`px-2.5 py-1.5 rounded-full text-[12px] font-medium border ${
                                  on
                                    ? 'bg-accent-brand/15 border-accent-brand/40 text-fg'
                                    : 'bg-white/4 border-white/10 text-fg-subtle'
                                }`}
                              >
                                {opt}
                              </span>
                            );
                          })}
                          {!LOOKING_FOR_PRESETS.some(
                            (o) => o.toLowerCase() === displayLookingFor.toLowerCase()
                          ) && (
                            <span className="px-2.5 py-1.5 rounded-full text-[12px] font-medium bg-accent-brand/15 border border-accent-brand/40 text-fg">
                              {displayLookingFor}
                            </span>
                          )}
                        </div>
                      ) : (
                        <AddInvite
                          label="Add what you’re looking for"
                          onClick={startEditing}
                          className="!py-5"
                        />
                      )
                    }
                  >
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-1.5">
                        {LOOKING_FOR_PRESETS.map((opt) => {
                          const on =
                            editLookingFor.toLowerCase() === opt.toLowerCase();
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => setEditLookingFor(opt)}
                              className={`px-2.5 py-1.5 rounded-full text-[12px] font-medium border transition-colors duration-200 ${
                                on
                                  ? 'bg-accent-brand/15 border-accent-brand/40 text-fg'
                                  : 'bg-white/4 border-white/10 text-fg-subtle hover:border-white/20'
                              }`}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                      <FloatingField
                        label="Or write your own"
                        value={editLookingFor}
                        onChange={setEditLookingFor}
                      />
                    </div>
                  </MorphField>
                </motion.section>

                <motion.section
                  layout={!reducedMotion}
                  transition={reducedMotion ? { duration: 0 } : { layout: { duration: 0.32, ease: EASE } }}
                  className="glass rounded-[18px] p-5"
                >
                  <div className="flex items-center justify-between mb-3 gap-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-accent-brand" />
                      <h2 className="text-[13px] font-medium text-fg-muted">Radius</h2>
                    </div>
                    {displayRadius !== null && (
                      <span className="mono-label">{displayRadius} mi</span>
                    )}
                  </div>
                  <MorphField
                    editing={isEditing}
                    display={
                      displayRadius !== null ? (
                        <div className="pt-1">
                          <div className="h-2 rounded-full bg-white/8 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-accent-brand to-accent-bright"
                              style={{ width: `${radiusPct}%` }}
                            />
                          </div>
                          <div className="flex justify-between mt-2 mono-label !text-[10px]">
                            <span>0</span>
                            <span>{MAX_RADIUS} mi</span>
                          </div>
                        </div>
                      ) : (
                        <AddInvite
                          label="Set your radius"
                          onClick={startEditing}
                          className="!py-5"
                        />
                      )
                    }
                  >
                    <div className="pt-1">
                      <input
                        type="range"
                        min={0}
                        max={MAX_RADIUS}
                        value={editRadiusLimit}
                        onChange={(e) => setEditRadiusLimit(parseInt(e.target.value, 10) || 0)}
                        className="w-full accent-[var(--accent-brand)] h-2 cursor-pointer"
                      />
                      <div className="flex justify-between mt-2 items-center">
                        <span className="mono-label !text-[10px]">0</span>
                        <span className="text-[13px] font-medium text-fg">
                          {editRadiusLimit} miles
                        </span>
                        <span className="mono-label !text-[10px]">{MAX_RADIUS}</span>
                      </div>
                    </div>
                  </MorphField>
                </motion.section>
              </div>
            </motion.div>
          )}

          {profileTab === 'activity' && (
            <motion.div
              key="activity"
              initial={reducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
              transition={{ duration: reducedMotion ? 0 : 0.28, ease: EASE }}
            >
              {activityEvents.length === 0 ? (
                <div className="glass rounded-[18px] p-10 text-center">
                  <Users className="w-8 h-8 text-fg-subtle mx-auto mb-3" />
                  <p className="text-sm font-medium text-fg">No activity yet</p>
                  <p className="text-[13px] text-fg-muted mt-1.5 max-w-xs mx-auto leading-relaxed">
                    Matches and help requests will show up here as a timeline.
                  </p>
                </div>
              ) : (
                <div className="relative pl-2">
                  <div
                    className="absolute left-[19px] top-3 bottom-3 w-px bg-white/12"
                    aria-hidden
                  />
                  <ul className="space-y-0">
                    {activityEvents.map((ev, i) => {
                      const Icon =
                        ev.kind === 'match'
                          ? GitMerge
                          : ev.kind === 'helped'
                            ? HandHelping
                            : Code2;
                      return (
                        <motion.li
                          key={ev.id}
                          initial={reducedMotion ? false : { opacity: 0, y: 14 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true, margin: '-40px' }}
                          transition={
                            reducedMotion
                              ? { duration: 0 }
                              : { duration: 0.35, ease: EASE, delay: Math.min(i * 0.05, 0.35) }
                          }
                          className="relative flex gap-3.5 pb-6 last:pb-0"
                        >
                          <div
                            className={`relative z-10 w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 border ${
                              ev.kind === 'match'
                                ? 'bg-accent-brand/12 border-accent-brand/30 text-accent-brand'
                                : ev.kind === 'helped'
                                  ? 'bg-accent-merge/12 border-accent-merge/30 text-accent-merge'
                                  : 'bg-white/6 border-white/12 text-fg-muted'
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <div className="glass rounded-[14px] px-4 py-3 flex-1 min-w-0">
                            <div className="flex items-baseline justify-between gap-2">
                              <p className="text-[13px] font-medium text-fg">{ev.title}</p>
                              <span className="mono-label flex-shrink-0">{ev.timeLabel}</span>
                            </div>
                            <p className="text-[13px] text-fg-muted mt-0.5 truncate">
                              {ev.detail}
                            </p>
                          </div>
                        </motion.li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </motion.div>
          )}

          {profileTab === 'preferences' && (
            <motion.div
              key="preferences"
              initial={reducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
              transition={{ duration: reducedMotion ? 0 : 0.28, ease: EASE }}
              className="space-y-4"
            >
              <section className="glass rounded-[18px] p-5 sm:p-6 space-y-5">
                <div>
                  <h2 className="text-[13px] font-medium text-fg-muted mb-3">Account</h2>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3 py-2">
                      <div>
                        <p className="mono-label mb-0.5">email</p>
                        <p className="text-sm text-fg">{myProfile.user.email}</p>
                      </div>
                      <User className="w-4 h-4 text-fg-subtle flex-shrink-0" />
                    </div>
                    <div className="border-t border-white/12 pt-4">
                      <p className="mono-label mb-2">age</p>
                      <MorphField
                        editing={isEditing}
                        display={
                          <p className="text-sm font-medium text-fg">
                            {myProfile.age ?? (
                              <button
                                type="button"
                                onClick={startEditing}
                                className="inline-flex items-center gap-1.5 text-fg-subtle border border-dashed border-white/18 rounded-lg px-2.5 py-1 hover:border-accent-brand/35"
                              >
                                <Plus className="w-3 h-3" />
                                Add age
                              </button>
                            )}
                          </p>
                        }
                      >
                        <FloatingField
                          label="Age"
                          type="number"
                          min={18}
                          max={120}
                          value={editAge}
                          onChange={(v) => setEditAge(parseInt(v, 10) || 18)}
                          required
                        />
                      </MorphField>
                    </div>
                  </div>
                </div>
              </section>

              <button
                type="button"
                onClick={onLogout}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-[14px] text-sm font-medium text-danger bg-danger/8 border border-danger/15 hover:bg-danger/15 transition-colors duration-200"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </div>
    </form>
  );
};
