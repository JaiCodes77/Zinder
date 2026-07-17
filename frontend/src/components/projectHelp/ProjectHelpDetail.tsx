import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, HandHelping } from 'lucide-react';
import { StatusBadge, type RequestStatus } from '../RequestStepper';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { ActivityTimeline } from './ActivityTimeline';
import { CommentThread } from './CommentThread';
import { OfferHelpDrawer } from './OfferHelpDrawer';
import { TechChip } from './TechChip';
import {
  deriveInterested,
  formatRequestId,
  formatWhen,
  getInitials,
} from './helpers';
import type { ProjectRequest, ThreadComment } from './types';

type ProjectHelpDetailProps = {
  project: ProjectRequest;
  status: RequestStatus;
  comments: ThreadComment[];
  isOwn: boolean;
  alreadyHelping: boolean;
  onBack: () => void;
  onViewProfile: (userId: number) => void;
  onStatusChange: (next: RequestStatus) => void;
  onOfferHelp: (message: string) => void;
};

export const ProjectHelpDetail: React.FC<ProjectHelpDetailProps> = ({
  project,
  status,
  comments,
  isOwn,
  alreadyHelping,
  onBack,
  onViewProfile,
  onStatusChange,
  onOfferHelp,
}) => {
  const reduced = usePrefersReducedMotion();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const interested = useMemo(() => deriveInterested(project.id), [project.id]);
  const offerCount = interested.length + (alreadyHelping ? 1 : 0);

  return (
    <div className="w-full max-w-4xl mx-auto">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-[13px] text-fg-muted hover:text-fg mb-5 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        All requests
      </button>

      <div className="flex flex-col lg:flex-row gap-5 items-start">
        <div className="flex-1 min-w-0 space-y-5 w-full">
          {/* Hero */}
          <div className="glass rounded-[18px] p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div className="min-w-0">
                <p className="mono-label mb-1.5">
                  {formatRequestId(project.id)} · {formatWhen(project.timestamp)}
                </p>
                <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-fg">
                  {project.title}
                </h1>
              </div>
              <StatusBadge status={status} />
            </div>

            <div className="flex flex-wrap gap-1.5 mb-5">
              {(project.tech_stack || []).map((t) => (
                <TechChip key={t} tech={t} size="md" />
              ))}
            </div>

            {/* Requester mini profile */}
            <button
              type="button"
              onClick={() => onViewProfile(project.user_id)}
              className="flex items-center gap-3 w-full sm:w-auto text-left rounded-[14px] px-3 py-2.5 -mx-1 border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/18 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-ink-750 border border-white/12 flex items-center justify-center text-[12px] font-semibold text-fg-muted flex-shrink-0">
                {getInitials(project.user_name || 'Anonymous')}
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-fg truncate">
                  {project.user_name || 'Anonymous'}
                </p>
                <p className="text-[11px] text-fg-subtle">
                  {isOwn ? 'You · View your profile' : 'View profile'}
                </p>
              </div>
            </button>

            {!isOwn && (
              <div className="mt-5 pt-5 border-t border-white/12">
                <motion.button
                  type="button"
                  onClick={() => setDrawerOpen(true)}
                  disabled={alreadyHelping}
                  className="btn-primary flex items-center gap-2 px-4 py-2.5 rounded-[12px] text-[13px] disabled:opacity-50"
                  whileTap={reduced || alreadyHelping ? undefined : { scale: 0.97 }}
                >
                  <HandHelping className="w-4 h-4" />
                  {alreadyHelping ? 'Offer sent' : 'Offer help'}
                </motion.button>
              </div>
            )}

            {isOwn && (
              <div className="mt-5 pt-5 border-t border-white/12">
                <p className="text-[12px] text-fg-muted mb-2">Update status (local only)</p>
                <div className="flex flex-wrap gap-1.5">
                  {(['pending', 'accepted', 'in_progress', 'completed'] as RequestStatus[]).map(
                    (s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => onStatusChange(s)}
                        className={`px-2.5 py-1 rounded-[10px] text-[11px] font-mono border transition-colors ${
                          status === s
                            ? 'bg-accent-warm/12 text-accent-warm border-accent-warm/30'
                            : 'bg-white/4 text-fg-muted border-white/12'
                        }`}
                      >
                        {s.replace('_', ' ')}
                      </button>
                    )
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="glass rounded-[18px] p-5 md:p-6">
            <p className="kicker mb-3">Description</p>
            <p className="text-[14px] text-fg-muted leading-relaxed whitespace-pre-wrap">
              {project.description}
            </p>
          </div>

          <CommentThread comments={comments} />
        </div>

        <aside className="w-full lg:w-64 flex-shrink-0 lg:sticky lg:top-6 space-y-4">
          <ActivityTimeline status={status} offerCount={offerCount} />
          {offerCount > 0 && (
            <div className="glass rounded-[18px] p-4">
              <p className="text-[12px] text-fg-muted mb-2">🔥 {offerCount} interested</p>
              <div className="flex -space-x-2">
                {interested.slice(0, 4).map((d) => (
                  <div
                    key={d.name}
                    className="w-7 h-7 rounded-full bg-ink-750 border-2 border-ink-900 flex items-center justify-center text-[9px] font-semibold text-fg-muted"
                    title={d.name}
                  >
                    {d.initials}
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      <OfferHelpDrawer
        open={drawerOpen}
        requestTitle={project.title}
        onClose={() => setDrawerOpen(false)}
        onConfirm={(message) => {
          onOfferHelp(message);
          setDrawerOpen(false);
        }}
      />
    </div>
  );
};
