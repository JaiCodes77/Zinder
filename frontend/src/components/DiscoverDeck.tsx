import React, { useCallback, useEffect, useRef } from 'react';
import {
  motion,
  useMotionValue,
  useTransform,
  useSpring,
  animate,
} from 'framer-motion';
import {
  GitMerge,
  CircleSlash,
  Undo2,
  Star,
  Compass,
  MapPin,
  Loader2,
} from 'lucide-react';
import { CompatibilityRing } from './CompatibilityRing';
import { deckVisibleSlice, stackLayerStyle, swipeTop } from '../lib/deckStack';

export interface DeckProfile {
  id: number;
  name: string;
  age: number;
  distance: string;
  bio: string;
  image: string;
  interests: string[];
  /** Server browse score 0–100 when present. */
  score?: number;
}

export type DiscoverDeckProps = {
  profiles: DeckProfile[];
  setProfiles: React.Dispatch<React.SetStateAction<DeckProfile[]>>;
  setHistory: React.Dispatch<React.SetStateAction<DeckProfile[]>>;
  historyLength: number;
  loading: boolean;
  error: string | null;
  reducedMotion: boolean;
  activeProfile: DeckProfile | undefined;
  onLike: (userId: number) => void;
  onPass: (userId: number) => void;
  onSuperLike: (userId: number) => void;
  onRewind: () => void | Promise<void>;
  onRetry: () => void;
};

const EASE = [0.22, 1, 0.36, 1] as const;
const SPRING_PRESS = { type: 'spring' as const, stiffness: 520, damping: 18 };
const SPRING_STACK = { type: 'spring' as const, stiffness: 300, damping: 30 };

function useIsCoarsePointer(): boolean {
  const [coarse, setCoarse] = React.useState(() => {
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
      style={enabled ? { rotateX, rotateY, transformPerspective: 900 } : undefined}
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

const DeckSpinner: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex flex-col items-center justify-center gap-3 py-16">
    <Loader2 className="w-5 h-5 text-fg-subtle animate-spin" />
    <p className="mono-label">{label}</p>
  </div>
);

export const DiscoverDeck: React.FC<DiscoverDeckProps> = ({
  profiles,
  setProfiles,
  setHistory,
  historyLength,
  loading,
  error,
  reducedMotion,
  activeProfile,
  onLike,
  onPass,
  onSuperLike,
  onRewind,
  onRetry,
}) => {
  const coarsePointer = useIsCoarsePointer();
  const parallaxEnabled = !reducedMotion && !coarsePointer;

  const dragX = useMotionValue(0);
  const dragY = useMotionValue(0);
  const rotate = useTransform(dragX, [-200, 200], [-15, 15]);
  const cardOpacity = useTransform(
    dragX,
    [-200, -150, 0, 150, 200],
    [0.6, 0.95, 1, 0.95, 0.6]
  );
  const likeOpacity = useTransform(dragX, [0, 120], [0, 1]);
  const likeScale = useTransform(dragX, [0, 120], [0.8, 1]);
  const nopeOpacity = useTransform(dragX, [-120, 0], [1, 0]);
  const nopeScale = useTransform(dragX, [-120, 0], [1, 0.8]);
  const superLikeOpacity = useTransform(dragY, [-130, -60, 0], [1, 0, 0]);
  const superLikeScale = useTransform(dragY, [-130, -60], [1, 0.8]);
  const swipeInFlight = useRef(false);

  const removeTopCard = useCallback(() => {
    setProfiles((prev) => {
      const { remaining, swiped } = swipeTop(prev);
      if (swiped) setHistory((h) => [...h, swiped]);
      return remaining;
    });
    dragX.set(0);
    dragY.set(0);
    swipeInFlight.current = false;
  }, [dragX, dragY, setProfiles, setHistory]);

  const flyOff = useCallback(
    async (vx: number, vy: number, dir: 'left' | 'right' | 'up') => {
      if (swipeInFlight.current) return;
      swipeInFlight.current = true;

      try {
        const targetX =
          dir === 'up'
            ? dragX.get() + vx * 0.08
            : dir === 'right'
              ? Math.max(480, Math.abs(vx) * 0.35)
              : -Math.max(480, Math.abs(vx) * 0.35);
        const targetY =
          dir === 'up' ? -Math.max(520, Math.abs(vy) * 0.4) : dragY.get() + vy * 0.12;

        if (reducedMotion) {
          removeTopCard();
          return;
        }

        await Promise.all([
          animate(dragX, targetX, { type: 'tween', duration: 0.28, ease: EASE }),
          animate(dragY, targetY, { type: 'tween', duration: 0.28, ease: EASE }),
        ]);
        removeTopCard();
      } catch {
        swipeInFlight.current = false;
        dragX.set(0);
        dragY.set(0);
      }
    },
    [dragX, dragY, reducedMotion, removeTopCard]
  );

  const handleLike = useCallback(
    (userId: number, vx = 800, vy = 0) => {
      onLike(userId);
      void flyOff(vx, vy, 'right');
    },
    [flyOff, onLike]
  );

  const handlePass = useCallback(
    (userId: number, vx = -800, vy = 0) => {
      onPass(userId);
      void flyOff(vx, vy, 'left');
    },
    [flyOff, onPass]
  );

  const handleSuperLike = useCallback(
    (userId: number, vx = 0, vy = -900) => {
      onSuperLike(userId);
      void flyOff(vx, vy, 'up');
    },
    [flyOff, onSuperLike]
  );

  const handleRewindClick = useCallback(() => {
    if (historyLength === 0 || swipeInFlight.current) return;
    dragX.set(0);
    dragY.set(0);
    void onRewind();
  }, [dragX, dragY, historyLength, onRewind]);

  const handleDragEnd = (
    _event: unknown,
    info: { offset: { x: number; y: number }; velocity: { x: number; y: number } }
  ) => {
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

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);
      if (typing) return;

      const top = profiles[0];
      if (e.key === 'ArrowLeft' && top) {
        e.preventDefault();
        handlePass(top.id);
      } else if (e.key === 'ArrowRight' && top) {
        e.preventDefault();
        handleLike(top.id);
      } else if (e.key === 'ArrowUp' && top) {
        e.preventDefault();
        handleSuperLike(top.id);
      } else if ((e.key === 'u' || e.key === 'U') && historyLength > 0) {
        e.preventDefault();
        handleRewindClick();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [profiles, historyLength, handleLike, handlePass, handleSuperLike, handleRewindClick]);

  return (
    <div
      className="relative flex flex-col items-center w-full max-w-[640px]"
      role="region"
      aria-label="Discover deck"
    >
      <p className="sr-only">
        Keyboard: Left arrow to pass, Right arrow to merge, Up arrow to star, U to undo the last
        swipe.
      </p>
      {!reducedMotion && (
        <div className="pointer-events-none absolute inset-0 z-0 overflow-visible" aria-hidden>
          <div className="discover-blob-a" />
          <div className="discover-blob-b" />
        </div>
      )}

      <div className="relative z-[1] w-full max-w-[380px] aspect-[3/4.2] mb-8 overflow-visible">
        {loading && profiles.length === 0 ? (
          <div className="absolute inset-0 glass rounded-[18px] flex items-center justify-center z-[3]">
            <DeckSpinner label="loading candidates" />
          </div>
        ) : error ? (
          <div className="absolute inset-0 glass rounded-[18px] flex flex-col items-center justify-center p-8 text-center z-[1]">
            <h3 className="text-base font-semibold text-fg mb-1.5">Couldn’t load candidates</h3>
            <p className="text-[13px] text-fg-muted max-w-[240px] leading-relaxed">
              Something went wrong fetching the feed. Try again.
            </p>
            <button
              type="button"
              onClick={onRetry}
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
              onClick={onRetry}
              className="btn-ghost mt-6 px-4 py-2 rounded-[12px] text-[13px]"
            >
              Check again
            </button>
          </div>
        ) : (
          <>
            {deckVisibleSlice(profiles).map((profile, index) => {
              const isTop = index === 0;
              return (
                <motion.div
                  key={profile.id}
                  data-deck-card={profile.id}
                  data-deck-index={index}
                  initial={false}
                  animate={stackLayerStyle(index, reducedMotion)}
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
                      <motion.div
                        style={{ opacity: likeOpacity, scale: likeScale }}
                        className="absolute top-7 right-5 z-30 rotate-12 px-3.5 py-1.5 border-[2.5px] border-[#3FB950] text-[#3FB950] rounded-md font-mono font-bold text-xl tracking-[0.18em] uppercase pointer-events-none bg-transparent"
                      >
                        Merge
                      </motion.div>
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
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex items-baseline gap-2">
                              <h2 className="text-xl font-semibold tracking-tight text-fg truncate">
                                {profile.name}
                              </h2>
                              <span className="text-lg text-fg-muted font-normal flex-shrink-0">
                                {profile.age}
                              </span>
                            </div>
                            {typeof profile.score === 'number' && (
                              <div
                                className="flex-shrink-0"
                                title="Match score from server"
                              >
                                <CompatibilityRing
                                  score={profile.score}
                                  size={44}
                                  layoutId={`deck-compat-${profile.id}`}
                                />
                              </div>
                            )}
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
          </>
        )}
      </div>

      <div
        className="w-full max-w-[380px] flex justify-center items-center gap-5 mt-2 relative z-10"
        role="group"
        aria-label="Swipe actions"
      >
        <motion.button
          type="button"
          whileTap={reducedMotion ? undefined : { scale: 0.9 }}
          transition={SPRING_PRESS}
          onClick={handleRewindClick}
          disabled={historyLength === 0}
          title="Undo last swipe (U)"
          aria-label="Undo last swipe"
          aria-keyshortcuts="u"
          style={{ width: 48, height: 48 }}
          className="rounded-full border border-white/10 glass flex items-center justify-center text-fg-subtle opacity-70 hover:opacity-100 hover:text-fg-muted disabled:opacity-35 disabled:pointer-events-none transition-opacity duration-200"
        >
          <Undo2 className="w-4 h-4" aria-hidden />
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
          title="Pass / Close (←)"
          aria-label={activeProfile ? `Pass on ${activeProfile.name}` : 'Pass'}
          aria-keyshortcuts="ArrowLeft"
          style={{ width: 64, height: 64 }}
          className="rounded-full border border-[#E5534B]/50 glass flex items-center justify-center text-[#E5534B] hover:bg-[#E5534B]/10 disabled:opacity-35 disabled:pointer-events-none"
        >
          <CircleSlash className="w-6 h-6" strokeWidth={2.25} aria-hidden />
        </motion.button>
        <motion.button
          type="button"
          whileTap={reducedMotion ? undefined : { scale: 0.9 }}
          transition={SPRING_PRESS}
          onClick={() => activeProfile && handleSuperLike(activeProfile.id)}
          disabled={!activeProfile}
          title="Star (↑)"
          aria-label={activeProfile ? `Star ${activeProfile.name}` : 'Star'}
          aria-keyshortcuts="ArrowUp"
          style={{ width: 48, height: 48 }}
          className="rounded-full border border-white/10 glass flex items-center justify-center text-[#E3B341] opacity-70 hover:opacity-100 hover:border-[#E3B341]/40 hover:bg-[#E3B341]/10 disabled:opacity-35 disabled:pointer-events-none transition-opacity duration-200"
        >
          <Star className="w-4 h-4" aria-hidden />
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
          title="Merge / Like (→)"
          aria-label={activeProfile ? `Merge with ${activeProfile.name}` : 'Merge'}
          aria-keyshortcuts="ArrowRight"
          style={{ width: 64, height: 64 }}
          className="rounded-full border border-[#3FB950]/50 glass flex items-center justify-center text-[#3FB950] hover:bg-[#3FB950]/10 disabled:opacity-35 disabled:pointer-events-none"
        >
          <GitMerge className="w-6 h-6" aria-hidden />
        </motion.button>
      </div>
    </div>
  );
};
