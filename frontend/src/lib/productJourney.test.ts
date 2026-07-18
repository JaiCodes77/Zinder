import { describe, expect, it } from 'vitest';
import {
  matchConversationIdFromHash,
  publicProfileUserIdFromHash,
  tabFromHash,
} from './appRoutes';
import { parseDiscoverHash } from './discoverRoutes';
import { parseProjectHelpHash } from '../components/projectHelp/routes';
import {
  PRODUCT_JOURNEY,
  assertJourneyHashesParse,
  journeyTabForHash,
} from './productJourney';

describe('product journey (hash E2E contract)', () => {
  it('covers auth→swipe→match→PH→chat shell stages', () => {
    const steps = PRODUCT_JOURNEY.map((s) => s.step);
    expect(steps).toEqual([
      'discover-deck',
      'discover-browse',
      'match-inbox',
      'match-chat',
      'project-help-list',
      'project-help-new',
      'project-help-detail',
      'profile',
      'public-profile',
    ]);
  });

  it('parses every journey hash back to the right tab/sub-route', () => {
    expect(() => assertJourneyHashesParse()).not.toThrow();

    expect(journeyTabForHash(PRODUCT_JOURNEY[0].hash)).toBe('discover');
    expect(parseDiscoverHash(PRODUCT_JOURNEY[1].hash)).toEqual({
      view: 'browse',
      sort: 'newest',
      tags: ['React'],
    });
    expect(matchConversationIdFromHash(PRODUCT_JOURNEY[3].hash)).toBe('42');
    expect(parseProjectHelpHash(PRODUCT_JOURNEY[5].hash)).toEqual({
      view: 'new',
      id: null,
    });
    expect(parseProjectHelpHash(PRODUCT_JOURNEY[6].hash)).toEqual({
      view: 'detail',
      id: 7,
    });
    expect(tabFromHash(PRODUCT_JOURNEY[7].hash)).toBe('profile');
    expect(publicProfileUserIdFromHash(PRODUCT_JOURNEY[7].hash)).toBeNull();
    expect(publicProfileUserIdFromHash(PRODUCT_JOURNEY[8].hash)).toBe(9);
  });
});
