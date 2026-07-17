import type { RequestStatus } from '../RequestStepper';
import type {
  ActivityStepKey,
  InterestedDev,
  ProjectRequest,
  ThreadComment,
  Urgency,
} from './types';
import { ACTIVITY_STEPS } from './types';

export const EASE = [0.22, 1, 0.36, 1] as const;
export const SPRING_PILL = { type: 'spring' as const, stiffness: 380, damping: 32 };
export const SPRING_DRAWER = { type: 'spring' as const, stiffness: 380, damping: 34 };
export const SPRING_SOFT = { type: 'spring' as const, stiffness: 320, damping: 30 };

export function getInitials(name: string): string {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function formatRequestId(id: number): string {
  return `req-${String(id).padStart(4, '0')}`;
}

export function formatWhen(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Assumption: API has no "interested helpers" field.
 * Deterministic faux interest from project id so cards stay stable across reloads.
 */
export function deriveInterested(projectId: number): InterestedDev[] {
  const pool: InterestedDev[] = [
    { initials: 'MK', name: 'Maya K.' },
    { initials: 'JR', name: 'Jordan R.' },
    { initials: 'AL', name: 'Alex L.' },
    { initials: 'SP', name: 'Sam P.' },
    { initials: 'TN', name: 'Taylor N.' },
    { initials: 'CW', name: 'Casey W.' },
  ];
  const count = projectId % 4; // 0–3
  if (count === 0) return [];
  const start = projectId % pool.length;
  const out: InterestedDev[] = [];
  for (let i = 0; i < count; i++) out.push(pool[(start + i) % pool.length]);
  return out;
}

/**
 * Assumption: urgency is not on the ProjectResponse model.
 * Derived client-side for sort UI; new-request wizard stores a local override.
 */
export function deriveUrgency(project: ProjectRequest, override?: Urgency): Urgency {
  if (override) return override;
  const text = `${project.title} ${project.description}`.toLowerCase();
  if (/\b(urgent|asap|blocker|production|down|critical)\b/.test(text)) return 'high';
  if (/\b(soon|this week|help needed|stuck)\b/.test(text)) return 'medium';
  return (project.id % 3 === 0 ? 'high' : project.id % 3 === 1 ? 'medium' : 'low') as Urgency;
}

export const URGENCY_RANK: Record<Urgency, number> = { high: 3, medium: 2, low: 1 };

/**
 * Seed a lightweight GitHub-issue-style opener from the request description.
 * Assumption: no comments API — thread is client-local.
 */
export function seedThread(project: ProjectRequest): ThreadComment[] {
  return [
    {
      id: `opener-${project.id}`,
      authorName: project.user_name || 'Anonymous',
      authorInitials: getInitials(project.user_name || 'Anonymous'),
      body: project.description,
      timestamp: project.timestamp,
      isRequester: true,
    },
  ];
}

/** Map 4-state RequestStatus (+ interest) onto the 5-step activity timeline. */
export function activityIndex(status: RequestStatus, offerCount: number): number {
  if (status === 'completed') return 4;
  if (status === 'in_progress') return 3;
  if (status === 'accepted') return 2;
  if (offerCount > 0) return 1; // Offers received while still pending
  return 0; // Created
}

export function isStepReached(
  step: ActivityStepKey,
  status: RequestStatus,
  offerCount: number
): boolean {
  const idx = ACTIVITY_STEPS.findIndex((s) => s.key === step);
  return idx <= activityIndex(status, offerCount);
}

/** Progress 0–1 across the classic 4-step request statuses (for list cards). */
export function statusProgress(status: RequestStatus): number {
  const order: RequestStatus[] = ['pending', 'accepted', 'in_progress', 'completed'];
  const i = order.indexOf(status);
  if (i <= 0) return 0.12; // slight fill so the bar never looks empty
  return i / (order.length - 1);
}

/** Parse inline `code` fences / backticks into segments for comment rendering. */
export function parseCommentBody(
  body: string
): { type: 'text' | 'code'; value: string }[] {
  const parts: { type: 'text' | 'code'; value: string }[] = [];
  // Fenced ``` blocks first, then inline `code`
  const fence = /```([\s\S]*?)```/g;
  let last = 0;
  let m: RegExpExecArray | null;
  const chunks: { start: number; end: number; value: string; kind: 'code' }[] = [];
  while ((m = fence.exec(body)) !== null) {
    chunks.push({ start: m.index, end: m.index + m[0].length, value: m[1].replace(/^\n|\n$/g, ''), kind: 'code' });
  }
  if (chunks.length === 0) {
    return parseInlineCode(body);
  }
  for (const c of chunks) {
    if (c.start > last) parts.push(...parseInlineCode(body.slice(last, c.start)));
    parts.push({ type: 'code', value: c.value });
    last = c.end;
  }
  if (last < body.length) parts.push(...parseInlineCode(body.slice(last)));
  return parts;
}

function parseInlineCode(text: string): { type: 'text' | 'code'; value: string }[] {
  const parts: { type: 'text' | 'code'; value: string }[] = [];
  const re = /`([^`]+)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ type: 'text', value: text.slice(last, m.index) });
    parts.push({ type: 'code', value: m[1] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ type: 'text', value: text.slice(last) });
  return parts.length ? parts : [{ type: 'text', value: text }];
}

export const SUGGESTED_TECH = [
  'React',
  'TypeScript',
  'Node.js',
  'FastAPI',
  'Python',
  'Rust',
  'Go',
  'PostgreSQL',
  'Redis',
  'Docker',
  'WebSockets',
  'GraphQL',
  'Kubernetes',
  'AWS',
  'Tailwind',
  'Next.js',
];
