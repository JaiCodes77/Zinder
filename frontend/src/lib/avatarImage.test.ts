import { describe, expect, it } from 'vitest';
import { isAllowedAvatarMime, AVATAR_MAX_EDGE, AVATAR_MAX_INPUT_BYTES } from './avatarImage';

describe('avatarImage', () => {
  it('accepts common image MIME types', () => {
    expect(isAllowedAvatarMime('image/jpeg')).toBe(true);
    expect(isAllowedAvatarMime('image/PNG')).toBe(true);
    expect(isAllowedAvatarMime('image/webp')).toBe(true);
    expect(isAllowedAvatarMime('image/gif')).toBe(true);
    expect(isAllowedAvatarMime('application/pdf')).toBe(false);
    expect(isAllowedAvatarMime('text/plain')).toBe(false);
  });

  it('keeps conservative size caps', () => {
    expect(AVATAR_MAX_EDGE).toBe(512);
    expect(AVATAR_MAX_INPUT_BYTES).toBe(8 * 1024 * 1024);
  });
});
