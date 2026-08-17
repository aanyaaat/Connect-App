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
import { Heart, Clock, MapPin, Settings2 } from 'lucide-react';
import { App as CapApp } from '@capacitor/app';

type Screen = 'home' | 'places' | 'history' | 'settings';

function Router() {
  const { user, loading } = useAuth();
  const { connection } = useAppData();
  const [screen, setScreen] = useState<Screen>('home');
  const [onboarded, setOnboarded] = useState(() => localStorage.getItem('aanya_onboarded') === '1');

  // Android Hardware Back Button Handler
  useEffect(() => {
    let backListener: any;
    try {
      backListener = CapApp.addListener('backButton', () => {
        setScreen((current) => {
          if (current !== 'home') {
            return 'home';
          }
          // If already on home, minimize/exit app
          CapApp.exitApp();
          return 'home';
        });
      });
    } catch (e) {
      // Running on web/PWA where CapApp is a noop
    }

    return () => {
      if (backListener && typeof backListener.remove === 'function') {
        backListener.remove();
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-accent-soft text-3xl pulse-gentle shadow-lg shadow-rose-500/10">
            ❤️
          </div>
          <p className="font-serif text-sm text-muted">Aanya &amp; Me</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Onboarding onFinish={() => setOnboarded(true)} />;
  }

  if (!onboarded && (!connection || connection.status !== 'accepted') && !localStorage.getItem('aanya_skipped_pair')) {
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

  const navItems: { id: Screen; label: string; icon: any }[] = [
    { id: 'home', label: 'Connect', icon: Heart },
    { id: 'history', label: 'Moments', icon: Clock },
    { id: 'places', label: 'Places', icon: MapPin },
    { id: 'settings', label: 'Settings', icon: Settings2 },
  ];

  return (
    <div className="relative min-h-screen bg-bg">
      {/* Screen Render */}
      <main>
        {screen === 'home' && <Home onNavigate={(s) => setScreen(s)} />}
        {screen === 'history' && <History onBack={() => setScreen('home')} />}
        {screen === 'places' && <Places onBack={() => setScreen('home')} />}
        {screen === 'settings' && <Settings onBack={() => setScreen('home')} />}
      </main>

      {/* Floating Bottom Navigation Bar */}
      <nav className="bottom-nav flex items-center justify-around py-2 px-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = screen === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setScreen(item.id)}
              className={`relative flex flex-col items-center justify-center py-1.5 px-4 rounded-2xl transition-all duration-200 ${
                isActive
                  ? 'text-accent font-semibold scale-105'
                  : 'text-muted hover:text-fg-soft'
              }`}
            >
              {isActive && (
                <span className="absolute inset-0 rounded-2xl bg-accent-soft/70 -z-10 animate-fade-in" />
              )}
              <Icon className={`h-5 w-5 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
              <span className="text-[10px] mt-0.5 tracking-tight">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
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
