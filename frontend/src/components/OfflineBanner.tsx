import React from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

/** Thin strip when the browser reports offline — no service worker required. */
export const OfflineBanner: React.FC = () => {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 inset-x-0 z-[200] px-3 py-2 text-center text-[12px] font-medium text-bg-base bg-pass border-b border-pass/40"
    >
      You’re offline — swipes, chat, and saves may fail until you’re back online.
    </div>
  );
};
