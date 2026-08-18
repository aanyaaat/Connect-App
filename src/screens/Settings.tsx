import { useState } from 'react';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Button, Modal, Toggle, SectionLabel } from '@/components/ui';
import { DEFAULT_CUSTOM_MESSAGES } from '@/lib/quickActions';
import type { AccentKey, QuickMessage } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import {
  User,
  HeartHandshake,
  Sparkles,
  Palette,
  MapPin,
  HardDrive,
  ShieldCheck,
  Info,
  ArrowLeft,
  ChevronRight,
  LogOut,
  Copy,
  Check,
  Trash2,
  Plus,
  Bell,
} from 'lucide-react';
import { requestNotifPermission, notifPermission, showLocalNotification, notifSupported } from '@/lib/notifications';

type Section = 'profile' | 'connection' | 'messages' | 'notifications' | 'appearance' | 'location' | 'storage' | 'privacy' | 'about';

export function Settings({ onBack }: { onBack: () => void }) {
  const [section, setSection] = useState<Section | null>(null);

  const rows: { key: Section; icon: any; title: string; subtitle: string }[] = [
    { key: 'profile', icon: User, title: 'My Profile', subtitle: 'Name and avatar settings' },
    { key: 'connection', icon: HeartHandshake, title: 'Partner Connection', subtitle: 'Pairing code and link status' },
    { key: 'notifications', icon: Bell, title: 'Notifications & Lock Screen', subtitle: 'Push alerts & 1-tap lockscreen actions' },
    { key: 'messages', icon: Sparkles, title: 'Quick Messages', subtitle: 'Custom tiles and reaction shortcuts' },
    { key: 'appearance', icon: Palette, title: 'Appearance & Themes', subtitle: '6 aesthetic palettes & dark mode' },
    { key: 'location', icon: MapPin, title: 'Location Sharing', subtitle: 'Arrival alerts & privacy rules' },
    { key: 'storage', icon: HardDrive, title: 'Storage & Auto-Cleanup', subtitle: '500MB quota meter & memory retention' },
    { key: 'privacy', icon: ShieldCheck, title: 'Privacy & Security', subtitle: 'Zero ads, encrypted private space' },
    { key: 'about', icon: Info, title: 'About Aanya & Me', subtitle: 'Version & romantic notes' },
  ];

  return (
    <div className="app-shell px-5 pt-8 pb-44 flex flex-col gap-4">
      <header className="flex items-center gap-3 pt-2">
        <button
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-2xl bg-card border border-border/80 text-fg shadow-sm active:scale-95 transition"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl text-fg font-serif">Settings</h1>
          <p className="text-xs text-muted">Preferences &amp; customisation</p>
        </div>
      </header>

      <div className="flex flex-col gap-2.5 pb-6">
        {rows.map((r) => {
          const Icon = r.icon;
          return (
            <button
              key={r.key}
              className="card flex items-center gap-3.5 p-4 text-left fade-up hover:border-accent/40 active:scale-[0.98] transition"
              onClick={() => setSection(r.key)}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent">
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-fg">{r.title}</p>
                <p className="text-xs text-muted truncate">{r.subtitle}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted shrink-0" />
            </button>
          );
        })}
      </div>

      {/* Guaranteed Bottom Scroll Spacer so bottom nav never covers any button on mobile */}
      <div className="h-28 shrink-0 w-full md:hidden" aria-hidden="true" />

      {section && <SettingsModal section={section} onClose={() => setSection(null)} />}
    </div>
  );
}

function SettingsModal({ section, onClose }: { section: Section; onClose: () => void }) {
  const titles: Record<Section, string> = {
    profile: 'My Profile',
    connection: 'Partner Connection',
    notifications: 'Notifications & Lock Screen',
    messages: 'Quick Messages',
    appearance: 'Appearance & Themes',
    location: 'Location Sharing',
    storage: 'Storage & Auto-Cleanup',
    privacy: 'Privacy & Security',
    about: 'About Aanya & Me',
  };
  return (
    <Modal open onClose={onClose} title={titles[section]}>
      {section === 'profile' && <ProfileSection />}
      {section === 'connection' && <ConnectionSection />}
      {section === 'notifications' && <NotificationsSection />}
      {section === 'messages' && <MessagesSection />}
      {section === 'appearance' && <AppearanceSection />}
      {section === 'location' && <LocationSection />}
      {section === 'storage' && <StorageSection />}
      {section === 'privacy' && <PrivacySection />}
      {section === 'about' && <AboutSection />}
    </Modal>
  );
}

function NotificationsSection() {
  const [granted, setGranted] = useState<boolean>(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') return true;
    return localStorage.getItem('aanya_notif_granted') === '1';
  });
  const [testSent, setTestSent] = useState(false);

  useEffect(() => {
    notifPermission().then((p) => {
      if (p === 'granted') {
        setGranted(true);
        localStorage.setItem('aanya_notif_granted', '1');
      }
    });
  }, []);

  async function handleRequest() {
    const res = await requestNotifPermission();
    if (res === 'granted') {
      setGranted(true);
      localStorage.setItem('aanya_notif_granted', '1');
    }
  }

  async function handleTest() {
    await showLocalNotification({
      title: '💖 Aanya & Me Test Alert',
      body: 'Instant notification received successfully!',
      isActionable: true,
    });
    setTestSent(true);
    setTimeout(() => setTestSent(false), 2500);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="card p-4 bg-gradient-to-br from-card to-accent-soft/20">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent text-white">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-fg">Push &amp; Lock-Screen Alerts</p>
            <p className="text-xs text-muted">
              {granted
                ? 'System notifications are ACTIVE and enabled! 🎉'
                : 'Allow notifications to receive pokes & lock-screen controls'}
            </p>
          </div>
        </div>
      </div>

      {!granted && (
        <Button onClick={handleRequest} className="w-full">
          <Bell className="h-4 w-4" />
          <span>Enable Notifications on this Device</span>
        </Button>
      )}

      <Button variant="outline" onClick={handleTest} className="w-full">
        <span>{testSent ? 'Notification Sent! Check your status bar / lock screen ❤️' : 'Send Test Notification'}</span>
      </Button>

      {/* 🔒 Live Lock-Screen Quick Action Controls Guide */}
      <div className="card p-3.5 bg-bg-elev border border-accent/30 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="text-base">🔒</span>
          <div>
            <p className="text-xs font-bold text-fg uppercase tracking-wider">Lock-Screen Controls (No Unlock Needed)</p>
            <p className="text-[11px] text-muted">Always pinned on your lock screen like music controls</p>
          </div>
        </div>
        <div className="rounded-xl bg-card p-2.5 text-xs text-fg flex flex-col gap-1.5 border border-border/50">
          <p>• <b>❤️ Love / ✨ Miss You</b>: Tap directly on lock screen to send instant love with haptic confirmation without unlocking.</p>
          <p>• <b>🎨 Doodle</b>: Tap on lock screen to open the live shared drawing canvas directly over lock screen without typing passcode!</p>
        </div>
      </div>

      {/* 🔒 1-Tap Android Lock-Screen & Permissions Setup Hub */}
      <div className="card p-3.5 bg-bg-elev border border-accent/30 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="text-base">⚙️</span>
          <div>
            <p className="text-xs font-bold text-fg uppercase tracking-wider">Android Lock-Screen &amp; Permissions Setup</p>
            <p className="text-[11px] text-muted">Tap below to easily enable lock-screen visibility &amp; draw-over permissions</p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {/* 1. Lock-screen notification settings */}
          <div className="rounded-xl bg-card p-2.5 border border-border/60 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-fg">1. Lock-Screen Notification Card</span>
              <span className="text-[10px] text-accent font-semibold">ESSENTIAL</span>
            </div>
            <p className="text-[11px] text-muted">Ensure "Show on lock screen" &amp; "Show full content" are allowed so the quick action buttons stay pinned.</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                try {
                  if (typeof (window as any).AndroidNativeConfig?.openNotificationSettings === 'function') {
                    (window as any).AndroidNativeConfig.openNotificationSettings();
                  } else {
                    alert('Open your phone Settings -> Notifications -> Aanya & Me -> Enable "Lock screen notifications"');
                  }
                } catch (e) {
                  console.error(e);
                }
              }}
              className="w-full text-xs mt-1"
            >
              <span>🔔 Open Lock-Screen Notification Settings</span>
            </Button>
          </div>

          {/* 2. Display Over Other Apps (Overlay for Lock-Screen Doodle) */}
          <div className="rounded-xl bg-card p-2.5 border border-border/60 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-fg">2. Draw Over Lock Screen (Live Doodle)</span>
              <span className="text-[10px] text-accent font-semibold">DOODLE</span>
            </div>
            <p className="text-[11px] text-muted">Allows the live drawing canvas to open over your lock screen without asking for a passcode or PIN.</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                try {
                  if (typeof (window as any).AndroidNativeConfig?.openOverlaySettings === 'function') {
                    (window as any).AndroidNativeConfig.openOverlaySettings();
                  } else {
                    alert('Open phone Settings -> Apps -> Special app access -> Display over other apps -> Enable Aanya & Me');
                  }
                } catch (e) {
                  console.error(e);
                }
              }}
              className="w-full text-xs mt-1"
            >
              <span>🎨 Enable "Display Over Other Apps" (Appear On Top)</span>
            </Button>
          </div>

          {/* 3. Unrestricted Battery Delivery */}
          <div className="rounded-xl bg-card p-2.5 border border-border/60 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-fg">3. Unrestricted 24/7 Battery</span>
              <span className="text-[10px] text-emerald-400 font-semibold">REALTIME</span>
            </div>
            <p className="text-[11px] text-muted">Exempt from Android sleep so messages and lock-screen buttons are active 24/7.</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                try {
                  if (typeof (window as any).AndroidNativeConfig?.requestBatteryOptimizationExemption === 'function') {
                    (window as any).AndroidNativeConfig.requestBatteryOptimizationExemption();
                  } else {
                    alert('Allow "Unrestricted" battery in Settings -> Apps -> Aanya & Me -> Battery.');
                  }
                } catch (e) {
                  console.error(e);
                }
              }}
              className="w-full text-xs mt-1 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10"
            >
              <span>🚀 Allow Unrestricted Battery Delivery</span>
            </Button>
          </div>
        </div>
      </div>

      {/* 🔘 4-Press Power Button Quick Message Configuration */}
      <div className="card p-3.5 bg-bg-elev border border-accent/30 flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <span className="text-base">🔘</span>
          <div>
            <p className="text-xs font-bold text-fg uppercase tracking-wider">4-Press Power Button Shortcut</p>
            <p className="text-[11px] text-muted">Press phone's power button 4x quickly to dispatch this message instantly</p>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 mt-1">
          {[
            { emoji: '❤️', text: 'Thinking of you right now ❤️', label: 'Thinking of you' },
            { emoji: '🏠', text: 'Reached Home safely ❤️', label: 'Reached Home' },
            { emoji: '🚨', text: 'Emergency: Please call me back immediately! 🚨', label: 'Emergency Call Me' },
            { emoji: '😴', text: 'Going to sleep now, sweet dreams ❤️', label: 'Going to Sleep' },
          ].map((item) => {
            const currentSelected = localStorage.getItem('aanya_power_message') || 'Thinking of you right now ❤️';
            const isSelected = currentSelected === item.text;
            return (
              <button
                key={item.text}
                onClick={() => {
                  localStorage.setItem('aanya_power_message', item.text);
                  localStorage.setItem('aanya_power_emoji', item.emoji);
                  try {
                    if (typeof (window as any).AndroidNativeConfig?.savePowerMessage === 'function') {
                      (window as any).AndroidNativeConfig.savePowerMessage(item.text, item.emoji);
                    }
                  } catch {}
                  // Force re-render
                  setTestSent(false);
                }}
                className={`flex items-center justify-between p-2 rounded-xl text-xs font-semibold text-left transition-all ${
                  isSelected
                    ? 'bg-accent text-white shadow-sm'
                    : 'bg-card/70 hover:bg-card text-fg-soft border border-border/50'
                }`}
              >
                <span>{item.emoji} {item.label}</span>
                {isSelected && <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full">ACTIVE</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ProfileSection() {
  const { profile, updateProfile, signOut } = useAuth();
  const [name, setName] = useState(profile?.display_name ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="text-xs font-semibold text-fg-soft block mb-1">Display Name</label>
        <input className="input font-medium" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <Button
        loading={saving}
        onClick={async () => {
          setSaving(true);
          await updateProfile({ display_name: name || 'You' });
          setSaving(false);
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        }}
      >
        {saved ? 'Saved Successfully! ❤️' : 'Save Profile Name'}
      </Button>

      <div className="pt-2 border-t border-border/60">
        <Button variant="ghost" className="text-danger w-full" onClick={signOut}>
          <LogOut className="h-4 w-4" />
          <span>Switch User / Reset Profile</span>
        </Button>
      </div>
    </div>
  );
}

function ConnectionSection() {
  const { connection, partnerName, createConnection, joinConnection, disconnect } = useAppData();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  function copyCode(c: string) {
    navigator.clipboard?.writeText(c);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="card p-4 bg-gradient-to-br from-card to-accent-soft/20">
        <p className="text-xs font-bold uppercase tracking-wider text-muted">Current Status</p>
        <p className="mt-1 text-sm font-semibold text-fg">
          {connection?.status === 'accepted'
            ? `Connected with ${partnerName} ❤️`
            : connection?.status === 'pending'
              ? 'Waiting for partner to enter code'
              : 'Not paired yet'}
        </p>
        {connection?.pairing_code && (
          <div className="mt-3 flex items-center justify-between rounded-2xl bg-accent-soft/60 p-3 border border-accent/20">
            <span className="font-serif text-2xl font-bold tracking-widest text-accent">
              {connection.pairing_code}
            </span>
            <Button size="sm" variant="outline" onClick={() => copyCode(connection.pairing_code)}>
              {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        )}
      </div>

      {connection?.status !== 'accepted' && (
        <div className="flex flex-col gap-3">
          <Button
            loading={busy}
            onClick={async () => {
              setBusy(true);
              await createConnection();
              setBusy(false);
            }}
          >
            Generate New Pairing Code
          </Button>
          <div className="flex gap-2">
            <input
              className="input flex-1 uppercase tracking-wider text-center font-serif text-base"
              placeholder="e.g. AANYA-1234"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
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
        </div>
      )}

      {error && <p className="text-xs text-danger font-semibold text-center">{error}</p>}

      {connection?.status === 'accepted' && (
        <Button
          variant="ghost"
          className="text-danger w-full mt-2"
          onClick={async () => {
            if (confirm('Disconnect from partner? You can reconnect anytime with a new code.')) {
              await disconnect();
            }
          }}
        >
          Disconnect Partner
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
      setError('Please provide both a label and a message.');
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
    <div className="flex flex-col gap-4">
      {quickMessages.length === 0 && (
        <Button variant="outline" onClick={seedDefaults}>
          <Plus className="h-4 w-4" />
          <span>Add Suggested Cute Messages</span>
        </Button>
      )}

      <div className="card p-3.5 bg-bg-elev">
        <p className="text-xs font-bold uppercase tracking-wider text-fg-soft mb-2">
          {editingId ? 'Edit Message Tile' : 'Add New Quick Message'}
        </p>
        <div className="flex gap-2">
          <input
            className="input w-16 text-center text-2xl p-2"
            value={emoji}
            onChange={(e) => setEmoji(e.target.value.slice(0, 2))}
          />
          <input
            className="input flex-1"
            placeholder="Tile Label (e.g. Ready)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
        <input
          className="input mt-2"
          placeholder="Message partner will see"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        {error && <p className="mt-1 text-xs text-danger font-semibold">{error}</p>}
        <div className="mt-3 flex gap-2">
          <Button size="sm" onClick={save} className="flex-1">
            {editingId ? 'Update' : 'Add Tile'}
          </Button>
          {editingId && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditingId(null);
                setLabel('');
                setMessage('');
                setEmoji('💬');
              }}
            >
              Cancel
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
        {quickMessages.map((m) => (
          <div key={m.id} className="card flex items-center gap-3 p-3">
            <span className="text-2xl">{m.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-fg truncate">{m.label}</p>
              <p className="text-xs text-muted truncate">{m.message}</p>
            </div>
            <button
              className="text-xs font-medium text-accent hover:underline"
              onClick={async () => await updateQuickMessage(m.id, { pinned: !m.pinned })}
            >
              {m.pinned ? 'Unpin' : 'Pin'}
            </button>
            <button
              className="text-xs font-medium text-fg-soft hover:underline"
              onClick={() => {
                setEditingId(m.id);
                setEmoji(m.emoji);
                setLabel(m.label);
                setMessage(m.message);
              }}
            >
              Edit
            </button>
            <button
              className="text-xs font-medium text-danger hover:underline"
              onClick={async () => await deleteQuickMessage(m.id)}
            >
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
  const accents: { key: AccentKey; name: string; hex: string }[] = [
    { key: 'rose', name: 'Blush Rose', hex: '#e11d48' },
    { key: 'burgundy', name: 'Midnight Plum', hex: '#881337' },
    { key: 'lavender', name: 'Lavender Cloud', hex: '#7c3aed' },
    { key: 'sage', name: 'Matcha Sage', hex: '#059669' },
    { key: 'amber', name: 'Sunset Amber', hex: '#d97706' },
    { key: 'ocean', name: 'Ocean Breeze', hex: '#0284c7' },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <SectionLabel>Appearance Mode</SectionLabel>
        <div className="flex gap-2">
          {(['light', 'dark', 'system'] as const).map((m) => (
            <button
              key={m}
              className={`flex-1 rounded-2xl py-2.5 text-xs font-semibold capitalize transition-all ${
                mode === m
                  ? 'bg-accent text-white shadow-md shadow-accent/25 scale-105'
                  : 'bg-bg-elev text-fg-soft border border-border'
              }`}
              onClick={() => setMode(m)}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
      <div>
        <SectionLabel>Accent Palette</SectionLabel>
        <div className="grid grid-cols-3 gap-2.5">
          {accents.map((a) => (
            <button
              key={a.key}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border transition-all ${
                accent === a.key
                  ? 'border-accent bg-accent-soft/30 scale-105 shadow-sm'
                  : 'border-border bg-card'
              }`}
              onClick={() => setAccent(a.key)}
            >
              <span className="h-6 w-6 rounded-full shadow-sm" style={{ background: a.hex }} />
              <span className="text-[11px] font-semibold text-fg">{a.name}</span>
            </button>
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
    { key: 'arrival', label: 'Arrival only', desc: 'Share location only when arriving at saved places.' },
    { key: 'sos', label: 'SOS only', desc: 'Attach coordinates only when emergency SOS is triggered.' },
    { key: 'live', label: 'Active Sharing', desc: 'Attach location coordinates with all messages.' },
  ];
  const current = profile?.location_mode ?? 'arrival';

  return (
    <div className="flex flex-col gap-2.5">
      <SectionLabel>Location Policy</SectionLabel>
      {modes.map((m) => (
        <button
          key={m.key}
          className={`card p-3.5 text-left transition-all ${
            current === m.key ? 'border-accent bg-accent-soft/20 shadow-sm' : ''
          }`}
          onClick={() => updateProfile({ location_mode: m.key })}
        >
          <p className="text-sm font-semibold text-fg">{m.label}</p>
          <p className="text-xs text-muted mt-0.5">{m.desc}</p>
        </button>
      ))}
      <p className="mt-1 text-xs text-muted text-center">
        Location coordinates are only ever shared with your private partner.
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
    { value: 60, label: '60 Days', desc: 'Auto-delete older than 2 months' },
    { value: 90, label: '90 Days', desc: 'Auto-delete older than 3 months' },
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
        <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-bg-elev p-0.5 border border-border/40">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-accent to-rose-500 transition-all duration-500"
            style={{ width: `${Math.max(2, Math.min(100, storageStats.quotaPercent * 10))}%` }}
          />
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-2xl bg-bg-elev p-2 border border-border/60">
            <p className="font-semibold text-fg">{storageStats.eventCount}</p>
            <p className="text-[10px] text-muted">Total Events</p>
          </div>
          <div className="rounded-2xl bg-bg-elev p-2 border border-border/60">
            <p className="font-semibold text-amber-500">⭐ {storageStats.keptCount}</p>
            <p className="text-[10px] text-muted">Starred Memories</p>
          </div>
          <div className="rounded-2xl bg-bg-elev p-2 border border-border/60">
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
              className={`card p-3 text-left transition-all ${
                retentionDays === opt.value ? 'border-accent bg-accent-soft/30' : ''
              }`}
              onClick={() => {
                setRetentionDays(opt.value);
                setResultMsg(null);
              }}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-fg">{opt.label}</p>
                {retentionDays === opt.value && <span className="text-xs text-accent font-bold">Active</span>}
              </div>
              <p className="text-xs text-muted">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Starred memory note */}
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-900 dark:text-amber-200">
        <p className="font-semibold">⭐ Favorite Memories are Safe:</p>
        <p className="mt-0.5 text-muted">
          Any message you star (⭐) in History or on Home will <strong>never</strong> be deleted by auto-cleanup.
        </p>
      </div>

      {/* Manual Clean Button */}
      <div>
        <Button variant="outline" className="w-full" loading={cleaning} onClick={handleManualClean}>
          🧹 Clean Old Messages Now
        </Button>
        {resultMsg && <p className="mt-2 text-center text-xs font-medium text-accent">{resultMsg}</p>}
      </div>
    </div>
  );
}

function PrivacySection() {
  return (
    <div className="flex flex-col gap-3 text-sm text-fg-soft">
      <div className="card p-4">
        <p className="font-semibold text-fg">Privacy Guarantees</p>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-xs">
          <li>100% private to you and your partner.</li>
          <li>Zero ads, zero data selling, zero tracking.</li>
          <li>Encrypted data transfer over HTTPS/WSS.</li>
          <li>Supabase free tier forever.</li>
        </ul>
      </div>
    </div>
  );
}

function AboutSection() {
  return (
    <div className="flex flex-col items-center gap-3 text-center py-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-accent-soft text-3xl pulse-gentle shadow-md shadow-accent/20">
        💖
      </div>
      <div>
        <h2 className="text-lg font-serif text-fg">Aanya &amp; Me</h2>
        <p className="text-xs text-accent font-semibold">Version 1.1.0 · Always Free</p>
      </div>
      <p className="text-xs text-muted max-w-xs">
        Crafted with love for instant, one-tap connection between you two.
      </p>
    </div>
  );
}
