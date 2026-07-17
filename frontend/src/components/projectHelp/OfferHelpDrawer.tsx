import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { EASE, SPRING_DRAWER } from './helpers';

type OfferHelpDrawerProps = {
  open: boolean;
  requestTitle: string;
  onClose: () => void;
  onConfirm: (message: string) => void;
};

export const OfferHelpDrawer: React.FC<OfferHelpDrawerProps> = ({
  open,
  requestTitle,
  onClose,
  onConfirm,
}) => {
  const reduced = usePrefersReducedMotion();
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (open) setMessage('');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Close offer drawer"
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reduced ? { duration: 0 } : { duration: 0.2 }}
            onClick={onClose}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="offer-help-title"
            className="fixed inset-y-0 right-0 z-50 w-full max-w-md flex flex-col border-l border-white/12 bg-ink-900/95 backdrop-blur-[20px] shadow-[-12px_0_40px_rgba(0,0,0,0.45)]"
            initial={reduced ? { x: 0 } : { x: '100%' }}
            animate={{ x: 0 }}
            exit={reduced ? { opacity: 0 } : { x: '100%' }}
            transition={reduced ? { duration: 0 } : SPRING_DRAWER}
          >
            <div className="flex items-center justify-between px-5 h-14 border-b border-white/12">
              <div className="min-w-0">
                <p id="offer-help-title" className="text-[15px] font-semibold text-fg">
                  Offer help
                </p>
                <p className="text-[12px] text-fg-muted truncate mt-0.5">{requestTitle}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-md text-fg-subtle hover:text-fg hover:bg-white/5 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 p-5 space-y-4 overflow-y-auto">
              <p className="text-[13px] text-fg-muted leading-relaxed">
                Send a short note to the requester. You’ll be connected in Matches after confirming.
              </p>
              <div className="field">
                <textarea
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Hey — I can help with this. I’ve worked on similar WebSocket scaling…"
                  className="w-full bg-transparent text-sm text-fg placeholder-fg-subtle focus:outline-none border-none px-3.5 py-3 resize-none"
                  autoFocus
                />
              </div>
            </div>

            <div className="p-5 border-t border-white/12 flex justify-end gap-2.5">
              <button type="button" onClick={onClose} className="btn-ghost px-4 py-2 rounded-[12px] text-[13px]">
                Cancel
              </button>
              <motion.button
                type="button"
                onClick={() => onConfirm(message.trim())}
                className="btn-primary px-4 py-2 rounded-[12px] text-[13px]"
                whileTap={reduced ? undefined : { scale: 0.97 }}
                transition={{ duration: 0.15, ease: EASE }}
              >
                Confirm offer
              </motion.button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};
