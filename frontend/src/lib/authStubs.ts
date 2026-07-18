/** Copy for Auth surfaces that are intentionally unimplemented (no BE SSO/reset yet). */

export type AuthStubKind = 'sso' | 'password_reset';

const MESSAGES: Record<AuthStubKind, string> = {
  sso: 'Apple and Google sign-in aren’t wired yet — use email for now.',
  password_reset: 'Password reset isn’t available yet — contact support if you’re locked out.',
};

export function authStubMessage(kind: AuthStubKind): string {
  return MESSAGES[kind];
}
