import { ApiError, apiFetch } from './client';
import type { RequestStatus } from '../components/RequestStepper';

/** Map API failures to user-facing Project Help action copy (surfaces 403 authZ). */
export function formatProjectActionError(err: unknown, fallback: string): string {
  if (!(err instanceof ApiError)) return fallback;
  const detail = (err.detail || '').trim();
  if (err.status === 403) {
    return detail || "You don't have permission to do that.";
  }
  if (err.status === 401) {
    return 'Session expired — sign in again.';
  }
  return detail || fallback;
}

export type ProjectApi = {
  id: number;
  user_id: number;
  user_name: string;
  title: string;
  description: string;
  tech_stack: string[];
  timestamp: string;
  status?: string;
  helper_user_id?: number | null;
};

export type InterestedRow = {
  project_id: number;
  user_id: number;
  user_name?: string | null;
  note?: string | null;
  created_at: string;
};

export type CommentRow = {
  id: number;
  project_id: number;
  user_id: number;
  user_name: string;
  body: string;
  created_at: string;
};

export type ProjectDetail = ProjectApi & {
  interested: InterestedRow[];
  comments: CommentRow[];
};

export function toUiStatus(status?: string | null): RequestStatus {
  if (status === 'accepted' || status === 'in_progress' || status === 'completed') {
    return status;
  }
  return 'pending';
}

export async function listProjects(): Promise<ProjectApi[]> {
  return apiFetch<ProjectApi[]>('/projects');
}

export async function getProjectDetail(projectId: number): Promise<ProjectDetail> {
  return apiFetch<ProjectDetail>(`/projects/${projectId}`);
}

export async function createProject(body: {
  title: string;
  description: string;
  tech_stack: string[];
}): Promise<ProjectApi> {
  return apiFetch<ProjectApi>('/projects', { method: 'POST', json: body });
}

export async function updateProject(
  projectId: number,
  body: {
    title?: string;
    description?: string;
    tech_stack?: string[];
  }
): Promise<ProjectApi> {
  return apiFetch<ProjectApi>(`/projects/${projectId}`, {
    method: 'PATCH',
    json: body,
  });
}

export async function markInterested(
  projectId: number,
  note?: string
): Promise<InterestedRow> {
  return apiFetch<InterestedRow>(`/projects/${projectId}/interested`, {
    method: 'POST',
    json: note ? { note } : {},
  });
}

/** Withdraw interest — `DELETE /projects/{id}/interested` (204). */
export async function withdrawInterest(projectId: number): Promise<void> {
  await apiFetch<void>(`/projects/${projectId}/interested`, { method: 'DELETE' });
}

export async function patchProjectStatus(
  projectId: number,
  status: string,
  helperUserId?: number
): Promise<ProjectApi> {
  return apiFetch<ProjectApi>(`/projects/${projectId}/status`, {
    method: 'PATCH',
    json: {
      status,
      ...(helperUserId != null ? { helper_user_id: helperUserId } : {}),
    },
  });
}

export async function postProjectComment(
  projectId: number,
  body: string
): Promise<CommentRow> {
  return apiFetch<CommentRow>(`/projects/${projectId}/comments`, {
    method: 'POST',
    json: { body },
  });
}
