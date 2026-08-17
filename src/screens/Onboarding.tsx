import { useState } from 'react';
import { Button, Input } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { isSupabaseConfigured } from '@/lib/supabase';

type Step = 'welcome' | 'signup' | 'signin' | 'name' | 'pair' | 'permissions' | 'done';

export function Onboarding({ onFinish }: { onFinish: () => void }) {
  const { signUp, signIn, updateProfile } = useAuth();
  const { createConnection, joinConnection, connection } = useAppData();
  const [step, setStep] = useState<Step>('welcome');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);

  async function handleAuth(mode: 'signup' | 'signin') {
    setError(null);
    setLoading(true);
    const res = mode === 'signup' ? await signUp(email, password, name) : await signIn(email, password);
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    if (mode === 'signup' && name) {
      await updateProfile({ display_name: name });
    }
    setStep('pair');
  }

  async function handleCreate() {
    setError(null);
    setLoading(true);
    const res = await createConnection();
    setLoading(false);
    if (res.error) setError(res.error);
    else if (res.code) {
      setGeneratedCode(res.code);
    }
  }

  async function handleJoin() {
    setError(null);
    setLoading(true);
    const res = await joinConnection(code);
    setLoading(false);
    if (res.error) setError(res.error);
    else setStep('permissions');
  }

  if (step === 'welcome') {
    return (
      <Shell>
        <Hero />
        <div className="mt-10 flex flex-col gap-3">
          <Button size="lg" onClick={() => setStep('signup')}>Get Started</Button>
          <Button variant="ghost" size="lg" onClick={() => setStep('signin')}>I already have an account</Button>
        </div>
      </Shell>
    );
  }

  if (step === 'signup' || step === 'signin') {
    const isSignup = step === 'signup';
    return (
      <Shell>
        <div className="mb-6">
          <h1 className="text-2xl">{isSignup ? "Let's set you up" : 'Welcome back'}</h1>
          <p className="mt-1 text-sm text-fg-soft">
            {isSignup ? 'Create your private account for Aanya & Me.' : 'Sign in to your account.'}
          </p>
          {!isSupabaseConfigured && (
            <div className="mt-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
              <span className="font-semibold">⚡ Supabase setup needed:</span> Please add your <code className="rounded bg-black/10 px-1 py-0.5">VITE_SUPABASE_URL</code> and <code className="rounded bg-black/10 px-1 py-0.5">VITE_SUPABASE_ANON_KEY</code> in <code className="rounded bg-black/10 px-1 py-0.5">.env</code> and run <code className="rounded bg-black/10 px-1 py-0.5">supabase/schema.sql</code>.
            </div>
          )}
        </div>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            handleAuth(isSignup ? 'signup' : 'signin');
          }}
        >
          {isSignup && (
            <Input
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          )}
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            required
            minLength={6}
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" size="lg" loading={loading}>
            {isSignup ? 'Create account' : 'Sign in'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setStep(isSignup ? 'signin' : 'signup')}
          >
            {isSignup ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </Button>
        </form>
      </Shell>
    );
  }

  if (step === 'pair') {
    return (
      <Shell>
        <div className="mb-6">
          <h1 className="text-2xl">Connect with Aanya</h1>
          <p className="mt-1 text-sm text-fg-soft">
            Create a pairing code and share it with Aanya, or enter the code she gave you.
          </p>
        </div>

        {generatedCode ? (
          <div className="card p-5 text-center">
            <p className="text-sm text-fg-soft">Your pairing code</p>
            <p className="my-2 font-serif text-4xl tracking-wide text-accent">{generatedCode}</p>
            <p className="text-xs text-muted">Share this with Aanya. She'll enter it to connect.</p>
            <Button className="mt-4 w-full" onClick={() => setStep('permissions')}>
              Continue
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="card p-4">
              <p className="text-sm font-medium">Create a new connection</p>
              <p className="mt-1 text-xs text-muted">Get a code to share with Aanya.</p>
              <Button className="mt-3 w-full" onClick={handleCreate} loading={loading}>
                Create pairing code
              </Button>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted">
              <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
            </div>
            <div className="card p-4">
              <p className="text-sm font-medium">Join with a code</p>
              <p className="mt-1 text-xs text-muted">Enter the code Aanya gave you.</p>
              <Input
                className="mt-3 uppercase"
                placeholder="AANYA-1234"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              {error && <p className="mt-2 text-sm text-danger">{error}</p>}
              <Button className="mt-3 w-full" variant="outline" onClick={handleJoin} loading={loading}>
                Join connection
              </Button>
            </div>
            {connection?.status === 'accepted' && (
              <Button variant="ghost" onClick={() => setStep('permissions')}>
                Skip — already connected
              </Button>
            )}
          </div>
        )}
      </Shell>
    );
  }

  if (step === 'permissions') {
    return (
      <Shell>
        <div className="mb-6">
          <h1 className="text-2xl">Make the app useful</h1>
          <p className="mt-1 text-sm text-fg-soft">Enable these so Aanya gets your updates. You can change them later.</p>
        </div>
        <div className="flex flex-col gap-3">
          <PermissionCard
            icon="🔔"
            title="Notifications"
            desc="So Aanya can receive your quick messages."
            cta="Enable"
            onDone={() => {}}
          />
          <PermissionCard
            icon="📍"
            title="Location"
            desc="So the app can detect when you reach places you've chosen."
            cta="Enable"
            onDone={() => {}}
          />
          <div className="card p-4">
            <p className="text-sm font-medium">Automatic arrival detection</p>
            <p className="mt-1 text-xs text-muted">You can set this up later in Places.</p>
            <Button variant="ghost" className="mt-3 w-full" onClick={() => setStep('done')}>
              Set up later
            </Button>
          </div>
          <Button size="lg" onClick={() => setStep('done')}>Continue</Button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <Hero />
      <div className="mt-8 text-center">
        <p className="text-sm text-fg-soft">You're all set.</p>
        <Button className="mt-4 w-full" size="lg" onClick={onFinish}>
          Open Aanya & Me
        </Button>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell px-5 py-8">
      <div className="fade-up flex flex-1 flex-col justify-center">{children}</div>
    </div>
  );
}

function Hero() {
  return (
    <div className="text-center">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-4xl bg-accent-soft text-4xl">
        ❤️
      </div>
      <h1 className="mt-5 text-3xl">Aanya &amp; Me</h1>
      <p className="mt-2 text-sm text-fg-soft">Just one tap away. ❤️</p>
    </div>
  );
}

function PermissionCard({
  icon,
  title,
  desc,
  cta,
  onDone,
}: {
  icon: string;
  title: string;
  desc: string;
  cta: string;
  onDone: () => void;
}) {
  const [state, setState] = useState<'idle' | 'granted' | 'denied'>('idle');
  return (
    <div className="card p-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl">{icon}</span>
        <div className="flex-1">
          <p className="text-sm font-medium">{title}</p>
          <p className="mt-0.5 text-xs text-muted">{desc}</p>
        </div>
      </div>
      <Button
        variant={state === 'granted' ? 'ghost' : 'outline'}
        className="mt-3 w-full"
        disabled={state !== 'idle'}
        onClick={() => {
          if (title === 'Notifications' && 'Notification' in window) {
            Notification.requestPermission().then((p) => {
              setState(p === 'granted' ? 'granted' : 'denied');
              onDone();
            });
          } else {
            setState('granted');
            onDone();
          }
        }}
      >
        {state === 'granted' ? 'Enabled' : state === 'denied' ? 'Denied — enable in settings' : cta}
      </Button>
    </div>
  );
}
