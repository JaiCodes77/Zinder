import { useCallback, useEffect, useRef, useState } from 'react';
import {
  chatWsUrl,
  fetchMessages,
  markRead,
  sendMessage,
  type ServerChatMessage,
} from '../api/chat';

export type UiChatMessage = {
  id?: number;
  sender: 'me' | 'them';
  text: string;
  time: string;
  read?: boolean;
};

function formatMsgTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function toUi(msg: ServerChatMessage, myUserId: number): UiChatMessage {
  return {
    id: msg.id,
    sender: msg.sender_id === myUserId ? 'me' : 'them',
    text: msg.text,
    time: formatMsgTime(msg.created_at),
    read: Boolean(msg.read_at),
  };
}

type UseMatchChatOptions = {
  matchId: number | null;
  myUserId: number | null;
  onPreview?: (text: string) => void;
  /** Fired on peer presence for the subscribed match (also when leaving online→offline). */
  onPresence?: (matchId: number, online: boolean) => void;
};

/**
 * REST history + gateway WebSocket for a single match conversation.
 * Project-help faux matches should pass matchId=null and keep local state.
 */
export function useMatchChat({ matchId, myUserId, onPreview, onPresence }: UseMatchChatOptions) {
  const [messages, setMessages] = useState<UiChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [peerTyping, setPeerTyping] = useState(false);
  const [peerOnline, setPeerOnline] = useState(false);
  const [connected, setConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const matchIdRef = useRef<number | null>(null);
  const myUserIdRef = useRef<number | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onPreviewRef = useRef(onPreview);
  onPreviewRef.current = onPreview;
  const onPresenceRef = useRef(onPresence);
  onPresenceRef.current = onPresence;
  matchIdRef.current = matchId;
  myUserIdRef.current = myUserId;

  const upsertMessage = useCallback((ui: UiChatMessage) => {
    setMessages((prev) => {
      if (ui.id != null && prev.some((m) => m.id === ui.id)) return prev;
      // Drop optimistic twin (same text from me, no id yet)
      if (ui.id != null && ui.sender === 'me') {
        const withoutOptimistic = prev.filter(
          (m) => !(m.id == null && m.sender === 'me' && m.text === ui.text)
        );
        return [...withoutOptimistic, ui];
      }
      return [...prev, ui];
    });
  }, []);

  // Load history when conversation changes
  useEffect(() => {
    if (matchId == null || myUserId == null) {
      setMessages([]);
      setError(null);
      setPeerTyping(false);
      setPeerOnline(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setMessages([]);
    setPeerTyping(false);

    (async () => {
      try {
        const page = await fetchMessages(matchId, { limit: 50 });
        if (cancelled) return;
        // API returns newest-first pages in tests — normalize chronological
        const sorted = [...page.messages].sort((a, b) => a.id - b.id);
        setMessages(sorted.map((m) => toUi(m, myUserId)));
        const lastTheirs = [...sorted].reverse().find((m) => m.sender_id !== myUserId);
        if (lastTheirs) {
          try {
            await markRead(matchId, lastTheirs.id);
          } catch {
            // non-fatal
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load messages.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [matchId, myUserId]);

  // Single shared socket; re-subscribe when matchId changes
  useEffect(() => {
    if (myUserId == null) return;

    let closed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (closed) return;
      const ws = new WebSocket(chatWsUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        if (closed) return;
        setConnected(true);
        const mid = matchIdRef.current;
        if (mid != null) {
          ws.send(JSON.stringify({ type: 'subscribe', match_id: mid }));
        }
      };

      ws.onmessage = (ev) => {
        let data: Record<string, unknown>;
        try {
          data = JSON.parse(String(ev.data)) as Record<string, unknown>;
        } catch {
          return;
        }
        const type = data.type;
        const mid = matchIdRef.current;
        const uid = myUserIdRef.current;
        if (uid == null) return;

        if (type === 'message' && typeof data.match_id === 'number') {
          if (mid != null && data.match_id !== mid) return;
          const msg = data as unknown as ServerChatMessage;
          if (typeof msg.id !== 'number' || typeof msg.text !== 'string') return;
          const ui = toUi(msg, uid);
          upsertMessage(ui);
          if (ui.sender === 'them') {
            onPreviewRef.current?.(ui.text);
            if (mid != null) {
              void markRead(mid, msg.id).catch(() => undefined);
            }
          }
        } else if (type === 'typing' && typeof data.match_id === 'number') {
          if (mid != null && data.match_id !== mid) return;
          if (data.user_id === uid) return;
          setPeerTyping(Boolean(data.is_typing));
          if (data.is_typing) {
            if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
            typingTimerRef.current = setTimeout(() => setPeerTyping(false), 4000);
          }
        } else if (type === 'presence' && typeof data.match_id === 'number') {
          if (mid != null && data.match_id !== mid) return;
          if (data.user_id === uid) return;
          const online = Boolean(data.online);
          setPeerOnline(online);
          onPresenceRef.current?.(data.match_id, online);
        } else if (type === 'read' && typeof data.match_id === 'number') {
          if (mid != null && data.match_id !== mid) return;
          if (data.reader_id === uid) return;
          const upTo = data.up_to_message_id;
          if (typeof upTo === 'number') {
            setMessages((prev) =>
              prev.map((m) =>
                m.sender === 'me' && m.id != null && m.id <= upTo ? { ...m, read: true } : m
              )
            );
          }
        }
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        if (!closed) {
          reconnectTimer = setTimeout(connect, 2000);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      wsRef.current?.close();
      wsRef.current = null;
      setConnected(false);
    };
  }, [myUserId, upsertMessage]);

  // Subscribe when active match changes (socket already open)
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || matchId == null) return;
    ws.send(JSON.stringify({ type: 'subscribe', match_id: matchId }));
    setPeerTyping(false);
  }, [matchId]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || matchId == null || myUserId == null) return;

      const optimistic: UiChatMessage = {
        sender: 'me',
        text: trimmed,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        read: false,
      };
      setMessages((prev) => [...prev, optimistic]);
      onPreviewRef.current?.(trimmed);

      try {
        const saved = await sendMessage(matchId, trimmed);
        upsertMessage(toUi(saved, myUserId));
      } catch (err) {
        setMessages((prev) =>
          prev.filter((m) => !(m.id == null && m.sender === 'me' && m.text === trimmed))
        );
        setError(err instanceof Error ? err.message : 'Could not send message.');
        throw err;
      }

      // Clear typing indicator for peer
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'typing', match_id: matchId, is_typing: false }));
      }
    },
    [matchId, myUserId, upsertMessage]
  );

  const notifyTyping = useCallback(
    (isTyping: boolean) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN || matchId == null) return;
      ws.send(JSON.stringify({ type: 'typing', match_id: matchId, is_typing: isTyping }));
    },
    [matchId]
  );

  /** Debounced typing signal from the composer input value. */
  const onInputChange = useCallback(
    (value: string) => {
      notifyTyping(value.trim().length > 0);
    },
    [notifyTyping]
  );

  return {
    messages,
    loading,
    error,
    peerTyping,
    peerOnline,
    connected,
    send,
    notifyTyping,
    onInputChange,
  };
}
