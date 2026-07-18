import type { ProjectHelpView } from './types';

/** Hash routes — Zinder has no React Router; Project Help uses `#/project-help…`. */
export function parseProjectHelpHash(
  hash: string = typeof window !== 'undefined' ? window.location.hash : ''
): { view: ProjectHelpView; id: number | null } {
  const raw = hash.replace(/^#\/?/, '');
  const parts = raw.split('/').filter(Boolean);
  if (parts[0] !== 'project-help') {
    return { view: 'list', id: null };
  }
  if (parts[1] === 'new') return { view: 'new', id: null };
  if (parts[1] && /^\d+$/.test(parts[1])) {
    return { view: 'detail', id: Number(parts[1]) };
  }
  return { view: 'list', id: null };
}

export function projectHelpHash(view: ProjectHelpView, id?: number | null): string {
  if (view === 'new') return '#/project-help/new';
  if (view === 'detail' && id != null) return `#/project-help/${id}`;
  return '#/project-help';
}

export function isProjectHelpHash(hash: string = window.location.hash): boolean {
  return /^#\/?project-help(?:\/|$)/.test(hash);
}
