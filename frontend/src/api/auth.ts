import { apiFetch } from './client';

export interface AuthUser {
  id: number;
  email: string;
  name: string;
}

export async function getMe(): Promise<AuthUser> {
  return apiFetch<AuthUser>('/auth/me', { skipUnauthorizedHandler: true });
}

export async function login(email: string, password: string): Promise<AuthUser> {
  return apiFetch<AuthUser>('/auth/login', {
    method: 'POST',
    json: { email, password },
    skipUnauthorizedHandler: true,
  });
}

export async function register(
  email: string,
  password: string,
  name: string
): Promise<unknown> {
  return apiFetch('/auth/register', {
    method: 'POST',
    json: { email, password, name },
    skipUnauthorizedHandler: true,
  });
}

export async function logout(): Promise<void> {
  await apiFetch<void>('/auth/logout', {
    method: 'POST',
    skipUnauthorizedHandler: true,
  });
}
