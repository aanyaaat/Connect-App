export interface Coords {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export async function getCurrentPosition(): Promise<Coords | null> {
  if (!('geolocation' in navigator)) return null;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
    );
  });
}

export async function watchPosition(
  cb: (c: Coords) => void,
): Promise<() => void> {
  if (!('geolocation' in navigator)) {
    return () => {};
  }
  const id = navigator.geolocation.watchPosition(
    (pos) =>
      cb({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        timestamp: pos.timestamp,
      }),
    () => {},
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 },
  );
  return () => navigator.geolocation.clearWatch(id);
}

export function mapsLink(lat: number, lon: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
}
