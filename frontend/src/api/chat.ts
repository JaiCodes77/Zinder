import { API_BASE, apiFetch } from './client';

export type ServerChatMessage = {
  id: number;
  match_id: number;
  sender_id: number;
  text: string;
  created_at: string;
  read_at?: string | null;
};

export type MessagesPage = {
  messages: ServerChatMessage[];
  next_before: number | null;
};

export function chatWsUrl(): string {
  const httpBase =
    (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') ||
    API_BASE;
  const wsBase = httpBase.replace(/^http/, 'ws');
  return `${wsBase}/chat/ws`;
}

export async function fetchMessages(
  matchId: number,
  opts?: { before?: number; limit?: number }
): Promise<MessagesPage> {
  const params = new URLSearchParams();
  if (opts?.before != null) params.set('before', String(opts.before));
  if (opts?.limit != null) params.set('limit', String(opts.limit));
  const qs = params.toString();
  return apiFetch<MessagesPage>(
    `/chat/conversations/${matchId}/messages${qs ? `?${qs}` : ''}`
  );
}

/** Newest message for inbox previews (`limit=1`, chronological page). */
export async function fetchLatestMessage(
  matchId: number
): Promise<ServerChatMessage | null> {
  const page = await fetchMessages(matchId, { limit: 1 });
  if (!page.messages.length) return null;
  return page.messages[page.messages.length - 1] ?? null;
}

export function previewChatText(text: string, max = 80): string {
  const oneLine = text.replace(/\s+/g, ' ').trim();
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, max - 1)}…`;
}

export async function sendMessage(
  matchId: number,
  text: string
): Promise<ServerChatMessage> {
  return apiFetch<ServerChatMessage>(`/chat/conversations/${matchId}/messages`, {
    method: 'POST',
    json: { text },
  });
}

export async function markRead(
  matchId: number,
  upToMessageId: number
): Promise<void> {
  await apiFetch<void>(`/chat/conversations/${matchId}/read`, {
    method: 'POST',
    json: { up_to_message_id: upToMessageId },
  });
}
