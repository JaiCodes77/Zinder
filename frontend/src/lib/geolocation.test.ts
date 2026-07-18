import { describe, expect, it } from 'vitest';
import { nearbyGeoMessage, profileHasCoords } from './geolocation';

describe('profileHasCoords', () => {
  it('requires finite lat and lng', () => {
    expect(profileHasCoords(null)).toBe(false);
    expect(profileHasCoords({})).toBe(false);
    expect(profileHasCoords({ lat: 37.7, lng: null })).toBe(false);
    expect(profileHasCoords({ lat: 37.7, lng: -122.4 })).toBe(true);
  });
});

describe('nearbyGeoMessage', () => {
  it('surfaces actionable copy for non-ready states', () => {
    expect(nearbyGeoMessage('idle')).toBeNull();
    expect(nearbyGeoMessage('ready')).toBeNull();
    expect(nearbyGeoMessage('locating')).toMatch(/getting your location/i);
    expect(nearbyGeoMessage('denied')).toMatch(/denied/i);
    expect(nearbyGeoMessage('unavailable')).toMatch(/unavailable/i);
  });
});
