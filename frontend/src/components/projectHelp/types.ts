import type { RequestStatus } from '../RequestStepper';

/** API shape from GET/POST /api/v1/projects — unchanged. */
export type ProjectRequest = {
  id: number;
  user_id: number;
  user_name: string;
  title: string;
  description: string;
  tech_stack: string[];
  timestamp: string;
};

export type ProjectHelpView = 'list' | 'detail' | 'new';

export type ListTab = 'all' | 'mine' | 'helping';

export type SortMode = 'recency' | 'urgency' | 'tag';

/** Client-only — not persisted. Used for sort/filter + review preview. */
export type Urgency = 'low' | 'medium' | 'high';

export type InterestedDev = {
  initials: string;
  name: string;
};

export type ThreadComment = {
  id: string;
  authorName: string;
  authorInitials: string;
  body: string;
  timestamp: string;
  /** When true, body may contain `code` spans rendered as monospace blocks. */
  isRequester?: boolean;
};

export type ActivityStepKey =
  | 'created'
  | 'offers'
  | 'accepted'
  | 'in_progress'
  | 'completed';

export const ACTIVITY_STEPS: { key: ActivityStepKey; label: string }[] = [
  { key: 'created', label: 'Created' },
  { key: 'offers', label: 'Offers received' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
];

export type CategoryKey = 'infra' | 'frontend' | 'systems' | 'backend' | 'data' | 'other';

export { type RequestStatus };
