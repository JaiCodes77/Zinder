import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, HandHelping, Loader2, Pencil } from 'lucide-react';
import { StatusBadge, type RequestStatus } from '../RequestStepper';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { ActivityTimeline } from './ActivityTimeline';
import { CommentThread } from './CommentThread';
import { OfferHelpDrawer } from './OfferHelpDrawer';
import { TechChip } from './TechChip';
import { formatRequestId, formatWhen, getInitials } from './helpers';
import type { InterestedPerson, ProjectRequest, ThreadComment } from './types';

type ProjectHelpDetailProps = {
  project: ProjectRequest;
  status: RequestStatus;
  comments: ThreadComment[];
  interested: InterestedPerson[];
  isOwn: boolean;
  alreadyHelping: boolean;
  loadingDetail: boolean;
  actionError: string | null;
  commenting: boolean;
  savingEdit?: boolean;
  onBack: () => void;
  onViewProfile: (userId: number) => void;
  onStatusChange: (next: RequestStatus | 'cancelled') => void;
  onAcceptHelper: (helperUserId: number) => void;
  onOfferHelp: (message: string) => void | Promise<void>;
  onWithdrawInterest?: () => void | Promise<void>;
  onPostComment: (body: string) => Promise<void> | void;
  onSaveEdit?: (fields: {
    title: string;
    description: string;
    tech_stack: string[];
  }) => Promise<void> | void;
};

const FORWARD: RequestStatus[] = ['pending', 'accepted', 'in_progress', 'completed'];

export const ProjectHelpDetail: React.FC<ProjectHelpDetailProps> = ({
  project,
  status,
  comments,
  interested,
  isOwn,
  alreadyHelping,
  loadingDetail,
  actionError,
  commenting,
  savingEdit = false,
  onBack,
  onViewProfile,
  onStatusChange,
  onAcceptHelper,
  onOfferHelp,
  onWithdrawInterest,
  onPostComment,
  onSaveEdit,
}) => {
  const reduced = usePrefersReducedMotion();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [offering, setOffering] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [helperId, setHelperId] = useState<number | ''>('');
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(project.title);
  const [editDescription, setEditDescription] = useState(project.description);
  const [editTech, setEditTech] = useState((project.tech_stack || []).join(', '));
  const offerCount = interested.length;
  const isCancelled = project.status === 'cancelled';
  const canEdit = isOwn && status === 'pending' && !isCancelled && onSaveEdit != null;

  const currentIdx = FORWARD.indexOf(status);
  const nextStatus =
    currentIdx >= 0 && currentIdx < FORWARD.length - 1 ? FORWARD[currentIdx + 1] : null;

  const startEdit = () => {
    setEditTitle(project.title);
    setEditDescription(project.description);
    setEditTech((project.tech_stack || []).join(', '));
    setEditing(true);
  };

  const submitEdit = async () => {
    if (!onSaveEdit) return;
    const tech_stack = editTech
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    await onSaveEdit({
      title: editTitle.trim(),
      description: editDescription.trim(),
      tech_stack,
    });
    setEditing(false);
  };

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

      {actionError && (
        <div
          className="mb-4 px-3.5 py-2.5 rounded-lg border border-pass/25 bg-pass/8 text-[13px] text-pass"
          role="alert"
        >
          {actionError}
        </div>
      )}

      {loadingDetail && (
        <p className="mono-label mb-3 flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Syncing interest & discussion…
        </p>
      )}

      <div className="flex flex-col lg:flex-row gap-5 items-start">
        <div className="flex-1 min-w-0 space-y-5 w-full">
          <div className="glass rounded-[18px] p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div className="min-w-0">
                <p className="mono-label mb-1.5">
                  {formatRequestId(project.id)} · {formatWhen(project.timestamp)}
                </p>
                {editing ? (
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="field w-full px-3 py-2 text-[16px] md:text-[18px] font-semibold text-fg"
                    aria-label="Title"
                  />
                ) : (
                  <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-fg">
                    {project.title}
                  </h1>
                )}
              </div>
              <div className="flex items-center gap-2">
                {isCancelled ? (
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-mono border border-pass/30 text-pass bg-pass/8">
                    cancelled
                  </span>
                ) : (
                  <StatusBadge status={status} />
                )}
                {canEdit && !editing && (
                  <button
                    type="button"
                    onClick={startEdit}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-[10px] text-[11px] font-mono border border-white/12 text-fg-muted hover:text-fg hover:bg-white/5"
                  >
                    <Pencil className="w-3 h-3" />
                    edit
                  </button>
                )}
              </div>
            </div>

            {editing ? (
              <label className="block text-[12px] text-fg-muted mb-5">
                Tech stack (comma-separated)
                <input
                  value={editTech}
                  onChange={(e) => setEditTech(e.target.value)}
                  className="field mt-1 w-full px-3 py-2 text-[13px] text-fg"
                />
              </label>
            ) : (
              <div className="flex flex-wrap gap-1.5 mb-5">
                {(project.tech_stack || []).map((t) => (
                  <TechChip key={t} tech={t} size="md" />
                ))}
              </div>
            )}

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
              <div className="mt-5 pt-5 border-t border-white/12 flex flex-wrap gap-2">
                <motion.button
                  type="button"
                  onClick={() => setDrawerOpen(true)}
                  disabled={alreadyHelping || offering}
                  className="btn-primary flex items-center gap-2 px-4 py-2.5 rounded-[12px] text-[13px] disabled:opacity-50"
                  whileTap={reduced || alreadyHelping ? undefined : { scale: 0.97 }}
                >
                  {offering ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <HandHelping className="w-4 h-4" />
                  )}
                  {alreadyHelping ? 'Offer sent' : 'Offer help'}
                </motion.button>
                {alreadyHelping && onWithdrawInterest && status === 'pending' && (
                  <button
                    type="button"
                    disabled={withdrawing}
                    onClick={async () => {
                      setWithdrawing(true);
                      try {
                        await onWithdrawInterest();
                      } finally {
                        setWithdrawing(false);
                      }
                    }}
                    className="btn-ghost flex items-center gap-2 px-4 py-2.5 rounded-[12px] text-[13px] text-fg-muted disabled:opacity-50"
                  >
                    {withdrawing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : null}
                    Withdraw interest
                  </button>
                )}
              </div>
            )}

            {isOwn && !isCancelled && (
              <div className="mt-5 pt-5 border-t border-white/12 space-y-3">
                <p className="text-[12px] text-fg-muted">Update status</p>
                {status === 'pending' && interested.length > 0 && (
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="block text-[12px] text-fg-muted">
                      Accept helper
                      <select
                        value={helperId === '' ? interested[0].userId : helperId}
                        onChange={(e) => setHelperId(Number(e.target.value))}
                        className="field mt-1 block w-full min-w-[180px] px-3 py-2 text-[13px] text-fg"
                      >
                        {interested.map((r) => (
                          <option key={r.userId} value={r.userId}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      className="btn-primary px-3 py-2 rounded-[10px] text-[12px]"
                      onClick={() => {
                        const id =
                          typeof helperId === 'number' ? helperId : interested[0]?.userId;
                        if (id != null) onAcceptHelper(id);
                      }}
                    >
                      Accept
                    </button>
                  </div>
                )}
                {status === 'pending' && interested.length === 0 && (
                  <p className="text-[12px] text-fg-subtle">
                    Waiting for someone to mark interest before you can accept a helper.
                  </p>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {FORWARD.map((s) => {
                    const targetIdx = FORWARD.indexOf(s);
                    const isNext = nextStatus === s;
                    const disabled =
                      s === status ||
                      targetIdx !== currentIdx + 1 ||
                      s === 'accepted'; // accept only via helper picker
                    return (
                      <button
                        key={s}
                        type="button"
                        disabled={disabled}
                        onClick={() => onStatusChange(s)}
                        className={`px-2.5 py-1 rounded-[10px] text-[11px] font-mono border transition-colors disabled:opacity-40 ${
                          status === s
                            ? 'bg-accent-brand/12 text-accent-brand border-accent-brand/30'
                            : isNext
                              ? 'bg-white/8 text-fg border-white/20 hover:bg-white/12'
                              : 'bg-white/4 text-fg-muted border-white/12'
                        }`}
                      >
                        {s.replace('_', ' ')}
                      </button>
                    );
                  })}
                  {(status === 'pending' ||
                    status === 'accepted' ||
                    status === 'in_progress') && (
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          window.confirm(
                            'Cancel this request? Others will no longer see it in the open list.'
                          )
                        ) {
                          onStatusChange('cancelled');
                        }
                      }}
                      className="px-2.5 py-1 rounded-[10px] text-[11px] font-mono border border-pass/30 text-pass bg-pass/8"
                    >
                      cancel
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="glass rounded-[18px] p-5 md:p-6">
            <p className="kicker mb-3">Description</p>
            {editing ? (
              <div className="space-y-3">
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={6}
                  className="field w-full px-3 py-2 text-[14px] text-fg-muted leading-relaxed resize-y"
                  aria-label="Description"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={savingEdit}
                    onClick={() => void submitEdit()}
                    className="btn-primary px-3 py-2 rounded-[10px] text-[12px] disabled:opacity-50"
                  >
                    {savingEdit ? 'Saving…' : 'Save changes'}
                  </button>
                  <button
                    type="button"
                    disabled={savingEdit}
                    onClick={() => setEditing(false)}
                    className="px-3 py-2 rounded-[10px] text-[12px] border border-white/12 text-fg-muted hover:text-fg"
                  >
                    Discard
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-[14px] text-fg-muted leading-relaxed whitespace-pre-wrap">
                {project.description}
              </p>
            )}
          </div>

          <div className="glass rounded-[18px] p-5 md:p-6">
            <CommentThread
              comments={comments}
              onPost={onPostComment}
              posting={commenting}
              error={null}
            />
          </div>
        </div>

        <aside className="w-full lg:w-64 flex-shrink-0 lg:sticky lg:top-6 space-y-4">
          <ActivityTimeline status={status} offerCount={offerCount} />
          {offerCount > 0 && (
            <div className="glass rounded-[18px] p-4">
              <p className="text-[12px] text-fg-muted mb-2">🔥 {offerCount} interested</p>
              <div className="flex -space-x-2">
                {interested.slice(0, 4).map((d) => (
                  <div
                    key={d.userId}
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
        onConfirm={async (message) => {
          setOffering(true);
          try {
            await onOfferHelp(message);
            setDrawerOpen(false);
          } catch {
            // error surfaced via actionError
          } finally {
            setOffering(false);
          }
        }}
      />
    </div>
  );
};
