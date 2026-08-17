import { useState } from 'react';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Button, IconButton, Modal, Toggle, SectionLabel } from '@/components/ui';
import { DEFAULT_CUSTOM_MESSAGES } from '@/lib/quickActions';
import type { AccentKey, QuickMessage } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';

type Section = 'profile' | 'connection' | 'messages' | 'appearance' | 'location' | 'storage' | 'privacy' | 'about';

export function Settings({ onBack }: { onBack: () => void }) {
  const [section, setSection] = useState<Section | null>(null);

  return (
    <div className="app-shell px-5 py-6">
      <header className="flex items-center gap-2">
        <IconButton aria-label="Back" onClick={onBack}>←</IconButton>
        <h1 className="text-xl">Settings</h1>
      </header>

      <div className="mt-4 flex flex-col gap-2">
        <SettingsRow icon="👤" title="My Profile" subtitle="Name and appearance" onClick={() => setSection('profile')} />
        <SettingsRow icon="❤️" title="Connection" subtitle="Pairing and partner" onClick={() => setSection('connection')} />
        <SettingsRow icon="💬" title="Quick Actions" subtitle="Custom messages" onClick={() => setSection('messages')} />
        <SettingsRow icon="🎨" title="Appearance" subtitle="Theme and accent" onClick={() => setSection('appearance')} />
        <SettingsRow icon="📍" title="Location" subtitle="Sharing and privacy" onClick={() => setSection('location')} />
        <SettingsRow icon="💾" title="Storage & Auto-Cleanup" subtitle="500MB storage quota & memory retention" onClick={() => setSection('storage')} />
        <SettingsRow icon="🔐" title="Privacy & Security" subtitle="Data and disconnect" onClick={() => setSection('privacy')} />
        <SettingsRow icon="ℹ️" title="About" subtitle="Aanya & Me" onClick={() => setSection('about')} />
      </div>

      {section && <SettingsModal section={section} onClose={() => setSection(null)} />}
    </div>
  );
}

function SettingsRow({ icon, title, subtitle, onClick }: { icon: string; title: string; subtitle: string; onClick: () => void }) {
  return (
    <button className="card flex items-center gap-3 p-4 text-left fade-up" onClick={onClick}>
      <span className="text-xl">{icon}</span>
      <div className="flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted">{subtitle}</p>
      </div>
      <span className="text-muted">›</span>
    </button>
  );
}

function SettingsModal({ section, onClose }: { section: Section; onClose: () => void }) {
  const titles: Record<Section, string> = {
    profile: 'My Profile',
    connection: 'Connection',
    messages: 'Quick Actions',
    appearance: 'Appearance',
    location: 'Location',
    storage: 'Storage & Auto-Cleanup',
    privacy: 'Privacy & Security',
    about: 'About',
  };
  return (
    <Modal open onClose={onClose} title={titles[section]}>
      {section === 'profile' && <ProfileSection />}
      {section === 'connection' && <ConnectionSection />}
      {section === 'messages' && <MessagesSection />}
      {section === 'appearance' && <AppearanceSection />}
      {section === 'location' && <LocationSection />}
      {section === 'storage' && <StorageSection />}
      {section === 'privacy' && <PrivacySection />}
      {section === 'about' && <AboutSection />}
    </Modal>
  );
}

function ProfileSection() {
  const { profile, updateProfile, signOut } = useAuth();
  const [name, setName] = useState(profile?.display_name ?? '');
  const [saving, setSaving] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <label className="text-xs font-medium text-fg-soft">Display name</label>
      <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      <Button
        loading={saving}
        onClick={async () => {
          setSaving(true);
          await updateProfile({ display_name: name || 'You' });
          setSaving(false);
        }}
      >
        Save name
      </Button>
      <Button variant="ghost" className="text-danger" onClick={signOut}>
        Sign out
      </Button>
    </div>
  );
}

function ConnectionSection() {
  const { connection, partnerName, createConnection, joinConnection, disconnect } = useAppData();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <div className="card p-4">
        <p className="text-sm font-medium">Status</p>
        <p className="mt-1 text-xs text-muted">
          {connection?.status === 'accepted'
            ? `Connected with ${partnerName}.`
            : connection?.status === 'pending'
              ? 'Waiting for partner to join.'
              : 'Not connected.'}
        </p>
        {connection?.pairing_code && (
          <p className="mt-2 font-serif text-2xl text-accent">{connection.pairing_code}</p>
        )}
      </div>

      {connection?.status !== 'accepted' && (
        <>
          <Button
            loading={busy}
            onClick={async () => {
              setBusy(true);
              await createConnection();
              setBusy(false);
            }}
          >
            Create pairing code
          </Button>
          <div className="flex gap-2">
            <input className="input flex-1 uppercase" placeholder="AANYA-1234" value={code} onChange={(e) => setCode(e.target.value)} />
            <Button
              variant="outline"
              loading={busy}
              onClick={async () => {
                setBusy(true);
                const r = await joinConnection(code);
                setBusy(false);
                if (r.error) setError(r.error);
              }}
            >
              Join
            </Button>
          </div>
        </>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      {connection?.status === 'accepted' && (
        <Button
          variant="ghost"
          className="text-danger"
          onClick={async () => {
            if (confirm('Disconnect from Aanya? You can reconnect later with a new code.')) {
              await disconnect();
            }
          }}
        >
          Disconnect Aanya
        </Button>
      )}
    </div>
  );
}

function MessagesSection() {
  const { quickMessages, addQuickMessage, updateQuickMessage, deleteQuickMessage } = useAppData();
  const [emoji, setEmoji] = useState('💬');
  const [label, setLabel] = useState('');
  const [message, setMessage] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!label.trim() || !message.trim()) {
      setError('Add both a label and a message.');
      return;
    }
    setError(null);
    if (editingId) {
      await updateQuickMessage(editingId, { emoji, label: label.trim(), message: message.trim() });
      setEditingId(null);
    } else {
      await addQuickMessage({ emoji, label: label.trim(), message: message.trim(), pinned: false });
    }
    setLabel('');
    setMessage('');
    setEmoji('💬');
  }

  async function seedDefaults() {
    for (const m of DEFAULT_CUSTOM_MESSAGES) {
      await addQuickMessage({ emoji: m.emoji, label: m.label, message: m.message, pinned: false });
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {quickMessages.length === 0 && (
        <Button variant="outline" onClick={seedDefaults}>Add suggested messages</Button>
      )}

      <div className="card p-3">
        <SectionLabel>{editingId ? 'Edit message' : 'New message'}</SectionLabel>
        <div className="flex gap-2">
          <input className="input w-16 text-center text-2xl" value={emoji} onChange={(e) => setEmoji(e.target.value.slice(0, 2))} />
          <input className="input flex-1" placeholder="Label" value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <input className="input mt-2" placeholder="Message Aanya will see" value={message} onChange={(e) => setMessage(e.target.value)} />
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        <div className="mt-2 flex gap-2">
          <Button size="sm" onClick={save}>{editingId ? 'Update' : 'Add'}</Button>
          {editingId && (
            <Button size="sm" variant="ghost" onClick={() => { setEditingId(null); setLabel(''); setMessage(''); setEmoji('💬'); }}>
              Cancel
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {quickMessages.map((m) => (
          <div key={m.id} className="card flex items-center gap-3 p-3">
            <span className="text-xl">{m.emoji}</span>
            <div className="flex-1">
              <p className="text-sm font-medium">{m.label}</p>
              <p className="text-xs text-muted">{m.message}</p>
            </div>
            <button
              className="text-xs text-accent"
              onClick={async () => await updateQuickMessage(m.id, { pinned: !m.pinned })}
            >
              {m.pinned ? 'Unpin' : 'Pin'}
            </button>
            <button className="text-xs text-fg-soft" onClick={() => { setEditingId(m.id); setEmoji(m.emoji); setLabel(m.label); setMessage(m.message); }}>
              Edit
            </button>
            <button className="text-xs text-danger" onClick={async () => await deleteQuickMessage(m.id)}>
              Del
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function AppearanceSection() {
  const { mode, accent, setMode, setAccent } = useTheme();
  const accents: AccentKey[] = ['rose', 'burgundy', 'lavender', 'sage', 'amber', 'ocean'];
  const swatch: Record<AccentKey, string> = {
    rose: '#9f1239',
    burgundy: '#7f1d1d',
    lavender: '#6d2864',
    sage: '#3f6212',
    amber: '#b45309',
    ocean: '#0c4a6e',
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <SectionLabel>Theme</SectionLabel>
        <div className="flex gap-2">
          {(['light', 'dark', 'system'] as const).map((m) => (
            <button
              key={m}
              className={`flex-1 rounded-full py-2 text-sm capitalize ${mode === m ? 'bg-accent text-accent-fg' : 'bg-bg-elev text-fg-soft'}`}
              onClick={() => setMode(m)}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
      <div>
        <SectionLabel>Accent color</SectionLabel>
        <div className="flex flex-wrap gap-3">
          {accents.map((a) => (
            <button
              key={a}
              className={`h-10 w-10 rounded-full border-2 ${accent === a ? 'border-fg' : 'border-transparent'}`}
              style={{ background: swatch[a] }}
              onClick={() => setAccent(a)}
              aria-label={a}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function LocationSection() {
  const { profile, updateProfile } = useAuth();
  const modes: { key: 'off' | 'arrival' | 'sos' | 'live'; label: string; desc: string }[] = [
    { key: 'off', label: 'Off', desc: 'No automatic location sharing.' },
    { key: 'arrival', label: 'Arrival only', desc: 'Share when arriving at saved places.' },
    { key: 'sos', label: 'SOS only', desc: 'Share location only during SOS.' },
    { key: 'live', label: 'Live sharing', desc: 'Always share with Aanya.' },
  ];
  const current = profile?.location_mode ?? 'arrival';

  return (
    <div className="flex flex-col gap-2">
      <SectionLabel>Location sharing</SectionLabel>
      {modes.map((m) => (
        <button
          key={m.key}
          className={`card p-4 text-left ${current === m.key ? 'border-accent' : ''}`}
          onClick={() => updateProfile({ location_mode: m.key })}
        >
          <p className="text-sm font-medium">{m.label}</p>
          <p className="text-xs text-muted">{m.desc}</p>
        </button>
      ))}
      <p className="mt-2 text-xs text-muted">
        Location is only ever shared with your connected partner. Nothing is ever made public.
      </p>
    </div>
  );
}

function StorageSection() {
  const { storageStats, retentionDays, setRetentionDays, cleanupOldEvents } = useAppData();
  const [cleaning, setCleaning] = useState(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);

  const retentionOptions = [
    { value: 30, label: '30 Days', desc: 'Recommended: Keeps DB slim & fast' },
    { value: 60, label: '60 Days', desc: 'Auto-delete past 2 months' },
    { value: 90, label: '90 Days', desc: 'Auto-delete past 3 months' },
    { value: 0, label: 'Never', desc: 'Keep all messages forever' },
  ];

  async function handleManualClean() {
    if (retentionDays === 0) {
      setResultMsg('Auto-cleanup is set to Never. Choose 30/60/90 days to clean older messages.');
      return;
    }
    setCleaning(true);
    setResultMsg(null);
    const res = await cleanupOldEvents();
    setCleaning(false);
    if (res.error) {
      setResultMsg(`Error: ${res.error}`);
    } else {
      setResultMsg(
        res.count > 0
          ? `✨ Cleaned ${res.count} older messages! Starred ⭐ memories were preserved.`
          : '✨ Storage is already optimized! No old messages to delete.'
      );
    }
  }

  return (
    <div className="flex flex-col gap-4 text-sm text-fg-soft">
      {/* Visual Storage Meter */}
      <div className="card p-4">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-fg">Supabase Database Storage</span>
          <span className="text-muted font-medium">500 MB Free Tier</span>
        </div>

        {/* Progress Bar */}
        <div className="mt-3 h-3.5 w-full overflow-hidden rounded-full bg-bg-elev p-0.5 border border-border/40">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-accent to-rose-500 transition-all duration-500"
            style={{ width: `${Math.max(2, Math.min(100, storageStats.quotaPercent * 10))}%` }}
          />
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-xl bg-bg-elev p-2">
            <p className="font-semibold text-fg">{storageStats.eventCount}</p>
            <p className="text-[10px] text-muted">Total Events</p>
          </div>
          <div className="rounded-xl bg-bg-elev p-2">
            <p className="font-semibold text-amber-500">⭐ {storageStats.keptCount}</p>
            <p className="text-[10px] text-muted">Starred Memories</p>
          </div>
          <div className="rounded-xl bg-bg-elev p-2">
            <p className="font-semibold text-fg">~{storageStats.estimatedKB} KB</p>
            <p className="text-[10px] text-muted">&lt; 0.1% Quota</p>
          </div>
        </div>
      </div>

      {/* Auto Retention Rule */}
      <div>
        <SectionLabel>Auto-cleanup old messages</SectionLabel>
        <p className="mb-2 text-xs text-muted">
          Older check-ins and messages will be cleaned up automatically to keep your app lightning fast.
        </p>
        <div className="flex flex-col gap-2">
          {retentionOptions.map((opt) => (
            <button
              key={opt.value}
              className={`card p-3 text-left transition-all ${retentionDays === opt.value ? 'border-accent bg-accent-soft/30' : ''}`}
              onClick={() => {
                setRetentionDays(opt.value);
                setResultMsg(null);
              }}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-fg">{opt.label}</p>
                {retentionDays === opt.value && <span className="text-xs text-accent font-semibold">Active</span>}
              </div>
              <p className="text-xs text-muted">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Starred memory note */}
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-900 dark:text-amber-200">
        <p className="font-semibold">💡 Tip: Star your favorite memories!</p>
        <p className="mt-0.5 text-muted">
          Any message you star (⭐) in History or on Home will <strong>never</strong> be deleted by auto-cleanup.
        </p>
      </div>

      {/* Manual Clean Button */}
      <div>
        <Button
          variant="outline"
          className="w-full"
          loading={cleaning}
          onClick={handleManualClean}
        >
          🧹 Clean old events now
        </Button>
        {resultMsg && (
          <p className="mt-2 text-center text-xs font-medium text-accent">
            {resultMsg}
          </p>
        )}
      </div>
    </div>
  );
}

function PrivacySection() {
  const { user, signOut } = useAuth();
  const { connection } = useAppData();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteAccount() {
    if (!confirm('This permanently deletes your profile, places, and messages. This cannot be undone.')) return;
    setBusy(true);
    setError(null);
    if (connection) {
      await supabase.from('connections').delete().eq('id', connection.id);
    }
    await supabase.from('places').delete().eq('owner_id', user!.id);
    await supabase.from('quick_messages').delete().eq('owner_id', user!.id);
    if (connection) {
      await supabase.from('events').delete().eq('connection_id', connection.id);
    }
    await supabase.from('profiles').delete().eq('id', user!.id);
    await signOut();
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-3 text-sm text-fg-soft">
      <div className="card p-4">
        <p className="font-medium text-fg">What we store</p>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-xs">
          <li>Your name and email (for sign-in).</li>
          <li>Your saved places and custom messages.</li>
          <li>Events you send (messages, check-ins, SOS).</li>
          <li>Location only when you choose to attach it.</li>
        </ul>
      </div>
      <div className="card p-4">
        <p className="font-medium text-fg">Privacy promises</p>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-xs">
          <li>Only your connected partner can see your shared data.</li>
          <li>No public profiles, no followers, no ads.</li>
          <li>No hidden tracking. Every location share is explicit.</li>
        </ul>
      </div>
      <Button variant="ghost" className="text-danger" loading={busy} onClick={deleteAccount}>
        Delete my account
      </Button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}

function AboutSection() {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-4xl bg-accent-soft text-3xl">❤️</div>
      <h2 className="text-lg">Aanya &amp; Me</h2>
      <p className="text-sm text-fg-soft">Just one tap away. ❤️</p>
      <p className="mt-2 text-xs text-muted">A private connection button for two.</p>
    </div>
  );
}
