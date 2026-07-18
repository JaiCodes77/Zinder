import { useState } from 'react';
import { AuthPage } from './components/AuthPage';
import { DiscoveryPage } from './components/DiscoveryPage';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  // Authenticated shell owns its own 100dvh grid — do not wrap it in min-h-screen
  // or the document grows with content and the activity bar scrolls away.
  if (isAuthenticated) {
    return <DiscoveryPage onLogout={() => setIsAuthenticated(false)} />;
  }

  return (
    <main className="w-full min-h-screen bg-bg-base">
      <AuthPage onLoginSuccess={() => setIsAuthenticated(true)} />
    </main>
  );
}

export default App;
