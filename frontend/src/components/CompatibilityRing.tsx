import React, { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

type CompatibilityRingProps = {
  score: number; // 0–100
  size?: number;
  layoutId?: string;
  className?: string;
};

/** Top-tier uses brand violet; mid merge-green; low muted. */
function scoreBandColor(score: number): string {
  if (score >= 80) return '#B990FF';
  if (score >= 50) return '#3FB950';
  return '#7D8590';
}

/** Radial match score — color-banded; stroke-dash draws in when scrolled into view. */
export const CompatibilityRing: React.FC<CompatibilityRingProps> = ({
  score,
  size = 48,
  layoutId,
  className = '',
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const reduced = usePrefersReducedMotion();
  const clamped = Math.max(0, Math.min(100, score));
  const [progress, setProgress] = useState(reduced ? clamped : 0);

  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const stroke = scoreBandColor(clamped);

  useEffect(() => {
    if (!inView) return;
    if (reduced) {
      setProgress(clamped);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const duration = 750;
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
      style={{ width: size, height: size }}
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
          stroke={stroke}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span
        className="absolute text-[10px] font-mono font-medium tabular-nums"
        style={{ color: stroke }}
      >
        {Math.round(progress)}
      </span>
    </motion.div>
  );
};
