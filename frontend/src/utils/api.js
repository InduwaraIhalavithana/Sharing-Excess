import { API_BASE } from '../config.js';

/**
 * Drop-in replacement for fetch() that automatically adds the JWT auth header.
 * Accepts the same full URL patterns already used throughout the app.
 * On 401 it dispatches 'auth:expired' so AuthContext can auto-logout.
 */
export async function apiFetch(url, options = {}) {
  const token = localStorage.getItem('se_token');
  const headers = { ...options.headers };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Don't set Content-Type for FormData — let browser set boundary automatically
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    window.dispatchEvent(new Event('auth:expired'));
  }

  return res;
}
