import { describe, expect, it } from 'vitest';
import { authStubMessage } from './authStubs';

describe('authStubMessage', () => {
  it('explains SSO is not wired without sounding like a hard failure', () => {
    const msg = authStubMessage('sso');
    expect(msg.toLowerCase()).toMatch(/apple|google|email/);
    expect(msg.toLowerCase()).not.toMatch(/error|failed/);
  });

  it('explains password reset is unavailable', () => {
    const msg = authStubMessage('password_reset');
    expect(msg.toLowerCase()).toMatch(/password reset|reset/);
  });
});
