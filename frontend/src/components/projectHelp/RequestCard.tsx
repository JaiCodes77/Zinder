import React from 'react';
import { motion } from 'framer-motion';
import { StatusBadge, type RequestStatus } from '../RequestStepper';
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
};

export const RequestCard: React.FC<RequestCardProps> = ({
  project,
  status,
  onClick,
  preview = false,
  interestOverride,
}) => {
  const category = inferCategory(project.title, project.tech_stack || []);
  const colors = CATEGORY_COLORS[category];
  const interested = deriveInterested(project.id);
  const interestCount = interestOverride ?? interested.length;
  const shown = interested.slice(0, 3);

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={preview}
      className={`group relative w-full text-left glass rounded-[18px] p-5 overflow-hidden transition-[box-shadow,transform,border-color] duration-200 ${
        preview ? 'cursor-default' : 'cursor-pointer'
      }`}
      style={{
        borderLeftWidth: 3,
        borderLeftColor: colors.border,
      }}
      whileHover={
        preview
          ? undefined
          : {
              y: -3,
              boxShadow: `0 12px 32px rgba(0,0,0,0.35), 0 0 0 1px ${colors.border}55`,
              borderLeftColor: colors.border,
            }
      }
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
    >
      {/* Intensified left glow on hover */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        style={{
          boxShadow: `-2px 0 16px ${colors.glow}`,
          background: colors.border,
        }}
      />

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
        <StatusBadge status={status} />
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
    </motion.button>
  );
};
