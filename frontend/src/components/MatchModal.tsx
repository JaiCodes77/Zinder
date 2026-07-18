import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MatchBloom } from './MatchBloom';

const EASE = [0.22, 1, 0.36, 1] as const;

export type MatchModalData = {
  id: number;
  matchId?: number;
  name: string;
  avatar: string;
};

export type MatchModalProps = {
  open: boolean;
  data: MatchModalData | null;
  bloomDone: boolean;
  reducedMotion: boolean;
  myInitials: string;
  onBloomComplete: () => void;
  onSendMessage: () => void;
  onDismiss: () => void;
};

export const MatchModal: React.FC<MatchModalProps> = ({
  open,
  data,
  bloomDone,
  reducedMotion,
  myInitials,
  onBloomComplete,
  onSendMessage,
  onDismiss,
}) => (
  <AnimatePresence>
    {open && data && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg-base/85 backdrop-blur-md"
      >
        <div className="relative w-full max-w-sm">
          {!bloomDone ? (
            <MatchBloom
              myInitials={myInitials}
              theirName={data.name}
              theirAvatar={data.avatar}
              onComplete={onBloomComplete}
            />
          ) : (
            <motion.div
              initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: EASE }}
              className="glass-raised rounded-[18px] p-8 text-center"
            >
              <p className="mono-label mb-3">merged</p>
              <h1 className="display-italic text-[28px] text-gradient-brand mb-2">
                It’s a match
              </h1>
              <p className="text-sm text-fg-muted mb-8">
                You and <span className="text-fg font-medium">{data.name}</span> liked each other.
              </p>
              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={onSendMessage}
                  className="btn-primary w-full py-2.5 rounded-[12px] text-sm"
                >
                  Send a message
                </button>
                <button
                  type="button"
                  onClick={onDismiss}
                  className="btn-ghost w-full py-2.5 rounded-[12px] text-sm"
                >
                  Keep browsing
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);
