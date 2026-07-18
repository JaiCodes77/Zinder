import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MatchesInbox } from './MatchesInbox';
import type { Match } from './types';

beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
});

const noop = () => {};
const emptyRef = { current: null };

function renderInbox(
  overrides: Partial<React.ComponentProps<typeof MatchesInbox>> = {}
) {
  return render(
    <MatchesInbox
      matches={[]}
      loadingMatches={false}
      matchesError={null}
      selectedMatch={null}
      reducedMotion
      messages={[]}
      isTyping={false}
      isLiveChat={false}
      liveLoading={false}
      liveError={null}
      peerOnline={false}
      chatInput=""
      chatFocused={false}
      showNewMsgPill={false}
      chatScrollRef={emptyRef}
      chatInputRef={emptyRef}
      onSelectMatch={noop}
      onCloseConversation={noop}
      onViewProfile={noop}
      onChatScroll={noop}
      onScrollToBottom={noop}
      onChatInputChange={noop}
      onChatFocusChange={noop}
      onLiveTypingChange={noop}
      onLiveTypingBlur={noop}
      onSend={(e) => e.preventDefault()}
      onSuggestStarter={noop}
      {...overrides}
    />
  );
}

describe('MatchesInbox error UI', () => {
  it('shows load error with retry instead of empty inbox', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    renderInbox({
      matchesError: "Couldn't load matches. Try again.",
      onRetryMatches: onRetry,
    });

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toMatch(/couldn't load matches/i);
    expect(screen.queryByText(/no matches yet/i)).toBeNull();

    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('still lists conversations when loaded', () => {
    const match: Match = {
      id: 1,
      matchId: 1,
      peerUserId: 9,
      name: 'Ada',
      avatar: '/profile_1.png',
      lastMessage: 'hi',
      time: '1:00 PM',
      unread: false,
      type: 'match',
    };
    renderInbox({ matches: [match] });
    expect(screen.getByRole('option', { name: /ada/i })).toBeTruthy();
  });
});

describe('MatchesInbox presence', () => {
  const match: Match = {
    id: 1,
    matchId: 42,
    peerUserId: 9,
    name: 'Ada',
    avatar: '/profile_1.png',
    lastMessage: 'hi',
    time: '1:00 PM',
    unread: false,
    type: 'match',
  };

  it('does not claim online without live WS presence', () => {
    renderInbox({
      matches: [match],
      selectedMatch: match,
      isLiveChat: true,
      peerOnline: false,
    });
    expect(screen.queryByText(/online · live/i)).toBeNull();
    expect(screen.getByText(/match\/42/i)).toBeTruthy();
  });

  it('shows online · live only when peerOnline', () => {
    renderInbox({
      matches: [match],
      selectedMatch: match,
      isLiveChat: true,
      peerOnline: true,
    });
    expect(screen.getByText(/online · live/i)).toBeTruthy();
  });

  it('keeps inbox row presence from cached match_id after leaving the chat', () => {
    const other: Match = {
      ...match,
      id: 2,
      matchId: 99,
      name: 'Grace',
    };
    renderInbox({
      matches: [match, other],
      selectedMatch: other,
      isLiveChat: true,
      peerOnline: false,
      presenceByMatchId: { 42: true },
    });
    const onlineRows = document.querySelectorAll('[data-match-online="true"]');
    expect(onlineRows.length).toBeGreaterThanOrEqual(1);
    expect(
      [...onlineRows].some((el) => el.getAttribute('aria-label')?.startsWith('Ada'))
    ).toBe(true);
    // Selected Grace has no live peerOnline — header shows match path, not live label.
    expect(screen.getByText(/match\/99/i)).toBeTruthy();
  });
});
