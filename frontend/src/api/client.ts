/**
 * Shared API client for Zinder gateway.
 * - Cookie session auth (`credentials: 'include'`)
 * - 401 → optional unauthorized handler (session expired → Auth)
 * - Distinguishes empty success payloads from transport/parse failures
 */

export const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') ||
  'http://localhost:8080/api/v1';

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

type UnauthorizedHandler = () => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;

/** Register once from App — called on 401 from any apiFetch. */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  unauthorizedHandler = handler;
}

async function readErrorDetail(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { detail?: unknown; message?: unknown };
    if (typeof data.detail === 'string') return data.detail;
    if (Array.isArray(data.detail)) {
      return data.detail
        .map((d) => (typeof d === 'object' && d && 'msg' in d ? String((d as { msg: unknown }).msg) : String(d)))
        .join('; ');
    }
    if (typeof data.message === 'string') return data.message;
  } catch {
    // ignore
  }
  return res.statusText || `Request failed (${res.status})`;
}

export type ApiFetchOptions = RequestInit & {
  /** JSON body — serialized automatically; sets Content-Type when present. */
  json?: unknown;
  /** Skip 401 → unauthorized handler (e.g. bootstrap /auth/me). */
  skipUnauthorizedHandler?: boolean;
};

/**
 * Fetch against the gateway API base. Always sends cookies.
 * Throws ApiError on non-OK responses.
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const { json, skipUnauthorizedHandler, headers: initHeaders, body: initBody, ...rest } = options;
  const headers = new Headers(initHeaders);

  let body: BodyInit | null | undefined = initBody;
  if (json !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(json);
  }

  const url = path.startsWith('http') ? path : `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;

  const res = await fetch(url, {
    ...rest,
    headers,
    body,
    credentials: 'include',
  });

  if (res.status === 401 && !skipUnauthorizedHandler) {
    unauthorizedHandler?.();
  }

  if (!res.ok) {
    throw new ApiError(res.status, await readErrorDetail(res));
  }

  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T;
  }

  const text = await res.text();
  if (!text) return undefined as T;

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError(res.status, 'Invalid JSON from server');
  }
}

/** True when a successful list/collection response has no items (not an error). */
export function isEmptyList(data: unknown): boolean {
  if (data == null) return true;
  if (Array.isArray(data)) return data.length === 0;
  if (typeof data === 'object' && data !== null && 'items' in data) {
    const items = (data as { items: unknown }).items;
    return Array.isArray(items) && items.length === 0;
  }
  return false;
}
