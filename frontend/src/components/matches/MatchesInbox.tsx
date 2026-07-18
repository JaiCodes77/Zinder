import React, { useEffect, useRef, useState } from 'react';
import {
  AnimatePresence,
  LayoutGroup,
  motion,
} from 'framer-motion';
import {
  ArrowDown,
  Check,
  CheckCheck,
  ChevronLeft,
  Loader2,
  Send,
  X,
} from 'lucide-react';
import {
  computeVirtualWindow,
  VIRTUALIZE_THRESHOLD,
} from '../../lib/virtualList';
import {
  DateSeparator,
  MATCH_EASE,
  MatchEmptyChat,
  NoConversationOpen,
  OnlinePresence,
  resolveMatchOnline,
} from './ChatChrome';
import type { ChatMessage, Match } from './types';

/** Approximate Matches inbox row height (avatar + padding). */
const MATCH_ROW_HEIGHT = 68;
/** Estimated chat bubble row for long-thread windowing. */
const CHAT_ROW_HEIGHT = 72;
const CHAT_VIRTUALIZE_AT = 40;

export type { ChatMessage, Match } from './types';

type MatchesInboxProps = {
  matches: Match[];
  loadingMatches: boolean;
  matchesError?: string | null;
  onRetryMatches?: () => void;
  selectedMatch: Match | null;
  reducedMotion: boolean;
  messages: ChatMessage[];
  isTyping: boolean;
  isLiveChat: boolean;
  liveLoading: boolean;
  liveError: string | null;
  peerOnline: boolean;
  /** Last-known WS presence by match_id (non-selected rows). */
  presenceByMatchId?: Record<number, boolean>;
  chatInput: string;
  chatFocused: boolean;
  showNewMsgPill: boolean;
  chatScrollRef: React.RefObject<HTMLDivElement | null>;
  chatInputRef: React.RefObject<HTMLInputElement | null>;
  onSelectMatch: (match: Match) => void;
  onCloseConversation: () => void;
  onViewProfile: (userId: number) => void;
  onChatScroll: () => void;
  onScrollToBottom: () => void;
  onChatInputChange: (value: string) => void;
  onChatFocusChange: (focused: boolean) => void;
  onLiveTypingChange: (value: string) => void;
  onLiveTypingBlur: () => void;
  onSend: (e: React.FormEvent) => void;
  onSuggestStarter: (text: string) => void;
};

const InboxSpinner: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex flex-col items-center justify-center gap-3 py-16">
    <Loader2 className="w-5 h-5 text-fg-subtle animate-spin" />
    <p className="mono-label">{label}</p>
  </div>
);

export const MatchesInbox: React.FC<MatchesInboxProps> = ({
  matches,
  loadingMatches,
  matchesError = null,
  onRetryMatches,
  selectedMatch,
  reducedMotion,
  messages,
  isTyping,
  isLiveChat,
  liveLoading,
  liveError,
  peerOnline,
  presenceByMatchId = {},
  chatInput,
  chatFocused,
  showNewMsgPill,
  chatScrollRef,
  chatInputRef,
  onSelectMatch,
  onCloseConversation,
  onViewProfile,
  onChatScroll,
  onScrollToBottom,
  onChatInputChange,
  onChatFocusChange,
  onLiveTypingChange,
  onLiveTypingBlur,
  onSend,
  onSuggestStarter,
}) => {
  const inboxScrollRef = useRef<HTMLDivElement>(null);
  const [inboxScrollTop, setInboxScrollTop] = useState(0);
  const [inboxViewportH, setInboxViewportH] = useState(480);
  const [chatScrollTop, setChatScrollTop] = useState(0);
  const [chatViewportH, setChatViewportH] = useState(480);

  useEffect(() => {
    const el = inboxScrollRef.current;
    if (!el) return;
    const sync = () => setInboxViewportH(el.clientHeight);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    const sync = () => setChatViewportH(el.clientHeight);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [chatScrollRef, selectedMatch?.id]);

  const virtualizeInbox = matches.length >= VIRTUALIZE_THRESHOLD;
  const inboxWindow = virtualizeInbox
    ? computeVirtualWindow(
        matches.length,
        inboxScrollTop,
        inboxViewportH,
        MATCH_ROW_HEIGHT
      )
    : {
        start: 0,
        end: matches.length,
        offsetTop: 0,
        totalHeight: matches.length * MATCH_ROW_HEIGHT,
      };
  const visibleMatches = matches.slice(inboxWindow.start, inboxWindow.end);

  const virtualizeChat = messages.length >= CHAT_VIRTUALIZE_AT;
  const chatWindow = virtualizeChat
    ? computeVirtualWindow(
        messages.length,
        chatScrollTop,
        chatViewportH,
        CHAT_ROW_HEIGHT
      )
    : {
        start: 0,
        end: messages.length,
        offsetTop: 0,
        totalHeight: messages.length * CHAT_ROW_HEIGHT,
      };
  const visibleMessages = messages.slice(chatWindow.start, chatWindow.end);

  return (
    <div className="flex-1 flex min-h-0">
      <div
        className={`w-full md:w-[320px] md:border-r border-white/12 flex-col min-h-0 bg-bg-base/40 ${
          selectedMatch ? 'hidden md:flex' : 'flex'
        }`}
      >
        <div className="h-14 px-5 flex items-center justify-between border-b border-white/12 flex-shrink-0 glass">
          <div className="min-w-0">
            <p className="mono-label !text-[10px] leading-none mb-1">~/zinder/matches</p>
            <h2 className="text-[15px] font-semibold tracking-tight text-fg">Inbox</h2>
          </div>
          <span className="nav-count-chip" aria-hidden>
            {matches.length}
          </span>
        </div>

        <div
          ref={inboxScrollRef}
          className="flex-1 overflow-y-auto p-2.5"
          role="listbox"
          aria-label={`${matches.length} conversations`}
          onScroll={(e) => setInboxScrollTop(e.currentTarget.scrollTop)}
        >
          {loadingMatches ? (
            <InboxSpinner label="loading matches" />
          ) : matchesError ? (
            <div className="text-center py-14 px-6" role="alert">
              <p className="text-[13px] text-fg-muted">{matchesError}</p>
              {onRetryMatches && (
                <button
                  type="button"
                  onClick={onRetryMatches}
                  className="btn-ghost mt-4 px-3.5 py-1.5 rounded-[10px] text-[12px]"
                >
                  Try again
                </button>
              )}
            </div>
          ) : matches.length > 0 ? (
            <LayoutGroup id="active-match-list">
              <div
                className={virtualizeInbox ? 'relative' : 'space-y-0.5'}
                style={
                  virtualizeInbox ? { height: inboxWindow.totalHeight } : undefined
                }
              >
                <div
                  className={virtualizeInbox ? 'absolute left-0 right-0 space-y-0.5' : undefined}
                  style={
                    virtualizeInbox
                      ? { top: inboxWindow.offsetTop }
                      : undefined
                  }
                >
              {visibleMatches.map((match) => {
                const selected = selectedMatch?.id === match.id;
                const showPresence = resolveMatchOnline({
                  matchId: match.matchId,
                  selected,
                  isLiveChat: selected && isLiveChat,
                  peerOnline,
                  presenceByMatchId,
                });
                const unreadHint = match.unread ? ', unread' : '';
                return (
                  <motion.button
                    key={match.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    aria-label={`${match.name}${unreadHint}${
                      match.lastMessage ? `: ${match.lastMessage}` : ''
                    }${showPresence ? ', online' : ''}`}
                    data-match-online={showPresence ? 'true' : 'false'}
                    onClick={() => onSelectMatch(match)}
                    className={`group relative w-full flex items-center gap-3 p-2.5 pl-3.5 rounded-[12px] text-left transition-colors duration-150 ${
                      selected ? 'bg-white/[0.09]' : 'hover:bg-white/[0.06]'
                    }`}
                    style={virtualizeInbox ? { height: MATCH_ROW_HEIGHT } : undefined}
                  >
                    {selected && (
                      <motion.div
                        layoutId="active-match-indicator"
                        className="absolute left-0 top-2 bottom-2 w-[4px] rounded-r-full bg-accent-brand"
                        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                      />
                    )}
                    <motion.div
                      className="w-full flex items-center gap-3 min-w-0"
                      whileHover={reducedMotion ? undefined : { x: 2 }}
                      transition={{ duration: 0.15, ease: MATCH_EASE }}
                    >
                      <div className="relative flex-shrink-0">
                        <div className="w-10 h-10 rounded-full overflow-hidden border border-white/12">
                          <img
                            src={match.avatar}
                            alt={match.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        {showPresence && <OnlinePresence reducedMotion={reducedMotion} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline gap-2">
                          <span
                            className={`text-[13px] truncate flex items-center gap-1.5 ${
                              match.unread
                                ? 'font-semibold text-fg'
                                : 'font-normal text-fg-muted'
                            }`}
                          >
                            {match.name}
                            {match.unread && (
                              <span className="w-1.5 h-1.5 rounded-full bg-accent-brand flex-shrink-0" />
                            )}
                            {match.type === 'project' && (
                              <span className="px-1.5 py-px rounded bg-white/8 text-fg-muted text-[10px] font-mono flex-shrink-0 font-normal">
                                project
                              </span>
                            )}
                          </span>
                          <span className="mono-label flex-shrink-0">{match.time}</span>
                        </div>
                        <p
                          className={`text-xs truncate mt-0.5 ${
                            match.unread ? 'text-fg-muted' : 'text-fg-subtle'
                          }`}
                        >
                          {match.lastMessage}
                        </p>
                      </div>
                    </motion.div>
                  </motion.button>
                );
              })}
                </div>
              </div>
            </LayoutGroup>
          ) : (
            <div className="text-center py-14 px-6">
              <p className="text-[13px] text-fg-muted">No matches yet.</p>
              <p className="text-xs text-fg-subtle mt-1">Like a few profiles to get started.</p>
            </div>
          )}
        </div>
      </div>

      <div
        className={`flex-1 flex-col min-h-0 bg-bg-base/20 ${
          selectedMatch ? 'flex' : 'hidden md:flex'
        }`}
      >
        {selectedMatch ? (
          <>
            <div className="h-14 px-4 md:px-5 border-b border-white/12 flex items-center justify-between flex-shrink-0 glass">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={onCloseConversation}
                  aria-label="Back to matches"
                  className="md:hidden p-1.5 -ml-1.5 rounded-md text-fg-subtle hover:text-fg transition-colors duration-200"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const uid =
                      selectedMatch.peerUserId ??
                      (selectedMatch.type !== 'project' ? selectedMatch.id : null);
                    if (typeof uid === 'number') onViewProfile(uid);
                  }}
                  className="flex items-center gap-3 min-w-0 text-left rounded-md hover:bg-white/[0.03] -ml-1 pl-1 pr-2 py-1 transition-colors duration-200"
                  aria-label={`View ${selectedMatch.name}'s profile`}
                >
                  <div className="relative flex-shrink-0">
                    <div className="w-8 h-8 rounded-full overflow-hidden border border-white/12">
                      <img
                        src={selectedMatch.avatar}
                        alt={selectedMatch.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    {resolveMatchOnline({
                      matchId: selectedMatch.matchId,
                      selected: true,
                      isLiveChat,
                      peerOnline,
                      presenceByMatchId,
                    }) && (
                      <OnlinePresence reducedMotion={reducedMotion} size="sm" tone="human" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="display text-[15px] text-fg truncate leading-tight">
                      {selectedMatch.name}
                    </h3>
                    <p className="mono-label !text-[10px] truncate leading-tight mt-0.5">
                      {resolveMatchOnline({
                        matchId: selectedMatch.matchId,
                        selected: true,
                        isLiveChat,
                        peerOnline,
                        presenceByMatchId,
                      })
                        ? 'online · live'
                        : selectedMatch.type === 'project'
                          ? selectedMatch.projectTitle || 'project thread'
                          : `match/${selectedMatch.matchId ?? selectedMatch.id}`}
                    </p>
                  </div>
                </button>
              </div>
              <button
                type="button"
                onClick={onCloseConversation}
                aria-label="Close conversation"
                className="hidden md:block p-1.5 rounded-md text-fg-subtle hover:text-fg hover:bg-white/5 transition-colors duration-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative flex-1 flex flex-col min-h-0">
              <div
                ref={chatScrollRef}
                onScroll={() => {
                  const el = chatScrollRef.current;
                  if (el) setChatScrollTop(el.scrollTop);
                  onChatScroll();
                }}
                className="flex-1 overflow-y-auto px-4 md:px-6 py-5 flex flex-col min-h-0"
              >
                {isLiveChat && liveLoading ? (
                  <div className="flex-1 flex items-center justify-center text-sm text-fg-subtle">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Loading conversation…
                  </div>
                ) : isLiveChat && liveError ? (
                  <div className="flex-1 flex items-center justify-center px-6 text-center text-sm text-pass">
                    {liveError}
                  </div>
                ) : messages.length === 0 ? (
                  <MatchEmptyChat
                    key={selectedMatch.id}
                    name={selectedMatch.name}
                    avatar={selectedMatch.avatar}
                    reducedMotion={reducedMotion}
                    onSuggest={onSuggestStarter}
                  />
                ) : (
                  <div className="space-y-2.5">
                    <DateSeparator label="Today" />
                    <div
                      className={virtualizeChat ? 'relative' : undefined}
                      style={
                        virtualizeChat ? { height: chatWindow.totalHeight } : undefined
                      }
                    >
                      <div
                        className={
                          virtualizeChat
                            ? 'absolute left-0 right-0 space-y-2.5'
                            : 'space-y-2.5'
                        }
                        style={
                          virtualizeChat ? { top: chatWindow.offsetTop } : undefined
                        }
                      >
                    <AnimatePresence initial={!reducedMotion && !virtualizeChat}>
                      {visibleMessages.map((msg, visibleIdx) => {
                        const idx = chatWindow.start + visibleIdx;
                        const isSystemBrief = msg.text.startsWith('[SYSTEM: PROJECT BRIEF]');
                        const enter =
                          reducedMotion || virtualizeChat
                            ? false
                            : { opacity: 0, y: 8, scale: 0.95 };
                        const stagger = {
                          duration: reducedMotion || virtualizeChat ? 0 : 0.28,
                          delay:
                            reducedMotion || virtualizeChat
                              ? 0
                              : Math.min(idx, 8) * 0.06,
                          ease: MATCH_EASE,
                        };

                        if (isSystemBrief) {
                          const titleLine = msg.text.split('\n')[1] || '';
                          const stackLine = msg.text.split('\n')[2] || '';
                          const descLines = msg.text.split('\n').slice(4).join('\n') || '';
                          return (
                            <motion.div
                              key={`${selectedMatch.id}-sys-${idx}`}
                              initial={enter}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.98 }}
                              transition={stagger}
                              className="w-full flex justify-center py-2"
                            >
                              <div className="w-full max-w-md glass rounded-[16px] p-4 space-y-2.5 border-l-[3px] border-l-accent-brand/50">
                                <div className="flex items-center justify-between border-b border-white/12 pb-2">
                                  <span className="kicker !tracking-[0.14em]">Project brief</span>
                                  <span className="mono-label">{msg.time}</span>
                                </div>
                                <h4 className="text-sm font-semibold text-fg">
                                  {titleLine.replace('Project: ', '')}
                                </h4>
                                <p className="text-[12px] text-fg-muted">
                                  {stackLine.replace('Stack: ', '')}
                                </p>
                                <p className="text-[13px] text-fg-muted leading-relaxed whitespace-pre-wrap">
                                  {descLines.replace('Description: ', '')}
                                </p>
                              </div>
                            </motion.div>
                          );
                        }

                        const mine = msg.sender === 'me';
                        return (
                          <motion.div
                            key={
                              msg.id != null
                                ? `msg-${msg.id}`
                                : `${selectedMatch.id}-msg-${idx}`
                            }
                            initial={enter}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            transition={stagger}
                            className={`group/bubble flex ${mine ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`chat-bubble max-w-[75%] px-3.5 py-2.5 text-sm leading-relaxed ${
                                mine ? 'chat-bubble--out' : 'chat-bubble--in'
                              }`}
                            >
                              <p className="whitespace-pre-wrap">{msg.text}</p>
                              <span
                                className={`flex items-center justify-end gap-1 mt-1 mono-label !text-[10px] transition-opacity duration-200 ${
                                  reducedMotion
                                    ? 'opacity-70'
                                    : 'opacity-0 group-hover/bubble:opacity-100'
                                }`}
                              >
                                {msg.time}
                                {mine && (
                                  <span
                                    className={`inline-flex ${msg.read ? 'text-accent-merge' : ''}`}
                                    title={msg.read ? 'Read' : 'Sent'}
                                  >
                                    {msg.read ? (
                                      <CheckCheck className="w-3 h-3" />
                                    ) : (
                                      <Check className="w-3 h-3" />
                                    )}
                                  </span>
                                )}
                              </span>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                      </div>
                    </div>

                    {isTyping && (
                      <motion.div
                        className="flex justify-start"
                        initial={reducedMotion ? false : { opacity: 0, y: 6, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.22, ease: MATCH_EASE }}
                      >
                        <div className="px-3 py-2.5 flex gap-1.5 items-center rounded-full bg-white/[0.06] border border-white/12 backdrop-blur-md">
                          {[0, 1, 2].map((i) => (
                            <motion.span
                              key={i}
                              className="w-1.5 h-1.5 rounded-full bg-fg-muted"
                              animate={
                                reducedMotion ? { opacity: 0.55 } : { y: [0, -3.5, 0] }
                              }
                              transition={
                                reducedMotion
                                  ? { duration: 0 }
                                  : {
                                      duration: 0.95,
                                      repeat: Infinity,
                                      delay: i * 0.1,
                                      ease: 'easeInOut',
                                    }
                              }
                            />
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </div>
                )}
              </div>

              <AnimatePresence>
                {showNewMsgPill && (
                  <motion.button
                    type="button"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.18, ease: MATCH_EASE }}
                    onClick={onScrollToBottom}
                    aria-label="Jump to newest messages"
                    className="absolute bottom-3 left-1/2 -translate-x-1/2 glass-raised px-3 py-1.5 rounded-full text-[12px] font-medium text-fg flex items-center gap-1.5 shadow-none"
                  >
                    <ArrowDown className="w-3 h-3 text-fg-muted" aria-hidden />
                    New message
                  </motion.button>
                )}
              </AnimatePresence>
            </div>

            <form
              onSubmit={onSend}
              className="p-3.5 border-t border-white/12 glass flex-shrink-0"
            >
              <p className="mono-label !text-[10px] mb-2 px-0.5">
                message → {selectedMatch.name.toLowerCase().replace(/\s+/g, '-')}
              </p>
              <div
                className={`field flex items-center gap-2 pl-3.5 pr-1.5 py-1.5 transition-[box-shadow,border-color] duration-200 ${
                  chatFocused
                    ? '!border-accent-merge/35 !shadow-[0_0_0_3px_rgba(63,185,80,0.08)]'
                    : ''
                }`}
              >
                <input
                  ref={chatInputRef}
                  type="text"
                  placeholder="Write a message…"
                  value={chatInput}
                  onChange={(e) => {
                    const v = e.target.value;
                    onChatInputChange(v);
                    if (isLiveChat) onLiveTypingChange(v);
                  }}
                  onFocus={() => onChatFocusChange(true)}
                  onBlur={() => {
                    onChatFocusChange(false);
                    if (isLiveChat) onLiveTypingBlur();
                  }}
                  className="flex-1 bg-transparent text-sm text-fg placeholder-fg-subtle focus:outline-none border-none"
                  aria-label={`Message ${selectedMatch.name}`}
                />
                <motion.button
                  type="submit"
                  disabled={!chatInput.trim()}
                  aria-label="Send message"
                  animate={
                    chatInput.trim()
                      ? {
                          scale: 1,
                          backgroundColor: 'rgba(185, 144, 255, 1)',
                          color: 'rgba(10, 14, 18, 1)',
                        }
                      : {
                          scale: 0.92,
                          backgroundColor: 'rgba(255, 255, 255, 0.08)',
                          color: 'rgba(107, 115, 137, 1)',
                        }
                  }
                  transition={{ type: 'spring', stiffness: 520, damping: 28 }}
                  className="p-2 rounded-[10px] disabled:pointer-events-none"
                >
                  <Send className="w-3.5 h-3.5" />
                </motion.button>
              </div>
            </form>
          </>
        ) : (
          <NoConversationOpen
            matches={matches}
            reducedMotion={reducedMotion}
            onSelect={onSelectMatch}
          />
        )}
      </div>
    </div>
  );
};
