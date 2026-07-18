import { describe, expect, it } from 'vitest';
import { resolveMatchOnline } from './ChatChrome';

describe('resolveMatchOnline', () => {
  it('uses live peerOnline for the selected live chat', () => {
    expect(
      resolveMatchOnline({
        matchId: 1,
        selected: true,
        isLiveChat: true,
        peerOnline: true,
        presenceByMatchId: { 1: false },
      })
    ).toBe(true);
    expect(
      resolveMatchOnline({
        matchId: 1,
        selected: true,
        isLiveChat: true,
        peerOnline: false,
        presenceByMatchId: { 1: true },
      })
    ).toBe(false);
  });

  it('uses cached presence for non-selected matches', () => {
    expect(
      resolveMatchOnline({
        matchId: 7,
        selected: false,
        isLiveChat: false,
        peerOnline: false,
        presenceByMatchId: { 7: true },
      })
    ).toBe(true);
  });

  it('stays offline without cache or live signal', () => {
    expect(
      resolveMatchOnline({
        matchId: 3,
        selected: false,
        isLiveChat: false,
        peerOnline: true,
        presenceByMatchId: {},
      })
    ).toBe(false);
  });
});
