import type { ActivityTab } from '../components/ActivityBar';
import { isProjectHelpHash } from '../components/projectHelp/routes';

/** Top-level shell routes — hash-based so refresh restores the active tab. */
export function tabFromHash(
  hash: string = typeof window !== 'undefined' ? window.location.hash : ''
): ActivityTab {
  if (isProjectHelpHash(hash)) return 'projectHelp';
  const raw = hash.replace(/^#\/?/, '');
  const pathOnly = raw.split('?')[0];
  const first = pathOnly.split('/').filter(Boolean)[0];
  if (first === 'matches') return 'matches';
  if (first === 'profile') return 'profile';
  return 'discover';
}

/** `#/profile/:userId` → other user's public profile; bare `#/profile` → own. */
export function publicProfileUserIdFromHash(
  hash: string = typeof window !== 'undefined' ? window.location.hash : ''
): number | null {
  const raw = hash.replace(/^#\/?/, '');
  const parts = raw.split('/').filter(Boolean);
  if (parts[0] === 'profile' && parts[1] && /^\d+$/.test(parts[1])) {
    return Number(parts[1]);
  }
  return null;
}

export function hashForPublicProfile(userId: number): string {
  return `#/profile/${userId}`;
}

/** `#/matches/:conversationId` — restore selected chat on refresh. */
export function matchConversationIdFromHash(
  hash: string = typeof window !== 'undefined' ? window.location.hash : ''
): string | null {
  const raw = hash.replace(/^#\/?/, '');
  const parts = raw.split('/').filter(Boolean);
  if (parts[0] === 'matches' && parts[1]) return parts[1];
  return null;
}

export function hashForMatchConversation(id: number | string): string {
  return `#/matches/${id}`;
}

export function hashForTab(tab: ActivityTab): string {
  switch (tab) {
    case 'matches':
      return '#/matches';
    case 'profile':
      return '#/profile';
    case 'projectHelp':
      return '#/project-help';
    default:
      return '#/discover';
  }
}

/** Write the shell hash without clobbering Project Help detail/new sub-routes. */
export function setTabHash(tab: ActivityTab): void {
  if (typeof window === 'undefined') return;
  if (tab === 'projectHelp') {
    if (!isProjectHelpHash()) {
      window.location.hash = hashForTab('projectHelp');
    }
    return;
  }
  const target = hashForTab(tab);
  if (window.location.hash !== target) {
    window.location.hash = target;
  }
}

export function setPublicProfileHash(userId: number): void {
  if (typeof window === 'undefined') return;
  const target = hashForPublicProfile(userId);
  if (window.location.hash !== target) {
    window.location.hash = target;
  }
}

export function setMatchConversationHash(id: number | string | null): void {
  if (typeof window === 'undefined') return;
  const target = id == null ? hashForTab('matches') : hashForMatchConversation(id);
  if (window.location.hash !== target) {
    window.location.hash = target;
  }
}
