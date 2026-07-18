import { describe, expect, it } from 'vitest';
import { ApiError } from './client';
import { formatProjectActionError } from './projects';

describe('formatProjectActionError', () => {
  it('surfaces 403 authZ detail from the server', () => {
    const err = new ApiError(403, 'Only the project owner can accept a helper.');
    expect(formatProjectActionError(err, 'fallback')).toMatch(/only the project owner/i);
  });

  it('uses a permission fallback when 403 has empty detail', () => {
    expect(formatProjectActionError(new ApiError(403, ''), 'fallback')).toMatch(
      /don't have permission/i
    );
  });

  it('passes through other ApiError details', () => {
    expect(
      formatProjectActionError(new ApiError(400, 'Invalid status transition.'), 'fallback')
    ).toBe('Invalid status transition.');
  });

  it('uses fallback for non-ApiError', () => {
    expect(formatProjectActionError(new Error('x'), 'Could not save.')).toBe(
      'Could not save.'
    );
  });
});
