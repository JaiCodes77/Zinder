import { apiFetch } from './client';

export type PublicProfile = {
  user_id: number;
  user: { id: number; name: string; email?: string };
  age?: number | null;
  distance?: string | null;
  bio?: string | null;
  image?: string | null;
  interests?: string[];
  looking_for?: string | null;
  radius_limit?: number | null;
  lat?: number | null;
  lng?: number | null;
  last_active_at?: string | null;
};

/** Own profile shape used when merging location into POST /profiles. */
export type OwnProfileSnapshot = {
  age?: number | null;
  distance?: string | null;
  bio?: string | null;
  image?: string | null;
  interests?: string[];
  looking_for?: string | null;
  radius_limit?: number | null;
  lat?: number | null;
  lng?: number | null;
};

export function getPublicProfile(userId: number) {
  return apiFetch<PublicProfile>(`/profiles/${userId}`);
}

/**
 * Persist viewer coords for Nearby browse scoring.
 * Merges into the current profile so other fields aren't wiped (BE upsert).
 */
export function syncProfileLocation(
  profile: OwnProfileSnapshot | null | undefined,
  coords: { lat: number; lng: number }
) {
  return apiFetch('/profiles', {
    method: 'POST',
    json: {
      age: profile?.age ?? undefined,
      distance: profile?.distance ?? undefined,
      bio: profile?.bio ?? undefined,
      image: profile?.image ?? undefined,
      interests: profile?.interests ?? [],
      looking_for: profile?.looking_for ?? undefined,
      radius_limit: profile?.radius_limit ?? undefined,
      lat: coords.lat,
      lng: coords.lng,
    },
  });
}
