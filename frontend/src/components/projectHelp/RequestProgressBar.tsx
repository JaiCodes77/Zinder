import React from 'react';
import { motion } from 'framer-motion';
import { REQUEST_STEPS, type RequestStatus } from '../RequestStepper';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { EASE, statusProgress } from './helpers';

type RequestProgressBarProps = {
  status: RequestStatus;
  className?: string;
};

/** Filled segmented progress bar with a soft glow on the active segment. */
export const RequestProgressBar: React.FC<RequestProgressBarProps> = ({
  status,
  className = '',
}) => {
  const reduced = usePrefersReducedMotion();
  const progress = statusProgress(status);
  const active = REQUEST_STEPS.findIndex((s) => s.key === status);

  return (
    <div className={`w-full ${className}`}>
      <div className="relative h-1.5 rounded-full bg-white/8 overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            background:
              'linear-gradient(90deg, rgba(232,166,89,0.55) 0%, rgba(232,166,89,0.95) 100%)',
            boxShadow: '0 0 10px rgba(232, 166, 89, 0.45), 0 0 2px rgba(232, 166, 89, 0.8)',
          }}
          initial={false}
          animate={{ width: `${progress * 100}%` }}
          transition={reduced ? { duration: 0 } : { duration: 0.4, ease: EASE }}
        />
        {/* Segment tick marks */}
        <div className="absolute inset-0 flex pointer-events-none">
          {REQUEST_STEPS.slice(0, -1).map((_, i) => (
            <div
              key={i}
              className="flex-1 border-r border-bg-base/60"
              style={{ opacity: 0.5 }}
            />
          ))}
          <div className="flex-1" />
        </div>
      </div>
      <div className="flex justify-between mt-1.5 px-0.5">
        {REQUEST_STEPS.map((step, i) => (
          <span
            key={step.key}
            className={`text-[9px] font-mono tracking-wide ${
              i === active ? 'text-accent-warm' : i < active ? 'text-fg-muted' : 'text-fg-subtle'
            }`}
          >
            {step.label}
          </span>
        ))}
      </div>
    </div>
  );
};
