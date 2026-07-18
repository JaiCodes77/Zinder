import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { RequestStatus } from '../RequestStepper';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { ProjectHelpDetail } from './ProjectHelpDetail';
import { ProjectHelpList } from './ProjectHelpList';
import { ProjectHelpNew } from './ProjectHelpNew';
import { EASE, getInitials } from './helpers';
import { parseProjectHelpHash, projectHelpHash } from './routes';
import type {
  InterestedPerson,
  ProjectHelpView,
  ProjectRequest,
  ThreadComment,
  Urgency,
} from './types';
import {
  createProject,
  formatProjectActionError,
  getProjectDetail,
  markInterested,
  patchProjectStatus,
  postProjectComment,
  toUiStatus,
  updateProject,
  withdrawInterest,
  type CommentRow,
  type InterestedRow,
} from '../../api/projects';

type MyProfile = {
  user_id: number;
  user?: { id?: number; name?: string };
} | null;

type ProjectHelpHubProps = {
  myProfile: MyProfile;
  projects: ProjectRequest[];
  loadingProjects: boolean;
  projectsError?: string | null;
  projectStatuses: Record<number, RequestStatus>;
  setProjectStatuses: React.Dispatch<React.SetStateAction<Record<number, RequestStatus>>>;
  onRefreshProjects: () => void | Promise<void>;
  /** Optional legacy hook — PH social APIs already persist the offer. */
  onOfferHelp?: (project: ProjectRequest, message: string) => void;
  onViewOwnProfile: () => void;
  onViewProfile?: (userId: number) => void;
};

function mapComments(
  rows: CommentRow[],
  ownerId: number
): ThreadComment[] {
  return rows.map((c) => ({
    id: String(c.id),
    authorName: c.user_name,
    authorInitials: getInitials(c.user_name),
    body: c.body,
    timestamp: c.created_at,
    isRequester: c.user_id === ownerId,
  }));
}

function mapInterested(rows: InterestedRow[]): InterestedPerson[] {
  return rows.map((r) => {
    const name = r.user_name || `User ${r.user_id}`;
    return {
      userId: r.user_id,
      name,
      initials: getInitials(name),
      note: r.note,
    };
  });
}

export const ProjectHelpHub: React.FC<ProjectHelpHubProps> = ({
  myProfile,
  projects,
  loadingProjects,
  projectsError = null,
  projectStatuses,
  setProjectStatuses,
  onRefreshProjects,
  onOfferHelp,
  onViewOwnProfile,
  onViewProfile,
}) => {
  const reduced = usePrefersReducedMotion();
  const initial = parseProjectHelpHash();
  const [view, setView] = useState<ProjectHelpView>(initial.view);
  const [selectedId, setSelectedId] = useState<number | null>(initial.id);
  const [helpingIds, setHelpingIds] = useState<Set<number>>(() => new Set());
  const [urgencyOverrides, setUrgencyOverrides] = useState<Record<number, Urgency>>({});
  const [threads, setThreads] = useState<Record<number, ThreadComment[]>>({});
  const [interestedById, setInterestedById] = useState<Record<number, InterestedPerson[]>>({});
  const [interestCounts, setInterestCounts] = useState<Record<number, number>>({});
  const [localExtra, setLocalExtra] = useState<ProjectRequest[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [commenting, setCommenting] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  const myUserId = myProfile?.user_id ?? myProfile?.user?.id ?? null;
  const myName = myProfile?.user?.name || 'You';

  const mergedProjects = (() => {
    const byId = new Map<number, ProjectRequest>();
    for (const p of [...localExtra, ...projects]) byId.set(p.id, p);
    return Array.from(byId.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  })();

  const navigate = useCallback((next: ProjectHelpView, id: number | null = null) => {
    setView(next);
    setSelectedId(id);
    setActionError(null);
    const target = projectHelpHash(next, id);
    if (window.location.hash !== target) {
      window.location.hash = target;
    }
  }, []);

  useEffect(() => {
    const onHash = () => {
      const parsed = parseProjectHelpHash();
      setView(parsed.view);
      setSelectedId(parsed.id);
    };
    window.addEventListener('hashchange', onHash);
    if (!window.location.hash.includes('project-help')) {
      window.location.hash = projectHelpHash('list');
    } else {
      onHash();
    }
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Sync list statuses from server fields when projects refresh.
  useEffect(() => {
    setProjectStatuses((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const p of projects) {
        const ui = toUiStatus(p.status);
        if (next[p.id] !== ui) {
          next[p.id] = ui;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    setHelpingIds((prev) => {
      if (myUserId == null) return prev;
      const next = new Set(prev);
      let changed = false;
      for (const p of projects) {
        if (p.helper_user_id === myUserId && !next.has(p.id)) {
          next.add(p.id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [projects, myUserId, setProjectStatuses]);

  // Load detail (interested + comments) when opening a request.
  useEffect(() => {
    if (view !== 'detail' || selectedId == null) return;
    let cancelled = false;
    setLoadingDetail(true);
    setActionError(null);
    (async () => {
      try {
        const detail = await getProjectDetail(selectedId);
        if (cancelled) return;
        setThreads((prev) => ({
          ...prev,
          [selectedId]: mapComments(detail.comments, detail.user_id),
        }));
        const interested = mapInterested(detail.interested);
        setInterestedById((prev) => ({ ...prev, [selectedId]: interested }));
        setInterestCounts((prev) => ({ ...prev, [selectedId]: interested.length }));
        setProjectStatuses((prev) => ({ ...prev, [selectedId]: toUiStatus(detail.status) }));
        if (myUserId != null && interested.some((i) => i.userId === myUserId)) {
          setHelpingIds((prev) => new Set(prev).add(selectedId));
        }
        setLocalExtra((prev) => {
          const without = prev.filter((p) => p.id !== detail.id);
          return [{ ...detail }, ...without];
        });
      } catch (err) {
        if (!cancelled) {
          setActionError(
            formatProjectActionError(err, 'Could not load this request.')
          );
        }
      } finally {
        if (!cancelled) setLoadingDetail(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [view, selectedId, myUserId, setProjectStatuses]);

  useEffect(() => {
    if (view !== 'detail' || selectedId == null || loadingProjects) return;
    const exists =
      projects.some((p) => p.id === selectedId) ||
      localExtra.some((p) => p.id === selectedId);
    if (!exists && !loadingDetail) navigate('list');
  }, [view, selectedId, loadingProjects, projects, localExtra, navigate, loadingDetail]);

  const selected = mergedProjects.find((p) => p.id === selectedId) ?? null;

  const handleCreate = async (payload: {
    title: string;
    description: string;
    tech_stack: string[];
    urgency: Urgency;
  }): Promise<ProjectRequest> => {
    try {
      const created = await createProject({
        title: payload.title,
        description: payload.description,
        tech_stack: payload.tech_stack,
      });
      setUrgencyOverrides((prev) => ({ ...prev, [created.id]: payload.urgency }));
      setProjectStatuses((prev) => ({ ...prev, [created.id]: 'pending' }));
      setThreads((prev) => ({ ...prev, [created.id]: [] }));
      setInterestedById((prev) => ({ ...prev, [created.id]: [] }));
      setLocalExtra((prev) => [created, ...prev.filter((p) => p.id !== created.id)]);
      await onRefreshProjects();
      return created;
    } catch (err) {
      throw new Error(formatProjectActionError(err, 'Could not publish your request.'));
    }
  };

  const handleOffer = async (project: ProjectRequest, message: string) => {
    setActionError(null);
    const note =
      message.trim() ||
      `I'd like to help with this — ping me and we can pair on it.`;
    try {
      await markInterested(project.id, note);
      const comment = await postProjectComment(project.id, note);
      setHelpingIds((prev) => new Set(prev).add(project.id));
      setThreads((prev) => ({
        ...prev,
        [project.id]: [
          ...(prev[project.id] || []),
          ...mapComments([comment], project.user_id),
        ],
      }));
      setInterestedById((prev) => {
        const list = prev[project.id] || [];
        if (myUserId != null && list.some((i) => i.userId === myUserId)) return prev;
        const person: InterestedPerson = {
          userId: myUserId ?? 0,
          name: myName,
          initials: getInitials(myName),
          note,
        };
        const next = [...list, person];
        setInterestCounts((c) => ({ ...c, [project.id]: next.length }));
        return { ...prev, [project.id]: next };
      });
      onOfferHelp?.(project, message);
    } catch (err) {
      setActionError(formatProjectActionError(err, 'Could not send your offer.'));
      throw err;
    }
  };

  const handleWithdrawInterest = async (project: ProjectRequest) => {
    setActionError(null);
    try {
      await withdrawInterest(project.id);
      setHelpingIds((prev) => {
        const next = new Set(prev);
        next.delete(project.id);
        return next;
      });
      setInterestedById((prev) => {
        const list = (prev[project.id] || []).filter((i) => i.userId !== myUserId);
        setInterestCounts((c) => ({ ...c, [project.id]: list.length }));
        return { ...prev, [project.id]: list };
      });
    } catch (err) {
      setActionError(formatProjectActionError(err, 'Could not withdraw interest.'));
      throw err;
    }
  };

  const handleAcceptHelper = async (helperUserId: number) => {
    if (selectedId == null) return;
    setActionError(null);
    try {
      const updated = await patchProjectStatus(selectedId, 'accepted', helperUserId);
      setProjectStatuses((prev) => ({ ...prev, [selectedId]: 'accepted' }));
      setLocalExtra((prev) => {
        const rest = prev.filter((p) => p.id !== selectedId);
        return [{ ...updated }, ...rest];
      });
      await onRefreshProjects();
    } catch (err) {
      setActionError(formatProjectActionError(err, 'Could not accept helper.'));
    }
  };

  const handleStatusChange = async (next: RequestStatus | 'cancelled') => {
    if (selectedId == null) return;
    setActionError(null);
    try {
      const updated = await patchProjectStatus(selectedId, next);
      if (next !== 'cancelled') {
        setProjectStatuses((prev) => ({ ...prev, [selectedId]: next }));
      }
      setLocalExtra((prev) => {
        const rest = prev.filter((p) => p.id !== selectedId);
        return [{ ...updated }, ...rest];
      });
      await onRefreshProjects();
      if (next === 'cancelled') navigate('list');
    } catch (err) {
      setActionError(formatProjectActionError(err, 'Could not update status.'));
    }
  };

  const handleSaveEdit = async (fields: {
    title: string;
    description: string;
    tech_stack: string[];
  }) => {
    if (selectedId == null) return;
    setSavingEdit(true);
    setActionError(null);
    try {
      const updated = await updateProject(selectedId, fields);
      setLocalExtra((prev) => {
        const rest = prev.filter((p) => p.id !== selectedId);
        return [{ ...updated }, ...rest];
      });
      await onRefreshProjects();
    } catch (err) {
      setActionError(formatProjectActionError(err, 'Could not save changes.'));
      throw err;
    } finally {
      setSavingEdit(false);
    }
  };

  const handlePostComment = async (body: string) => {
    if (selectedId == null || !selected) return;
    setCommenting(true);
    setActionError(null);
    try {
      const comment = await postProjectComment(selectedId, body);
      setThreads((prev) => ({
        ...prev,
        [selectedId]: [
          ...(prev[selectedId] || []),
          ...mapComments([comment], selected.user_id),
        ],
      }));
    } catch (err) {
      setActionError(formatProjectActionError(err, 'Could not post comment.'));
      throw err;
    } finally {
      setCommenting(false);
    }
  };

  const pageKey = view === 'detail' && selectedId != null ? `detail-${selectedId}` : view;

  return (
    <div className="flex-1 flex flex-col items-center p-4 md:p-10 w-full">
      <AnimatePresence mode="wait">
        <motion.div
          key={pageKey}
          className="w-full"
          initial={reduced ? { opacity: 1 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
          transition={{ duration: 0.22, ease: EASE }}
        >
          {view === 'list' && (
            <ProjectHelpList
              projects={mergedProjects}
              loading={loadingProjects}
              error={projectsError}
              onRetry={() => void onRefreshProjects()}
              myUserId={myUserId}
              helpingIds={helpingIds}
              projectStatuses={projectStatuses}
              urgencyOverrides={urgencyOverrides}
              interestCounts={interestCounts}
              onOpenDetail={(id) => navigate('detail', id)}
              onNewRequest={() => navigate('new')}
            />
          )}

          {view === 'detail' && selected && (
            <ProjectHelpDetail
              project={selected}
              status={projectStatuses[selected.id] || toUiStatus(selected.status)}
              comments={threads[selected.id] || []}
              interested={interestedById[selected.id] || []}
              isOwn={myUserId != null && selected.user_id === myUserId}
              alreadyHelping={helpingIds.has(selected.id)}
              loadingDetail={loadingDetail}
              actionError={actionError}
              commenting={commenting}
              savingEdit={savingEdit}
              onBack={() => navigate('list')}
              onViewProfile={(userId) => {
                if (myUserId != null && userId === myUserId) onViewOwnProfile();
                else onViewProfile?.(userId);
              }}
              onStatusChange={handleStatusChange}
              onAcceptHelper={handleAcceptHelper}
              onOfferHelp={(message) => handleOffer(selected, message)}
              onWithdrawInterest={() => handleWithdrawInterest(selected)}
              onPostComment={handlePostComment}
              onSaveEdit={handleSaveEdit}
            />
          )}

          {view === 'detail' && !selected && loadingProjects && (
            <div className="max-w-xl mx-auto glass rounded-[18px] p-8 text-center">
              <p className="text-[14px] text-fg-muted">Loading request…</p>
            </div>
          )}

          {view === 'new' && myUserId != null && (
            <ProjectHelpNew
              myName={myName}
              myUserId={myUserId}
              onCancel={() => navigate('list')}
              onSubmit={handleCreate}
              onCreated={(created) => navigate('detail', created.id)}
            />
          )}

          {view === 'new' && myUserId == null && (
            <div className="max-w-xl mx-auto glass rounded-[18px] p-8 text-center">
              <p className="text-[14px] text-fg-muted">Loading your profile…</p>
              <button
                type="button"
                onClick={() => navigate('list')}
                className="btn-ghost mt-4 px-4 py-2 rounded-[12px] text-[13px]"
              >
                Back to list
              </button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
