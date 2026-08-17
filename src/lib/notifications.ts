import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

export type NotifPermission = 'granted' | 'denied' | 'default' | 'unsupported';

export function notifSupported(): boolean {
  if (Capacitor.isNativePlatform()) return true;
  return typeof window !== 'undefined' && 'Notification' in window;
}

export async function requestNotifPermission(): Promise<NotifPermission> {
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await LocalNotifications.requestPermissions();
      return res.display === 'granted' ? 'granted' : 'denied';
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

// Initialize native Android channels and lockscreen action types
export async function initializeNotificationSystem(
  onQuickAction?: (actionId: string) => void,
) {
  if (!Capacitor.isNativePlatform()) return;

  try {
    // 1. Create Android Notification Channels (Heads-up, vibration, high priority)
    await LocalNotifications.createChannel({
      id: 'aanya_love_channel',
      name: 'Aanya & Me Love & Moments',
      description: 'Instant messages, pokes, and heart bursts',
      importance: 5,
      visibility: 1, // Public on lockscreen
      vibration: true,
      sound: 'res_custom_ringtone.mp3',
    });

    await LocalNotifications.createChannel({
      id: 'aanya_places_channel',
      name: 'Arrival & Location Suggestions',
      description: 'Geofenced arrival alerts and quick check-in suggestions',
      importance: 4,
      visibility: 1,
      vibration: true,
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
    console.warn('Failed to initialize native notifications:', err);
  }
}

export async function showLocalNotification(n: LocalNotif): Promise<void> {
  // Native Android Notification
  if (Capacitor.isNativePlatform()) {
    try {
      const id = Math.floor(Math.random() * 1000000);
      await LocalNotifications.schedule({
        notifications: [
          {
            id,
            title: n.title,
            body: n.body,
            channelId: n.isActionable ? 'aanya_places_channel' : 'aanya_love_channel',
            actionTypeId: n.isActionable ? 'LOCKSCREEN_ACTIONS' : undefined,
            extra: n.extra,
            schedule: { at: new Date(Date.now() + 100) },
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
          icon: '/icon.svg',
          badge: '/icon.svg',
          data: { url: n.url || '/' },
        } as NotificationOptions);
        return;
      }

      const notif = new Notification(n.title, {
        body: n.body,
        tag: n.tag,
        icon: '/icon.svg',
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

// Lock-screen arrival suggestion notification
export async function showLockScreenArrivalSuggestion(placeName: string, emoji = '📍') {
  await showLocalNotification({
    title: `${emoji} Near ${placeName}?`,
    body: `Tap below to send a quick arrival update to Aanya directly from your lock screen!`,
    isActionable: true,
  });
}
