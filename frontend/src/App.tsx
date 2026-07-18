import { useCallback, useEffect, useState } from 'react';
import { AuthPage } from './components/AuthPage';
import { DiscoveryPage } from './components/DiscoveryPage';
import { OfflineBanner } from './components/OfflineBanner';
import { getMe, logout } from './api/auth';
import { setUnauthorizedHandler } from './api/client';

type AuthStatus = 'loading' | 'authenticated' | 'guest';

function App() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');

  useEffect(() => {
    setUnauthorizedHandler(() => setAuthStatus('guest'));
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await getMe();
        if (!cancelled) setAuthStatus('authenticated');
      } catch {
        if (!cancelled) setAuthStatus('guest');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLoginSuccess = useCallback(() => {
    setAuthStatus('authenticated');
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
    } catch {
      // Still clear local auth if the network call fails
    }
    setAuthStatus('guest');
  }, []);

  if (authStatus === 'loading') {
    return (
      <>
        <OfflineBanner />
        <main className="w-full min-h-screen bg-bg-base flex items-center justify-center">
          <p className="mono-label text-fg-subtle">Restoring session…</p>
        </main>
      </>
    );
  }

  // Authenticated shell owns its own 100dvh grid — do not wrap it in min-h-screen
  // or the document grows with content and the activity bar scrolls away.
  if (authStatus === 'authenticated') {
    return (
      <>
        <OfflineBanner />
        <DiscoveryPage onLogout={handleLogout} />
      </>
    );
  }

  return (
    <>
      <OfflineBanner />
      <main className="w-full min-h-screen bg-bg-base">
        <AuthPage onLoginSuccess={handleLoginSuccess} />
      </main>
    </>
  );
}

export default App;
