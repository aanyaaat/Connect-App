export type NotifPermission = 'granted' | 'denied' | 'default' | 'unsupported';

export function notifSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export async function requestNotifPermission(): Promise<NotifPermission> {
  if (!notifSupported()) return 'unsupported';
  try {
    const res = await Notification.requestPermission();
    return res as NotifPermission;
  } catch {
    return 'denied';
  }
}

export function notifPermission(): NotifPermission {
  if (!notifSupported()) return 'unsupported';
  return Notification.permission as NotifPermission;
}

export interface LocalNotif {
  title: string;
  body: string;
  tag?: string;
  url?: string;
}

export function showLocalNotification(n: LocalNotif): void {
  if (!notifSupported() || Notification.permission !== 'granted') return;
  try {
    const notif = new Notification(n.title, {
      body: n.body,
      tag: n.tag,
      icon: '/heart.svg',
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
