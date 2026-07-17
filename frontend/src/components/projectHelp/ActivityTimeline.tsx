import React from 'react';
import { motion } from 'framer-motion';
import type { RequestStatus } from '../RequestStepper';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { ACTIVITY_STEPS } from './types';
import { activityIndex, EASE } from './helpers';

type ActivityTimelineProps = {
  status: RequestStatus;
  offerCount: number;
};

/** Vertical activity stepper — connecting line fill animates as status advances. */
export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({ status, offerCount }) => {
  const reduced = usePrefersReducedMotion();
  const active = activityIndex(status, offerCount);
  const fillPct =
    active <= 0 ? 0 : (active / (ACTIVITY_STEPS.length - 1)) * 100;

  return (
    <div className="glass rounded-[18px] p-5">
      <p className="kicker mb-4">Activity</p>
      <div className="relative pl-1">
        {/* Track */}
        <div className="absolute left-[9px] top-2 bottom-2 w-px bg-white/10 overflow-hidden">
          <motion.div
            className="absolute inset-x-0 top-0 w-px bg-accent-warm origin-top"
            style={{
              height: '100%',
              boxShadow: '0 0 8px rgba(232, 166, 89, 0.45)',
            }}
            initial={false}
            animate={{ scaleY: fillPct / 100 }}
            transition={reduced ? { duration: 0 } : { duration: 0.45, ease: EASE }}
          />
        </div>

        <ul className="relative space-y-5">
          {ACTIVITY_STEPS.map((step, i) => {
            const done = i < active;
            const current = i === active;
            return (
              <li key={step.key} className="flex items-start gap-3">
                <motion.span
                  className={`relative z-10 mt-0.5 w-[19px] h-[19px] rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    done || current
                      ? 'bg-accent-warm border-accent-warm'
                      : 'bg-ink-900 border-white/20'
                  }`}
                  animate={{ scale: current ? 1.15 : 1 }}
                  transition={reduced ? { duration: 0 } : { duration: 0.25, ease: EASE }}
                  style={
                    current
                      ? { boxShadow: '0 0 10px rgba(232, 166, 89, 0.55)' }
                      : undefined
                  }
                >
                  {(done || current) && (
                    <span className="w-1.5 h-1.5 rounded-full bg-bg-base" />
                  )}
                </motion.span>
                <div className="min-w-0 pt-0.5">
                  <p
                    className={`text-[13px] font-medium leading-tight ${
                      current ? 'text-accent-warm' : done ? 'text-fg' : 'text-fg-subtle'
                    }`}
                  >
                    {step.label}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};
