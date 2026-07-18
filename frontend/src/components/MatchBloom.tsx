import React, { useEffect, useId, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

type MatchBloomProps = {
  myInitials: string;
  theirName: string;
  theirAvatar: string;
  theirAccent?: string;
  onComplete: () => void;
};

const MY_ACCENT = '#B990FF';
const THEIR_ACCENT = '#3FB950';
const MERGE_GLOW = '#B990FF';

function playfulCommitHash(): string {
  const hex = '0123456789abcdef';
  let out = '';
  for (let i = 0; i < 7; i++) out += hex[Math.floor(Math.random() * hex.length)];
  return out;
}

/**
 * Merge moment — two branch lines curve into a single node (git merge graph).
 * Bold signature animation only; reduced motion → short crossfade, then handoff.
 */
export const MatchBloom: React.FC<MatchBloomProps> = ({
  myInitials,
  theirName,
  theirAvatar,
  theirAccent = THEIR_ACCENT,
  onComplete,
}) => {
  const reduced = usePrefersReducedMotion();
  const completed = useRef(false);
  const commitHash = useMemo(() => playfulCommitHash(), []);
  const uid = useId().replace(/:/g, '');

  const finish = () => {
    if (completed.current) return;
    completed.current = true;
    onComplete();
  };

  useEffect(() => {
    if (reduced) {
      const t = window.setTimeout(finish, 280);
      return () => clearTimeout(t);
    }
    const t = window.setTimeout(finish, 2100);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  if (reduced) {
    return (
      <motion.div
        className="relative flex flex-col items-center justify-center w-full max-w-sm min-h-[260px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25 }}
        aria-live="polite"
        aria-label={`It's a match with ${theirName}`}
      >
        <AvatarPair
          myInitials={myInitials}
          theirName={theirName}
          theirAvatar={theirAvatar}
          theirAccent={theirAccent}
        />
        <p className="display-italic text-xl text-gradient-brand mt-4">It’s a match</p>
      </motion.div>
    );
  }

  return (
    <div
      className="relative flex flex-col items-center justify-center w-full max-w-sm min-h-[300px]"
      aria-live="polite"
      aria-label={`It's a match with ${theirName}`}
    >
      <svg
        viewBox="0 0 280 160"
        className="w-full max-w-[280px] h-[160px]"
        fill="none"
        aria-hidden
      >
        <defs>
          <filter id={`glow-${uid}`} x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <motion.circle
          cx="140"
          cy="108"
          r="32"
          fill={MERGE_GLOW}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0, 0.35, 0.18] }}
          transition={{ duration: 1.6, times: [0, 0.45, 0.7, 1], ease: 'easeOut' }}
          style={{ filter: `url(#glow-${uid})` }}
        />

        {/* Left branch (you) */}
        <motion.path
          d="M 40 36 C 96 36, 112 84, 140 108"
          stroke={MY_ACCENT}
          strokeWidth="2.5"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0.4 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
        />
        {/* Right branch (them) */}
        <motion.path
          d="M 240 36 C 184 36, 168 84, 140 108"
          stroke={theirAccent}
          strokeWidth="2.5"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0.4 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
        />

        {/* Start nodes */}
        <motion.circle
          cx="40"
          cy="36"
          r="5.5"
          fill={MY_ACCENT}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.25, delay: 0.05 }}
          style={{ transformOrigin: '40px 36px' }}
        />
        <motion.circle
          cx="240"
          cy="36"
          r="5.5"
          fill={theirAccent}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.25, delay: 0.05 }}
          style={{ transformOrigin: '240px 36px' }}
        />

        {/* Accent dots traveling along branches via motion path */}
        <BranchDot
          path="M 40 36 C 96 36, 112 84, 140 108"
          color={MY_ACCENT}
          delay={0.15}
        />
        <BranchDot
          path="M 240 36 C 184 36, 168 84, 140 108"
          color={theirAccent}
          delay={0.15}
        />

        {/* Merge commit node */}
        <motion.g
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.85, ease: [0.22, 1, 0.36, 1] }}
          style={{ transformOrigin: '140px 108px' }}
        >
          <circle cx="140" cy="108" r="10" fill={MERGE_GLOW} filter={`url(#glow-${uid})`} />
          <circle cx="140" cy="108" r="6" fill="#0A0E12" stroke={MERGE_GLOW} strokeWidth="2" />
        </motion.g>
      </svg>

      <motion.p
        className="mono-label !text-accent-brand -mt-1 mb-5"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 1.0, ease: [0.22, 1, 0.36, 1] }}
      >
        {commitHash}
      </motion.p>

      <AvatarPair
        myInitials={myInitials}
        theirName={theirName}
        theirAvatar={theirAvatar}
        theirAccent={theirAccent}
      />
    </div>
  );
};

/** Dot that follows a cubic bezier via SVG animateMotion. */
function BranchDot({ path, color, delay }: { path: string; color: string; delay: number }) {
  return (
    <circle r="4" fill={color} opacity={0}>
      <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.85;1" dur="0.9s" begin={`${delay}s`} fill="freeze" />
      <animateMotion
        path={path}
        dur="0.9s"
        begin={`${delay}s`}
        fill="freeze"
        calcMode="spline"
        keySplines="0.22 1 0.36 1"
        keyTimes="0;1"
      />
    </circle>
  );
}

function AvatarPair({
  myInitials,
  theirName,
  theirAvatar,
  theirAccent,
}: {
  myInitials: string;
  theirName: string;
  theirAvatar: string;
  theirAccent: string;
}) {
  return (
    <div className="flex items-center justify-center gap-4">
      <div
        className="w-14 h-14 rounded-full p-[2px]"
        style={{ background: `linear-gradient(135deg, ${MY_ACCENT}, #9b6fe8)` }}
      >
        <div className="w-full h-full rounded-full bg-ink-900 flex items-center justify-center text-sm font-semibold text-fg">
          {myInitials}
        </div>
      </div>
      <div
        className="w-14 h-14 rounded-full p-[2px]"
        style={{ background: `linear-gradient(135deg, ${theirAccent}, #2ea043)` }}
      >
        <div className="w-full h-full rounded-full bg-ink-900 overflow-hidden">
          <img src={theirAvatar} alt={theirName} className="w-full h-full object-cover" />
        </div>
      </div>
    </div>
  );
}
