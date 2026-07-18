import React from 'react';
import { motion } from 'framer-motion';
import { MessageCircle } from 'lucide-react';
import type { Match } from './types';

export const MATCH_EASE = [0.22, 1, 0.36, 1] as const;

export const CHAT_STARTERS = ['👋 Say hi', 'Ask about their stack', 'What are you building?'] as const;

/**
 * Honest online: live WS for the open chat, else last-known presence for that
 * match_id (from a prior subscribe). Never invents dots from id hashes.
 */
export function resolveMatchOnline(opts: {
  matchId?: number;
  selected: boolean;
  isLiveChat: boolean;
  peerOnline: boolean;
  presenceByMatchId?: Record<number, boolean>;
}): boolean {
  if (opts.selected && opts.isLiveChat) return opts.peerOnline;
  if (typeof opts.matchId === 'number') {
    return opts.presenceByMatchId?.[opts.matchId] === true;
  }
  return false;
}

export const DateSeparator: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex items-center gap-3 py-3" role="separator" aria-label={label}>
    <div className="flex-1 h-px bg-white/10" />
    <span className="mono-label !text-[10px] uppercase tracking-[0.14em]">{label}</span>
    <div className="flex-1 h-px bg-white/10" />
  </div>
);

export const OnlinePresence: React.FC<{
  reducedMotion: boolean;
  size?: 'sm' | 'md';
  /** Chat uses a soft human pulse; list keeps quiet tool chrome. */
  tone?: 'tool' | 'human';
}> = ({ reducedMotion, size = 'md', tone = 'tool' }) => {
  const dot = size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5';
  const color = tone === 'human' ? 'bg-fg-muted' : 'bg-accent-merge';
  return (
    <span className={`absolute bottom-0 right-0 ${dot} flex items-center justify-center`}>
      {!reducedMotion && (
        <motion.span
          className={`absolute inset-0 rounded-full ${color}/55`}
          animate={{ scale: [1, 1.75], opacity: [0.55, 0] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }}
        />
      )}
      <span className={`relative ${dot} rounded-full ${color} border-[1.5px] border-bg-base`} />
    </span>
  );
};

export const MatchEmptyChat: React.FC<{
  name: string;
  avatar: string;
  reducedMotion: boolean;
  onSuggest: (text: string) => void;
}> = ({ name, avatar, reducedMotion, onSuggest }) => (
  <div className="flex-1 min-h-[320px] flex flex-col items-center justify-center text-center px-4">
    <p className="kicker mb-4">open diff</p>
    <div className="relative w-[140px] h-[140px] mb-2 flex items-center justify-center">
      {[0, 1].map((i) => (
        <motion.div
          key={i}
          className="absolute w-14 h-14 rounded-full border border-white/25 pointer-events-none"
          initial={false}
          animate={
            reducedMotion
              ? { opacity: 0.28, scale: 1 + i * 0.35 }
              : { scale: [1, 1.8], opacity: [0.5, 0] }
          }
          transition={
            reducedMotion
              ? { duration: 0 }
              : { duration: 2, repeat: Infinity, ease: 'easeOut', delay: i * 1 }
          }
        />
      ))}
      <div className="relative z-10 w-14 h-14 rounded-full overflow-hidden border border-white/14">
        <img src={avatar} alt={name} className="w-full h-full object-cover" />
      </div>
    </div>

    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: reducedMotion ? 0 : 0.45, duration: 0.4, ease: MATCH_EASE }}
      className="space-y-1"
    >
      <p className="display text-lg text-fg">You matched with {name}</p>
      <p className="text-sm text-fg-muted mt-1">Say hi and start the conversation.</p>
    </motion.div>

    <div className="mt-5 flex flex-wrap items-center justify-center gap-2 max-w-[340px]">
      {CHAT_STARTERS.map((label, i) => (
        <motion.button
          key={label}
          type="button"
          onClick={() => onSuggest(label)}
          initial={reducedMotion ? false : { opacity: 0, y: 8 }}
          animate={
            reducedMotion
              ? { opacity: 1, y: 0 }
              : { opacity: 1, y: [0, -3, 0] }
          }
          transition={
            reducedMotion
              ? { duration: 0 }
              : {
                  opacity: { delay: 0.65 + i * 0.08, duration: 0.3, ease: MATCH_EASE },
                  y: {
                    delay: 1 + i * 0.45,
                    duration: 3.2 + i * 0.5,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  },
                }
          }
          className="px-3 py-1.5 rounded-full text-[12px] text-fg-muted bg-white/6 border border-white/12 hover:bg-white/10 hover:text-fg hover:border-white/25 transition-colors duration-200"
        >
          {label}
        </motion.button>
      ))}
    </div>
  </div>
);

export const NoConversationOpen: React.FC<{
  matches: Match[];
  reducedMotion: boolean;
  onSelect: (match: Match) => void;
}> = ({ matches, reducedMotion, onSelect }) => (
  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
    <p className="kicker mb-4">inbox</p>
    <motion.div
      className="w-12 h-12 rounded-[14px] bg-white/6 border border-white/12 flex items-center justify-center mb-4 text-fg-subtle"
      animate={reducedMotion ? undefined : { y: [0, -4, 0] }}
      transition={
        reducedMotion
          ? { duration: 0 }
          : { duration: 3, repeat: Infinity, ease: 'easeInOut' }
      }
    >
      <MessageCircle className="w-5 h-5" />
    </motion.div>
    <h3 className="display text-[18px] text-fg">No conversation open</h3>
    <p className="text-[13px] text-fg-muted mt-1.5 max-w-[260px] leading-relaxed">
      Pick a match from the list — refresh keeps the thread via{' '}
      <span className="font-mono text-fg-subtle">#/matches/:id</span>.
    </p>

    {matches.length > 0 && (
      <div className="mt-6 flex items-center justify-center gap-2.5 flex-wrap max-w-[280px]">
        {matches.slice(0, 6).map((match, i) => (
          <motion.button
            key={match.id}
            type="button"
            title={match.name}
            aria-label={`Open chat with ${match.name}`}
            onClick={() => onSelect(match)}
            initial={reducedMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: reducedMotion ? 0 : i * 0.05,
              duration: reducedMotion ? 0 : 0.35,
              ease: MATCH_EASE,
            }}
            className="relative w-10 h-10 rounded-full overflow-hidden border border-white/14 hover:border-accent-brand/50 hover:scale-105 transition-[border-color,transform] duration-200"
          >
            <img src={match.avatar} alt={match.name} className="w-full h-full object-cover" />
          </motion.button>
        ))}
      </div>
    )}
  </div>
);
