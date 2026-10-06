import { API_BASE } from '../config';
import type { ApiErrorBody } from '../types/api';

/**
 * Drop-in replacement for fetch() that automatically adds the JWT auth header.
 * On 401 it dispatches 'auth:expired' so AuthContext can auto-logout.
 */
export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem('se_token');
  const headers: Record<string, string> = { ...(options.headers as Record<string, string> | undefined) };

  if (token) headers['Authorization'] = `Bearer ${token}`;

  // Don't set Content-Type for FormData - the browser adds the multipart boundary
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) window.dispatchEvent(new Event('auth:expired'));
  return res;
}

/** Thrown by `api()` for any non-2xx response; `body` is the parsed error JSON. */
export class ApiError extends Error {
  status: number;
  body: ApiErrorBody | null;
  constructor(status: number, message: string, body: ApiErrorBody | null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

function errorMessage(body: ApiErrorBody | null, fallback: string): string {
  if (!body) return fallback;
  if (typeof body.detail === 'string') return body.detail;
  if (Array.isArray(body.detail) && body.detail[0]?.msg) return body.detail[0].msg;
  return body.message || fallback;
}

/** Typed JSON helper for TanStack Query: `api<ListingsPage>('/api/listings?limit=6')`. */
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await apiFetch(`${API_BASE}${path}`, options);
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* empty or non-JSON body */
  }
  if (!res.ok) {
    const err = body as ApiErrorBody | null;
    throw new ApiError(res.status, errorMessage(err, `Request failed (${res.status})`), err);
  }
  return body as T;
}
