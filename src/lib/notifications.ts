import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { supabase } from './supabase';

export type NotifPermission = 'granted' | 'denied' | 'default' | 'unsupported';

export function notifSupported(): boolean {
  if (Capacitor.isNativePlatform()) return true;
  return typeof window !== 'undefined' && 'Notification' in window;
}

export async function requestNotifPermission(): Promise<NotifPermission> {
  if (Capacitor.isNativePlatform()) {
    try {
      const localRes = await LocalNotifications.requestPermissions();
      return localRes.display === 'granted' ? 'granted' : 'denied';
    } catch {
      return 'denied';
    }
  }

  if (typeof window !== 'undefined' && 'Notification' in window) {
    try {
      const res = await Notification.requestPermission();
      return res as NotifPermission;
    } catch {
      return 'denied';
    }
  }

  return 'unsupported';
}

export async function notifPermission(): Promise<NotifPermission> {
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await LocalNotifications.checkPermissions();
      return res.display === 'granted' ? 'granted' : 'denied';
    } catch {
      return 'denied';
    }
  }

  if (typeof window !== 'undefined' && 'Notification' in window) {
    return Notification.permission as NotifPermission;
  }

  return 'unsupported';
}

export interface LocalNotif {
  title: string;
  body: string;
  tag?: string;
  url?: string;
  isActionable?: boolean;
  extra?: Record<string, unknown>;
}

// Initialize native Android channels, heads-up popups, and lockscreen actions
export async function initializeNotificationSystem(
  userId?: string,
  onQuickAction?: (actionId: string) => void,
) {
  if (!Capacitor.isNativePlatform()) {
    // On Web, register Web Push service worker
    if (userId && typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
      try {
        const reg = await navigator.serviceWorker.ready;
        let sub = await reg.pushManager.getSubscription();
        if (!sub && typeof window !== 'undefined' && 'Notification' in window && window.Notification.permission === 'granted') {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U',
          });
        }
        if (sub) {
          const subJson = sub.toJSON();
          await supabase.from('push_subscriptions').upsert(
            {
              user_id: userId,
              endpoint: sub.endpoint,
              p256dh: subJson.keys?.p256dh || null,
              auth: subJson.keys?.auth || null,
              platform: 'web',
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,endpoint' },
          );
        }
      } catch (e) {
        console.warn('Web push registration notice:', e);
      }
    }
    return;
  }

  try {
    // 1. Create Android Notification Channels (Heads-up, vibration, high priority)
    await LocalNotifications.createChannel({
      id: 'aanya_love_channel',
      name: 'Aanya & Me Love & Moments',
      description: 'Instant messages, pokes, and heart bursts',
      importance: 5, // MAX importance for instant heads-up popup
      visibility: 1, // Public on lockscreen
      vibration: true,
      lights: true,
      lightColor: '#f43f5e',
    });

    await LocalNotifications.createChannel({
      id: 'aanya_places_channel',
      name: 'Arrival & Location Suggestions',
      description: 'Geofenced arrival alerts and quick check-in suggestions',
      importance: 5,
      visibility: 1,
      vibration: true,
      lights: true,
      lightColor: '#f43f5e',
    });

    // 2. Register Lock Screen Interactive Action Buttons
    await LocalNotifications.registerActionTypes({
      types: [
        {
          id: 'LOCKSCREEN_ACTIONS',
          actions: [
            {
              id: 'reached_home',
              title: '🏠 Reached Home',
              foreground: false, // Send without needing to open/unlock app
            },
            {
              id: 'on_my_way',
              title: '🚗 On My Way',
              foreground: false,
            },
            {
              id: 'send_love',
              title: '💖 Send Love',
              foreground: false,
            },
          ],
        },
      ],
    });

    // 3. Listen for Action Button Clicks from Lock Screen
    await LocalNotifications.addListener(
      'localNotificationActionPerformed',
      (action) => {
        const actionId = action.actionId;
        if (actionId && actionId !== 'tap' && onQuickAction) {
          onQuickAction(actionId);
        }
      },
    );
  } catch (err) {
    console.warn('Notification system init warning:', err);
  }
}

export async function showLocalNotification(n: LocalNotif): Promise<void> {
  // Native Android Notification
  if (Capacitor.isNativePlatform()) {
    // HeartbeatService natively manages incoming partner alerts to prevent duplicate notifications.
    if (!n.isActionable && !n.tag?.startsWith('status_') && !n.tag?.startsWith('test_')) {
      return;
    }
    try {
      let id = Math.floor(Math.random() * 1000000);
      if (n.tag) {
        let hash = 0;
        for (let i = 0; i < n.tag.length; i++) {
          hash = ((hash << 5) - hash) + n.tag.charCodeAt(i);
          hash |= 0;
        }
        id = Math.abs(hash % 1000000);
      }
      await LocalNotifications.schedule({
        notifications: [
          {
            id,
            title: n.title,
            body: n.body,
            channelId: n.isActionable ? 'aanya_places_channel' : 'aanya_love_channel',
            actionTypeId: n.isActionable ? 'LOCKSCREEN_ACTIONS' : undefined,
            extra: n.extra,
            schedule: { at: new Date() }, // Instant trigger
            smallIcon: 'ic_stat_icon',
            iconColor: '#f43f5e',
          },
        ],
      });
      return;
    } catch (err) {
      console.warn('Native notification schedule error:', err);
    }
  }

  // Web Browser Notification Fallback (Via Service Worker for inactive/background tab delivery)
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification(n.title, {
          body: n.body,
          tag: n.tag,
          icon: '/icon-192.png',
          badge: '/favicon.png',
          data: { url: n.url || '/' },
        } as NotificationOptions);
        return;
      }

      const notif = new Notification(n.title, {
        body: n.body,
        tag: n.tag,
        icon: '/icon-192.png',
      });
      if (n.url) {
        notif.onclick = () => {
          window.focus();
          notif.close();
        };
      }
    } catch {
      // ignore
    }
  }
}

// Send push notification to partner when closed/inactive
export async function dispatchPushToPartner(partnerId: string, title: string, body: string) {
  try {
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', partnerId);

    if (!subs || subs.length === 0) return;

    // Send payload to partner subscriptions
    for (const sub of subs) {
      if (sub.platform === 'web' && sub.endpoint) {
        try {
          // Trigger web push
          fetch(sub.endpoint, {
            method: 'POST',
            body: JSON.stringify({ title, body }),
            headers: { 'Content-Type': 'application/json' },
            mode: 'no-cors',
          }).catch(() => {});
        } catch {
          // ignore
        }
      }
    }
  } catch (e) {
    console.warn('Push dispatch notice:', e);
  }
}

// Lock-screen arrival suggestion notification
export async function showLockScreenArrivalSuggestion(placeName: string, emoji = '📍') {
  await showLocalNotification({
    title: `${emoji} Near ${placeName}?`,
    body: `Tap below to send a quick arrival update to Aanya directly from your lock screen!`,
    isActionable: true,
  });
}
