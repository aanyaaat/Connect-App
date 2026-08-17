import { supabase } from './supabase';

interface BatteryManager extends EventTarget {
  charging: boolean;
  chargingTime: number;
  dischargingTime: number;
  level: number;
  addEventListener(type: string, listener: (this: BatteryManager, ev: Event) => void): void;
  removeEventListener(type: string, listener: (this: BatteryManager, ev: Event) => void): void;
}

interface NavigatorWithBattery extends Navigator {
  getBattery?: () => Promise<BatteryManager>;
}

export function initBatteryMonitoring(userId: string | undefined): () => void {
  if (!userId || typeof window === 'undefined') return () => {};

  const nav = navigator as NavigatorWithBattery;
  if (!nav.getBattery) return () => {};

  let batteryRef: BatteryManager | null = null;

  const updateBattery = async (bm: BatteryManager) => {
    try {
      const level = Math.round(bm.level * 100);
      const isCharging = bm.charging;
      await supabase.from('profiles').update({
        battery_level: level,
        is_charging: isCharging,
      }).eq('id', userId);
    } catch {
      // ignore
    }
  };

  const handler = () => {
    if (batteryRef) updateBattery(batteryRef);
  };

  nav.getBattery().then((bm) => {
    batteryRef = bm;
    updateBattery(bm);
    bm.addEventListener('levelchange', handler);
    bm.addEventListener('chargingchange', handler);
  }).catch(() => {});

  return () => {
    if (batteryRef) {
      batteryRef.removeEventListener('levelchange', handler);
      batteryRef.removeEventListener('chargingchange', handler);
    }
  };
}
