import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

export type RequestStatus = 'pending' | 'accepted' | 'in_progress' | 'completed';

export const REQUEST_STEPS: { key: RequestStatus; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Merged' },
];

const stepIndex = (s: RequestStatus) => REQUEST_STEPS.findIndex((x) => x.key === s);

type RequestStepperProps = {
  status: RequestStatus;
  onChange?: (next: RequestStatus) => void;
};

/** Horizontal status stepper — active uses merge green; completed uses brand. */
export const RequestStepper: React.FC<RequestStepperProps> = ({ status, onChange }) => {
  const active = stepIndex(status);
  const reduced = usePrefersReducedMotion();
  const progress = active <= 0 ? 0 : (active / (REQUEST_STEPS.length - 1)) * 100;
  const lineColor = status === 'completed' ? 'bg-accent-brand' : 'bg-accent-merge';

  return (
    <div className="w-full pt-1 pb-2">
      <div className="relative flex items-center justify-between px-1">
        <div className="absolute left-3 right-3 top-1/2 -translate-y-1/2 h-px bg-white/10" />
        <motion.div
          className={`absolute left-3 top-1/2 -translate-y-1/2 h-px ${lineColor} origin-left`}
          initial={false}
          animate={{ scaleX: progress / 100 }}
          style={{ width: 'calc(100% - 24px)', transformOrigin: 'left center' }}
          transition={
            reduced
              ? { duration: 0 }
              : { duration: 0.35, ease: [0.22, 1, 0.36, 1] }
          }
        />
        {REQUEST_STEPS.map((step, i) => {
          const isActive = i === active;
          const isDone = i < active;
          const filled =
            isActive || isDone
              ? status === 'completed' || (isDone && i === REQUEST_STEPS.length - 1)
                ? 'bg-accent-brand border-accent-brand'
                : 'bg-accent-merge border-accent-merge'
              : 'bg-ink-900 border-white/20';
          return (
            <button
              key={step.key}
              type="button"
              title={step.label}
              onClick={() => onChange?.(step.key)}
              className="relative z-10 flex flex-col items-center gap-1.5 group"
            >
              <motion.span
                className={`block w-2.5 h-2.5 rounded-full border ${filled}`}
                animate={{ scale: isActive ? 1.35 : 1 }}
                transition={
                  reduced
                    ? { duration: 0 }
                    : { duration: 0.25, ease: [0.22, 1, 0.36, 1] }
                }
              />
              <span
                className={`text-[10px] font-mono tracking-wide ${
                  isActive
                    ? status === 'completed'
                      ? 'text-accent-brand'
                      : 'text-accent-merge'
                    : 'text-fg-subtle'
                }`}
              >
                {step.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

type StatusBadgeProps = {
  status: RequestStatus;
};

/** GitHub-style issue/PR badges — pending outline, accepted/progress merge, completed brand filled. */
export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const label = REQUEST_STEPS.find((s) => s.key === status)?.label ?? status;
  const reduced = usePrefersReducedMotion();

  const tone =
    status === 'pending'
      ? 'bg-transparent text-fg-muted border-fg-subtle/40'
      : status === 'completed'
        ? 'bg-accent-brand text-bg-base border-accent-brand'
        : 'bg-accent-merge/12 text-accent-merge border-accent-merge/35';

  return (
    <span className="relative inline-flex h-5 items-center justify-center min-w-[4.5rem]">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={status}
          initial={reduced ? { opacity: 1 } : { opacity: 0, scale: 0.88 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.92 }}
          transition={
            reduced
              ? { duration: 0 }
              : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }
          }
          className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border ${tone}`}
        >
          {label}
        </motion.span>
      </AnimatePresence>
    </span>
  );
};
