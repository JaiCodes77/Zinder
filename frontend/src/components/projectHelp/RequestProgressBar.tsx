import React from 'react';
import { motion } from 'framer-motion';
import { REQUEST_STEPS, type RequestStatus } from '../RequestStepper';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { EASE, statusProgress } from './helpers';

type RequestProgressBarProps = {
  status: RequestStatus;
  className?: string;
};

/** Filled segmented progress bar — soft glow on the leading edge of the fill. */
export const RequestProgressBar: React.FC<RequestProgressBarProps> = ({
  status,
  className = '',
}) => {
  const reduced = usePrefersReducedMotion();
  const progress = statusProgress(status);
  const active = REQUEST_STEPS.findIndex((s) => s.key === status);
  const pct = progress * 100;

  return (
    <div className={`w-full ${className}`}>
      {/* Outer track allows glow to spill; inner clips the fill only */}
      <div className="relative h-1.5 rounded-full">
        <div className="absolute inset-0 rounded-full bg-white/8 overflow-hidden">
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              background:
                status === 'completed'
                  ? 'linear-gradient(90deg, rgba(185,144,255,0.45) 0%, rgba(185,144,255,0.95) 100%)'
                  : 'linear-gradient(90deg, rgba(63,185,80,0.4) 0%, rgba(63,185,80,0.95) 100%)',
            }}
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={reduced ? { duration: 0 } : { duration: 0.4, ease: EASE }}
          />
          <div className="absolute inset-0 flex pointer-events-none">
            {REQUEST_STEPS.slice(0, -1).map((_, i) => (
              <div key={i} className="flex-1 border-r border-bg-base/60 opacity-50" />
            ))}
            <div className="flex-1" />
          </div>
        </div>

        {/* Leading-edge glow (outside overflow clip) */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full"
          style={{
            width: 10,
            height: 10,
            background:
              status === 'completed'
                ? 'radial-gradient(circle, rgba(185,144,255,0.95) 0%, rgba(185,144,255,0.35) 45%, transparent 70%)'
                : 'radial-gradient(circle, rgba(63,185,80,0.95) 0%, rgba(63,185,80,0.35) 45%, transparent 70%)',
            boxShadow:
              status === 'completed'
                ? '0 0 8px 3px rgba(185, 144, 255, 0.55), 0 0 18px 6px rgba(185, 144, 255, 0.25)'
                : '0 0 8px 3px rgba(63, 185, 80, 0.5), 0 0 18px 6px rgba(63, 185, 80, 0.22)',
          }}
          initial={false}
          animate={{ left: `${pct}%` }}
          transition={reduced ? { duration: 0 } : { duration: 0.4, ease: EASE }}
        />
      </div>
      <div className="flex justify-between mt-1.5 px-0.5">
        {REQUEST_STEPS.map((step, i) => (
          <span
            key={step.key}
            className={`text-[9px] font-mono tracking-wide ${
              i === active
                ? status === 'completed'
                  ? 'text-accent-brand'
                  : 'text-accent-merge'
                : i < active
                  ? 'text-fg-muted'
                  : 'text-fg-subtle'
            }`}
          >
            {step.label}
          </span>
        ))}
      </div>
    </div>
  );
};
