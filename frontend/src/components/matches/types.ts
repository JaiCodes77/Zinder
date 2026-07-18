export type Match = {
  id: number | string;
  /** Conversation id for chat REST/WS (real matches only). */
  matchId?: number;
  /** Other user's profile id. */
  peerUserId?: number;
  name: string;
  avatar: string;
  lastMessage: string;
  time: string;
  unread: boolean;
  type?: 'match' | 'project';
  projectTitle?: string;
  projectDesc?: string;
  projectTech?: string[];
};

export type ChatMessage = {
  id?: number;
  sender: 'me' | 'them';
  text: string;
  time: string;
  read?: boolean;
};
