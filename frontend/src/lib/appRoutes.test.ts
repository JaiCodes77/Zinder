import { describe, expect, it } from 'vitest';
import {
  hashForMatchConversation,
  hashForPublicProfile,
  hashForTab,
  matchConversationIdFromHash,
  publicProfileUserIdFromHash,
  tabFromHash,
} from './appRoutes';

describe('appRoutes', () => {
  it('maps hashes to activity tabs', () => {
    expect(tabFromHash('')).toBe('discover');
    expect(tabFromHash('#/discover')).toBe('discover');
    expect(tabFromHash('#/discover?view=browse&tags=Go')).toBe('discover');
    expect(tabFromHash('#/matches')).toBe('matches');
    expect(tabFromHash('#/matches/12')).toBe('matches');
    expect(tabFromHash('#/profile')).toBe('profile');
    expect(tabFromHash('#/profile/7')).toBe('profile');
    expect(tabFromHash('#/project-help')).toBe('projectHelp');
    expect(tabFromHash('#/project-help/new')).toBe('projectHelp');
    expect(tabFromHash('#/project-help/42')).toBe('projectHelp');
  });

  it('builds tab hashes', () => {
    expect(hashForTab('discover')).toBe('#/discover');
    expect(hashForTab('matches')).toBe('#/matches');
    expect(hashForTab('profile')).toBe('#/profile');
    expect(hashForTab('projectHelp')).toBe('#/project-help');
  });

  it('parses public profile user ids from hash', () => {
    expect(publicProfileUserIdFromHash('#/profile')).toBeNull();
    expect(publicProfileUserIdFromHash('#/profile/42')).toBe(42);
    expect(hashForPublicProfile(9)).toBe('#/profile/9');
  });

  it('parses match conversation ids from hash', () => {
    expect(matchConversationIdFromHash('#/matches')).toBeNull();
    expect(matchConversationIdFromHash('#/matches/12')).toBe('12');
    expect(hashForMatchConversation(12)).toBe('#/matches/12');
  });
});
