import React, { useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import type { ThreadComment } from './types';
import { formatWhen, parseCommentBody } from './helpers';

type CommentThreadProps = {
  comments: ThreadComment[];
  onPost?: (body: string) => Promise<void> | void;
  posting?: boolean;
  error?: string | null;
};

const CommentBody: React.FC<{ body: string }> = ({ body }) => {
  const parts = parseCommentBody(body);
  return (
    <div className="text-[13px] text-fg-muted leading-relaxed whitespace-pre-wrap">
      {parts.map((p, i) =>
        p.type === 'code' ? (
          <code
            key={i}
            className={`font-mono text-[12px] text-fg ${
              p.value.includes('\n')
                ? 'block my-2 px-3 py-2 rounded-[10px] bg-white/[0.06] border border-white/10 overflow-x-auto'
                : 'px-1.5 py-0.5 rounded-md bg-white/[0.06] border border-white/10'
            }`}
          >
            {p.value}
          </code>
        ) : (
          <span key={i}>{p.value}</span>
        )
      )}
    </div>
  );
};

/** Lightweight GitHub-issue style discussion. */
export const CommentThread: React.FC<CommentThreadProps> = ({
  comments,
  onPost,
  posting = false,
  error = null,
}) => {
  const [draft, setDraft] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body || !onPost || posting) return;
    await onPost(body);
    setDraft('');
  };

  return (
    <div className="space-y-0">
      <p className="kicker mb-3">Discussion</p>
      <ul className="space-y-3">
        {comments.length === 0 && (
          <li className="glass rounded-[14px] p-4 text-[13px] text-fg-subtle">
            No comments yet. Start the thread.
          </li>
        )}
        {comments.map((c) => (
          <li key={c.id} className="glass rounded-[14px] p-4">
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="w-7 h-7 rounded-full bg-ink-750 border border-white/12 flex items-center justify-center text-[10px] font-semibold text-fg-muted flex-shrink-0">
                {c.authorInitials}
              </div>
              <div className="min-w-0 flex-1 flex items-baseline gap-2 flex-wrap">
                <span className="text-[13px] font-medium text-fg truncate">{c.authorName}</span>
                {c.isRequester && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-accent-merge/10 text-accent-merge border border-accent-merge/25">
                    Author
                  </span>
                )}
                <span className="mono-label">{formatWhen(c.timestamp)}</span>
              </div>
            </div>
            <CommentBody body={c.body} />
          </li>
        ))}
      </ul>

      {onPost && (
        <form onSubmit={submit} className="mt-4 glass rounded-[14px] p-3">
          {error && <p className="text-[12px] text-pass mb-2">{error}</p>}
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            placeholder="Leave a comment…"
            disabled={posting}
            className="field w-full px-3 py-2 text-[13px] text-fg placeholder-fg-subtle resize-y min-h-[72px] focus:outline-none"
          />
          <div className="flex justify-end mt-2">
            <button
              type="submit"
              disabled={posting || !draft.trim()}
              className="btn-primary flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[12px] disabled:opacity-50"
            >
              {posting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Comment
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
