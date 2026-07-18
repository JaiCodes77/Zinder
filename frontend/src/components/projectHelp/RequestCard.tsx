import React from 'react';
import { motion } from 'framer-motion';
import { REQUEST_STEPS, StatusBadge, type RequestStatus } from '../RequestStepper';
import { CATEGORY_COLORS, inferCategory } from './colors';
import {
  deriveInterested,
  formatRequestId,
  formatWhen,
  getInitials,
} from './helpers';
import type { ProjectRequest, Urgency } from './types';
import { RequestProgressBar } from './RequestProgressBar';
import { TechChip } from './TechChip';

type RequestCardProps = {
  project: ProjectRequest;
  status: RequestStatus;
  urgency?: Urgency;
  onClick: () => void;
  /** Compact preview mode for the new-request review step. */
  preview?: boolean;
  interestOverride?: number;
  /** Click status badge to cycle (demo / local status without backend). */
  onCycleStatus?: () => void;
};

export const RequestCard: React.FC<RequestCardProps> = ({
  project,
  status,
  onClick,
  preview = false,
  interestOverride,
  onCycleStatus,
}) => {
  const category = inferCategory(project.title, project.tech_stack || []);
  const colors = CATEGORY_COLORS[category];
  const interested = deriveInterested(project.id);
  const interestCount = interestOverride ?? interested.length;
  const shown = interested.slice(0, 3);

  return (
    <motion.div
      role={preview ? undefined : 'button'}
      tabIndex={preview ? undefined : 0}
      onClick={preview ? undefined : onClick}
      onKeyDown={
        preview
          ? undefined
          : (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
      }
      className={`group relative w-full text-left glass rounded-[18px] p-5 ${
        preview ? 'cursor-default' : 'cursor-pointer'
      }`}
      style={{
        borderLeftWidth: 3,
        borderLeftColor: colors.border,
        boxShadow: '0 0 0 0 transparent',
      }}
      whileHover={
        preview
          ? undefined
          : {
              y: -3,
              borderLeftColor: colors.bright,
              boxShadow: `0 14px 36px rgba(0,0,0,0.4), 0 0 0 1px ${colors.border}66, -3px 0 18px ${colors.glow}`,
            }
      }
      transition={{ type: 'spring', stiffness: 420, damping: 28 }}
    >
      <div className="flex items-center justify-between mb-3 gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-ink-750 border border-white/12 flex items-center justify-center text-[11px] font-semibold text-fg-muted flex-shrink-0">
            {getInitials(project.user_name || 'Anonymous')}
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-fg leading-tight truncate">
              {project.user_name || 'Anonymous'}
            </p>
            <p className="mono-label leading-tight mt-0.5">
              {formatRequestId(project.id)} · {formatWhen(project.timestamp)}
            </p>
          </div>
        </div>
        {onCycleStatus && !preview ? (
          <button
            type="button"
            title="Cycle status to preview badge motion"
            aria-label={`Status ${status}. Click to cycle.`}
            onClick={(e) => {
              e.stopPropagation();
              onCycleStatus();
            }}
            className="flex-shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand/50"
          >
            <StatusBadge status={status} />
          </button>
        ) : (
          <StatusBadge status={status} />
        )}
      </div>

      <RequestProgressBar status={status} className="mb-3" />

      <h2 className="text-[15px] font-semibold tracking-tight text-fg mb-1.5">{project.title}</h2>
      <p className="text-[13px] text-fg-muted leading-relaxed line-clamp-2 whitespace-pre-wrap">
        {project.description}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t border-white/12">
        <div className="flex flex-wrap gap-1.5 min-w-0">
          {(project.tech_stack || []).slice(0, 6).map((tech) => (
            <TechChip key={tech} tech={tech} />
          ))}
        </div>

        {interestCount > 0 && (
          <div className="flex items-center gap-2 flex-shrink-0" title={`${interestCount} interested`}>
            <div className="flex -space-x-2">
              {shown.map((d) => (
                <div
                  key={d.initials + d.name}
                  className="w-6 h-6 rounded-full bg-ink-750 border-2 border-ink-900 flex items-center justify-center text-[9px] font-semibold text-fg-muted"
                  title={d.name}
                >
                  {d.initials}
                </div>
              ))}
            </div>
            <span className="text-[11px] font-mono text-fg-muted whitespace-nowrap">
              🔥 {interestCount} interested
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export function nextRequestStatus(current: RequestStatus): RequestStatus {
  const order = REQUEST_STEPS.map((s) => s.key);
  const i = order.indexOf(current);
  return order[(i + 1) % order.length];
}
