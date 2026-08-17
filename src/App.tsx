import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { AppDataProvider, useAppData } from '@/context/AppDataContext';
import { Spinner } from '@/components/ui';
import { Onboarding } from '@/screens/Onboarding';
import { Home } from '@/screens/Home';
import { Places } from '@/screens/Places';
import { History } from '@/screens/History';
import { Settings } from '@/screens/Settings';

type Screen = 'home' | 'places' | 'history' | 'settings';

function Router() {
  const { user, loading } = useAuth();
  const { connection } = useAppData();
  const [screen, setScreen] = useState<Screen>('home');
  const [onboarded, setOnboarded] = useState(() => localStorage.getItem('aanya_onboarded') === '1');

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8 text-accent" />
      </div>
    );
  }

  if (!user) {
    return <Onboarding onFinish={() => {}} />;
  }

  if (!onboarded || (connection && connection.status !== 'accepted' && !localStorage.getItem('aanya_skipped_pair'))) {
    return (
      <Onboarding
        onFinish={() => {
          localStorage.setItem('aanya_onboarded', '1');
          localStorage.setItem('aanya_skipped_pair', '1');
          setOnboarded(true);
        }}
      />
    );
  }

  if (screen === 'places') return <Places onBack={() => setScreen('home')} />;
  if (screen === 'history') return <History onBack={() => setScreen('home')} />;
  if (screen === 'settings') return <Settings onBack={() => setScreen('home')} />;
  return <Home onNavigate={(s) => setScreen(s)} />;
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <AppDataProvider>
          <Router />
        </AppDataProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
