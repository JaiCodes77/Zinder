import {
  hashForMatchConversation,
  hashForPublicProfile,
  hashForTab,
  publicProfileUserIdFromHash,
  tabFromHash,
} from './appRoutes';
import { hashForDiscover, parseDiscoverHash } from './discoverRoutes';
import { projectHelpHash, parseProjectHelpHash } from '../components/projectHelp/routes';

/**
 * Canonical Phase-3 happy-path shell hashes (auth is cookie/session, not hash).
 * Used as a lightweight E2E contract until Playwright/Cypress lands.
 */
export const PRODUCT_JOURNEY = [
  {
    step: 'discover-deck',
    hash: hashForDiscover({ view: 'deck', sort: 'match', tags: [] }),
  },
  {
    step: 'discover-browse',
    hash: hashForDiscover({ view: 'browse', sort: 'newest', tags: ['React'] }),
  },
  {
    step: 'match-inbox',
    hash: hashForTab('matches'),
  },
  {
    step: 'match-chat',
    hash: hashForMatchConversation(42),
  },
  {
    step: 'project-help-list',
    hash: projectHelpHash('list'),
  },
  {
    step: 'project-help-new',
    hash: projectHelpHash('new'),
  },
  {
    step: 'project-help-detail',
    hash: projectHelpHash('detail', 7),
  },
  {
    step: 'profile',
    hash: hashForTab('profile'),
  },
  {
    step: 'public-profile',
    hash: hashForPublicProfile(9),
  },
] as const;

export type JourneyStep = (typeof PRODUCT_JOURNEY)[number]['step'];

/** Resolve which shell tab a journey hash should restore after refresh. */
export function journeyTabForHash(hash: string) {
  return tabFromHash(hash);
}

export function assertJourneyHashesParse(): void {
  for (const { hash, step } of PRODUCT_JOURNEY) {
    const tab = tabFromHash(hash);
    if (step.startsWith('discover')) {
      if (tab !== 'discover') throw new Error(`${step}: expected discover tab`);
      parseDiscoverHash(hash);
    } else if (step.startsWith('match')) {
      if (tab !== 'matches') throw new Error(`${step}: expected matches tab`);
    } else if (step.startsWith('project-help')) {
      if (tab !== 'projectHelp') throw new Error(`${step}: expected projectHelp tab`);
      parseProjectHelpHash(hash);
    } else if (step === 'profile') {
      if (tab !== 'profile') throw new Error(`${step}: expected profile tab`);
      if (publicProfileUserIdFromHash(hash) != null) {
        throw new Error(`${step}: own profile hash must not carry a user id`);
      }
    } else if (step === 'public-profile') {
      if (tab !== 'profile') throw new Error(`${step}: expected profile tab`);
      if (publicProfileUserIdFromHash(hash) == null) {
        throw new Error(`${step}: expected #/profile/:userId`);
      }
    }
  }
}
