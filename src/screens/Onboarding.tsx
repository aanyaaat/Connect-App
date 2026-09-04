import { useState, useEffect } from 'react';
import { Button, Input } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { Heart, Sparkles, Copy, Check, ArrowRight, KeyRound, User } from 'lucide-react';

const AVATARS = ['💖', '🧸', '🌸', '✨', '🍓', '🐱', '🌙', '🦋', '🥑', '🐣'];

export function Onboarding({ onFinish }: { onFinish: () => void }) {
  const { startWithDisplayName, profile, user } = useAuth();
  const { createConnection, joinConnection, connection } = useAppData();
  const [step, setStep] = useState<'name' | 'pair' | 'waiting'>('name');
  const [name, setName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('💖');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // If connection gets accepted in real-time while on this screen, finish immediately!
  useEffect(() => {
    if (connection?.status === 'accepted') {
      onFinish();
    }
  }, [connection?.status, onFinish]);

  async function handleNameSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }
    setError(null);
    setLoading(true);
    const res = await startWithDisplayName(name.trim());
    setLoading(false);
    if (res.error) {
      setError(res.error);
    } else {
      setStep('pair');
    }
  }

  async function handleCreatePairing() {
    setError(null);
    setLoading(true);
    const res = await createConnection();
    setLoading(false);
    if (res.error) {
      setError(res.error);
    } else if (res.code) {
      setGeneratedCode(res.code);
      setStep('waiting');
    }
  }

  async function handleJoinPairing(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) {
      setError('Please enter the pairing code');
      return;
    }
    setError(null);
    setLoading(true);
    const res = await joinConnection(code);
    setLoading(false);
    if (res.error) {
      setError(res.error);
    } else {
      onFinish();
    }
  }

  function copyCode() {
    if (!generatedCode) return;
    navigator.clipboard?.writeText(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="app-shell px-6 py-8 flex flex-col justify-between">
      {/* Top Cute Branding */}
      <div className="text-center pt-2">
        <div className="mx-auto relative flex h-20 w-20 items-center justify-center rounded-3xl bg-accent-soft text-4xl shadow-lg shadow-rose-500/15 pulse-gentle">
          <span className="select-none">{selectedAvatar}</span>
          <div className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-white">
            <Heart className="h-3.5 w-3.5 fill-white" />
          </div>
        </div>
        <h1 className="mt-4 text-3xl font-serif text-fg">Aanya &amp; Me</h1>
        <p className="mt-1 text-xs text-muted font-medium">Your private, one-tap connection space ❤️</p>
      </div>

      {/* Step 1: Name & Avatar */}
      {step === 'name' && (
        <div className="fade-up my-auto flex flex-col gap-5">
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
              <User className="h-3.5 w-3.5 text-accent" />
              <span>What should we call you?</span>
            </div>
            <form onSubmit={handleNameSubmit} className="flex flex-col gap-4">
              <Input
                placeholder="Enter your name..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                className="text-base font-medium"
              />

              <div>
                <p className="mb-2 text-xs text-muted font-medium">Pick your avatar emoji:</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {AVATARS.map((av) => (
                    <button
                      type="button"
                      key={av}
                      onClick={() => setSelectedAvatar(av)}
                      className={`h-10 w-10 text-xl rounded-2xl flex items-center justify-center transition-all ${
                        selectedAvatar === av
                          ? 'bg-accent text-white scale-110 shadow-md shadow-accent/30'
                          : 'bg-bg-elev hover:bg-accent-soft/40'
                      }`}
                    >
                      {av}
                    </button>
                  ))}
                </div>
              </div>

              {error && <p className="text-xs text-danger font-medium text-center">{error}</p>}

              <Button type="submit" size="lg" loading={loading} className="w-full mt-2">
                <span>Continue</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* Step 2: Choose Pairing Mode */}
      {step === 'pair' && (
        <div className="fade-up my-auto flex flex-col gap-4">
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-1 text-xs font-semibold uppercase tracking-wider text-muted">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              <span>Start New Connection</span>
            </div>
            <p className="text-xs text-fg-soft mb-3">
              Generate a unique code to share with your partner.
            </p>
            <Button onClick={handleCreatePairing} loading={loading} className="w-full">
              Create Pairing Code
            </Button>
          </div>

          <div className="flex items-center gap-3 text-xs text-muted">
            <div className="h-px flex-1 bg-border" />
            <span className="font-semibold">OR</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="card p-5">
            <div className="flex items-center gap-2 mb-1 text-xs font-semibold uppercase tracking-wider text-muted">
              <KeyRound className="h-3.5 w-3.5 text-accent" />
              <span>Join Your Partner</span>
            </div>
            <p className="text-xs text-fg-soft mb-3">
              Enter the code your partner shared with you.
            </p>
            <form onSubmit={handleJoinPairing} className="flex flex-col gap-3">
              <Input
                placeholder="e.g. AANYA-7291"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="uppercase tracking-widest text-center font-serif text-lg"
              />
              {error && <p className="text-xs text-danger font-medium text-center">{error}</p>}
              <Button type="submit" variant="outline" loading={loading} className="w-full">
                Join Connection ❤️
              </Button>
            </form>
          </div>

          <button
            type="button"
            className="text-xs text-muted hover:text-fg text-center mt-1"
            onClick={() => onFinish()}
          >
            Skip for now &rarr;
          </button>
        </div>
      )}

      {/* Step 3: Waiting for partner with live code */}
      {step === 'waiting' && generatedCode && (
        <div className="fade-up my-auto flex flex-col gap-4">
          <div className="card p-6 text-center">
            <span className="text-3xl mb-2 block">💌</span>
            <h2 className="text-lg font-serif text-fg">Your Pairing Code</h2>
            <p className="text-xs text-muted mt-1">Share this 6-digit code with your partner:</p>

            <div className="my-4 rounded-2xl bg-accent-soft/50 border border-accent/20 p-4">
              <p className="font-serif text-3xl font-bold tracking-widest text-accent">
                {generatedCode}
              </p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={copyCode} className="flex-1">
                {copied ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-500" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    <span>Copy Code</span>
                  </>
                )}
              </Button>
              <Button onClick={onFinish} className="flex-1">
                Enter App
              </Button>
            </div>

            <div className="mt-5 flex items-center justify-center gap-2 text-xs text-muted">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Listening live for partner to connect...</span>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Footer */}
      <p className="text-center text-[11px] text-muted">
        Private, encrypted &amp; free forever for you two ❤️
      </p>
    </div>
  );
}
