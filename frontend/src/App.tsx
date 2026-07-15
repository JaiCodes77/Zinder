import { useState } from 'react';
import { AuthPage } from './components/AuthPage';
import { DiscoveryPage } from './components/DiscoveryPage';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  return (
    <main className="w-full min-h-screen bg-ink-950">
      {isAuthenticated ? (
        <DiscoveryPage onLogout={() => setIsAuthenticated(false)} />
      ) : (
        <AuthPage onLoginSuccess={() => setIsAuthenticated(true)} />
      )}
    </main>
  );
}

export default App;
