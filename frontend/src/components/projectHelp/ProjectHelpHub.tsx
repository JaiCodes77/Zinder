import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { RequestStatus } from '../RequestStepper';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { ProjectHelpDetail } from './ProjectHelpDetail';
import { ProjectHelpList } from './ProjectHelpList';
import { ProjectHelpNew } from './ProjectHelpNew';
import { EASE, getInitials, seedThread } from './helpers';
import { parseProjectHelpHash, projectHelpHash } from './routes';
import type {
  ProjectHelpView,
  ProjectRequest,
  ThreadComment,
  Urgency,
} from './types';

type MyProfile = {
  user_id: number;
  user?: { id?: number; name?: string };
} | null;

type ProjectHelpHubProps = {
  myProfile: MyProfile;
  projects: ProjectRequest[];
  loadingProjects: boolean;
  projectStatuses: Record<number, RequestStatus>;
  setProjectStatuses: React.Dispatch<React.SetStateAction<Record<number, RequestStatus>>>;
  onRefreshProjects: () => void | Promise<void>;
  onOfferHelp: (project: ProjectRequest, message: string) => void;
  onViewOwnProfile: () => void;
};

export const ProjectHelpHub: React.FC<ProjectHelpHubProps> = ({
  myProfile,
  projects,
  loadingProjects,
  projectStatuses,
  setProjectStatuses,
  onRefreshProjects,
  onOfferHelp,
  onViewOwnProfile,
}) => {
  const reduced = usePrefersReducedMotion();
  const initial = parseProjectHelpHash();
  const [view, setView] = useState<ProjectHelpView>(initial.view);
  const [selectedId, setSelectedId] = useState<number | null>(initial.id);
  const [helpingIds, setHelpingIds] = useState<Set<number>>(() => new Set());
  const [urgencyOverrides, setUrgencyOverrides] = useState<Record<number, Urgency>>({});
  const [threads, setThreads] = useState<Record<number, ThreadComment[]>>({});
  /** Optimistic list merge after create (until parent refresh lands). */
  const [localExtra, setLocalExtra] = useState<ProjectRequest[]>([]);

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
    // Ensure list lands on a canonical hash when hub mounts without one
    if (!window.location.hash.includes('project-help')) {
      window.location.hash = projectHelpHash('list');
    } else {
      onHash();
    }
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    setThreads((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const p of [...localExtra, ...projects]) {
        if (!next[p.id]) {
          next[p.id] = seedThread(p);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [projects, localExtra]);

  // If hash points at a missing id while projects are loading, wait; if loaded and missing, fall back.
  useEffect(() => {
    if (view !== 'detail' || selectedId == null || loadingProjects) return;
    const exists =
      projects.some((p) => p.id === selectedId) ||
      localExtra.some((p) => p.id === selectedId);
    if (!exists) navigate('list');
  }, [view, selectedId, loadingProjects, projects, localExtra, navigate]);

  const selected = mergedProjects.find((p) => p.id === selectedId) ?? null;

  const handleCreate = async (payload: {
    title: string;
    description: string;
    tech_stack: string[];
    urgency: Urgency;
  }): Promise<ProjectRequest> => {
    const res = await fetch('http://localhost:8080/api/v1/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: payload.title,
        description: payload.description,
        tech_stack: payload.tech_stack,
      }),
      credentials: 'include',
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(
        typeof errData.detail === 'string'
          ? errData.detail
          : 'Could not publish your request.'
      );
    }
    const created: ProjectRequest = await res.json();
    setUrgencyOverrides((prev) => ({ ...prev, [created.id]: payload.urgency }));
    setProjectStatuses((prev) => ({ ...prev, [created.id]: 'pending' }));
    setThreads((prev) => ({ ...prev, [created.id]: seedThread(created) }));
    setLocalExtra((prev) => [created, ...prev.filter((p) => p.id !== created.id)]);
    await onRefreshProjects();
    return created;
  };

  const handleOffer = (project: ProjectRequest, message: string) => {
    setHelpingIds((prev) => new Set(prev).add(project.id));
    setProjectStatuses((prev) => ({
      ...prev,
      [project.id]: prev[project.id] === 'pending' ? 'accepted' : prev[project.id],
    }));

    const comment: ThreadComment = {
      id: `offer-${project.id}-${Date.now()}`,
      authorName: myName,
      authorInitials: getInitials(myName),
      body:
        message ||
        `I'd like to help with this — ping me and we can pair on it.`,
      timestamp: new Date().toISOString(),
    };
    setThreads((prev) => ({
      ...prev,
      [project.id]: [...(prev[project.id] || seedThread(project)), comment],
    }));

    onOfferHelp(project, message);
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
              myUserId={myUserId}
              helpingIds={helpingIds}
              projectStatuses={projectStatuses}
              urgencyOverrides={urgencyOverrides}
              onOpenDetail={(id) => navigate('detail', id)}
              onNewRequest={() => navigate('new')}
              onStatusChange={(id, next) =>
                setProjectStatuses((prev) => ({ ...prev, [id]: next }))
              }
            />
          )}

          {view === 'detail' && selected && (
            <ProjectHelpDetail
              project={selected}
              status={projectStatuses[selected.id] || 'pending'}
              comments={threads[selected.id] || seedThread(selected)}
              isOwn={myUserId != null && selected.user_id === myUserId}
              alreadyHelping={helpingIds.has(selected.id)}
              onBack={() => navigate('list')}
              onViewProfile={(userId) => {
                if (myUserId != null && userId === myUserId) onViewOwnProfile();
              }}
              onStatusChange={(next) =>
                setProjectStatuses((prev) => ({ ...prev, [selected.id]: next }))
              }
              onOfferHelp={(message) => handleOffer(selected, message)}
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
