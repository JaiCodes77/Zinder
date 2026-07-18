export type Coords = { lat: number; lng: number };

export type NearbyGeoStatus =
  | 'idle'
  | 'locating'
  | 'ready'
  | 'denied'
  | 'unavailable';

export type ReadCoordsResult =
  | { ok: true; coords: Coords }
  | { ok: false; reason: 'denied' | 'unavailable' };

/** Browser geolocation with a short timeout. */
export function readBrowserCoords(
  options: PositionOptions = {
    enableHighAccuracy: false,
    timeout: 8000,
    maximumAge: 5 * 60 * 1000,
  }
): Promise<ReadCoordsResult> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve({ ok: false, reason: 'unavailable' });
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          resolve({ ok: false, reason: 'unavailable' });
          return;
        }
        resolve({ ok: true, coords: { lat, lng } });
      },
      (err) => {
        resolve({
          ok: false,
          reason: err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable',
        });
      },
      options
    );
  });
}

/** @deprecated alias — prefer readBrowserCoords */
export function requestBrowserCoords(
  options?: PositionOptions
): Promise<Coords | null> {
  return readBrowserCoords(options).then((r) => (r.ok ? r.coords : null));
}

/** True when profile already has usable coordinates for Nearby scoring. */
export function profileHasCoords(profile: {
  lat?: number | null;
  lng?: number | null;
} | null): boolean {
  if (!profile) return false;
  return (
    typeof profile.lat === 'number' &&
    Number.isFinite(profile.lat) &&
    typeof profile.lng === 'number' &&
    Number.isFinite(profile.lng)
  );
}

/** Short status copy for the Discover Nearby sort control. */
export function nearbyGeoMessage(status: NearbyGeoStatus): string | null {
  switch (status) {
    case 'locating':
      return 'Getting your location for Nearby…';
    case 'denied':
      return 'Location permission denied — Nearby can’t rank by distance.';
    case 'unavailable':
      return 'Location unavailable — Nearby may show Distance unknown.';
    case 'ready':
    case 'idle':
    default:
      return null;
  }
}
