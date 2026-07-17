import React, { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

type CompatibilityRingProps = {
  score: number; // 0–100
  size?: number;
  layoutId?: string;
  className?: string;
};

function scoreBandColor(score: number): { stroke: string; glow: string; text: string } {
  if (score >= 80) {
    return {
      stroke: 'var(--accent-cool)',
      glow: 'rgba(94, 234, 212, 0.35)',
      text: 'text-accent-cool',
    };
  }
  if (score >= 50) {
    return {
      stroke: 'var(--accent-warm)',
      glow: 'rgba(232, 166, 89, 0.35)',
      text: 'text-accent-warm',
    };
  }
  return {
    stroke: 'rgba(139, 147, 167, 0.75)',
    glow: 'rgba(139, 147, 167, 0.2)',
    text: 'text-fg-muted',
  };
}

/** Radial match score — color-banded; draws in on scroll into view; layoutId for shared morph. */
export const CompatibilityRing: React.FC<CompatibilityRingProps> = ({
  score,
  size = 48,
  layoutId,
  className = '',
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-20px' });
  const reduced = usePrefersReducedMotion();
  const [progress, setProgress] = useState(reduced ? score : 0);

  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const band = scoreBandColor(clamped);

  useEffect(() => {
    if (!inView) return;
    if (reduced) {
      setProgress(clamped);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const duration = 700;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setProgress(clamped * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, clamped, reduced]);

  const offset = circumference - (progress / 100) * circumference;

  return (
    <motion.div
      ref={ref}
      layoutId={layoutId}
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{
        width: size,
        height: size,
        filter: inView && !reduced ? `drop-shadow(0 0 6px ${band.glow})` : undefined,
      }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={3}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={band.stroke}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: reduced ? 'none' : undefined }}
        />
      </svg>
      <span className={`absolute text-[10px] font-mono font-medium tabular-nums ${band.text}`}>
        {Math.round(progress)}
      </span>
    </motion.div>
  );
};
