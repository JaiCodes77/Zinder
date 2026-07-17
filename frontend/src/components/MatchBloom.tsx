import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import gsap from 'gsap';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

type MatchBloomProps = {
  myInitials: string;
  theirName: string;
  theirAvatar: string;
  onComplete: () => void;
};

const PARTICLE_COUNT = 28;

/**
 * The Bloom — sole GSAP sequence in the app.
 * Avatars ease together; warm amber particles radiate; merge into one glass card.
 * Reduced motion: instant fade, no particles.
 */
export const MatchBloom: React.FC<MatchBloomProps> = ({
  myInitials,
  theirName,
  theirAvatar,
  onComplete,
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const completed = useRef(false);

  useEffect(() => {
    const finish = () => {
      if (completed.current) return;
      completed.current = true;
      onComplete();
    };

    if (reduced) {
      const t = window.setTimeout(finish, 180);
      return () => clearTimeout(t);
    }

    const ctx = gsap.context(() => {
      const particles = particlesRef.current?.querySelectorAll('.bloom-particle') ?? [];
      const tl = gsap.timeline({
        onComplete: finish,
        defaults: { ease: 'power2.out' },
      });

      gsap.set(cardRef.current, { opacity: 0, scale: 0.92 });
      gsap.set(particles, { opacity: 0, scale: 0 });

      tl.to(leftRef.current, { x: 36, duration: 0.55 }, 0)
        .to(rightRef.current, { x: -36, duration: 0.55 }, 0)
        .to(
          particles,
          {
            opacity: 1,
            scale: 1,
            duration: 0.35,
            stagger: 0.012,
          },
          0.35
        )
        .to(
          particles,
          {
            x: (i) => Math.cos((i / PARTICLE_COUNT) * Math.PI * 2) * (70 + (i % 5) * 18),
            y: (i) => Math.sin((i / PARTICLE_COUNT) * Math.PI * 2) * (70 + (i % 5) * 18),
            opacity: 0,
            duration: 0.85,
            stagger: 0.008,
          },
          0.45
        )
        .to([leftRef.current, rightRef.current], { opacity: 0, scale: 0.85, duration: 0.25 }, 0.85)
        .to(cardRef.current, { opacity: 1, scale: 1, duration: 0.4 }, 0.95)
        .to({}, { duration: 0.35 }); // brief hold before CTA handoff
    }, rootRef);

    return () => ctx.revert();
  }, [onComplete, reduced]);

  return (
    <div
      ref={rootRef}
      className="relative flex flex-col items-center justify-center w-full max-w-sm min-h-[280px]"
      aria-live="polite"
      aria-label={`It's a match with ${theirName}`}
    >
      {!reduced && (
        <div ref={particlesRef} className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {Array.from({ length: PARTICLE_COUNT }).map((_, i) => (
            <span
              key={i}
              className="bloom-particle absolute w-1.5 h-1.5 rounded-full"
              style={{
                background: i % 3 === 0 ? '#f0bc7a' : '#e8a659',
                willChange: 'transform, opacity',
              }}
            />
          ))}
        </div>
      )}

      <div className="relative flex items-center justify-center gap-10 mb-2 min-h-[96px]">
        <div
          ref={leftRef}
          className="w-20 h-20 rounded-full p-[2px] bg-gradient-to-br from-accent-warm to-accent-deep will-change-transform"
        >
          <div className="w-full h-full rounded-full bg-ink-900 flex items-center justify-center font-semibold text-lg text-fg">
            {myInitials}
          </div>
        </div>
        <div
          ref={rightRef}
          className="w-20 h-20 rounded-full p-[2px] bg-gradient-to-br from-accent-warm to-accent-deep will-change-transform"
        >
          <div className="w-full h-full rounded-full bg-ink-900 overflow-hidden">
            <img src={theirAvatar} alt={theirName} className="w-full h-full object-cover" />
          </div>
        </div>
      </div>

      <motion.div
        ref={cardRef}
        className="glass-raised w-full px-6 py-5 text-center"
        style={reduced ? { opacity: 1 } : undefined}
      >
        <p className="mono-label mb-2">mutual like</p>
        <h1 className="display-italic text-[28px] text-gradient-brand leading-tight">It’s a match</h1>
        <p className="text-sm text-fg-muted mt-2">
          You and <span className="text-fg font-medium">{theirName}</span> liked each other.
        </p>
      </motion.div>
    </div>
  );
};
