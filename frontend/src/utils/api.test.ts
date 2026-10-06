import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, apiFetch } from './api';
import { generalError, parseApiErrors } from './formErrors';

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

/** Await a promise that is expected to reject and return the error. */
const failure = async (p: Promise<unknown>) => (await p.then(() => null, (e: unknown) => e)) as ApiError;

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('apiFetch', () => {
  it('adds the bearer token when one is stored', async () => {
    localStorage.setItem('se_token', 'abc');
    const fetchMock = mockFetch(200, {});
    await apiFetch('http://x/test');
    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers.Authorization).toBe('Bearer abc');
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('lets the browser set the multipart boundary for FormData', async () => {
    const fetchMock = mockFetch(200, {});
    await apiFetch('http://x/test', { method: 'POST', body: new FormData() });
    expect(fetchMock.mock.calls[0][1].headers['Content-Type']).toBeUndefined();
  });

  it('announces an expired session on 401', async () => {
    mockFetch(401, {});
    const onExpired = vi.fn();
    window.addEventListener('auth:expired', onExpired);
    await apiFetch('http://x/test');
    window.removeEventListener('auth:expired', onExpired);
    expect(onExpired).toHaveBeenCalledOnce();
  });
});

describe('api()', () => {
  it('returns parsed JSON on success', async () => {
    mockFetch(200, { success: true, total: 3 });
    await expect(api<{ total: number }>('/api/listings')).resolves.toMatchObject({ total: 3 });
  });

  it('throws an ApiError carrying the server message and status', async () => {
    mockFetch(403, { detail: 'You can only delete your own requests' });
    const err = await failure(api('/api/requests/1', { method: 'DELETE' }));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(403);
    expect(err.message).toBe('You can only delete your own requests');
  });

  it('uses the first field message for 422 validation errors', async () => {
    mockFetch(422, { detail: [{ loc: ['body', 'food_name'], msg: 'Field required' }] });
    const err = await failure(api('/api/requests', { method: 'POST' }));
    expect(err.message).toBe('Field required');
    expect(parseApiErrors(err.body)).toEqual({ food_name: 'Field required' });
  });
});

describe('formErrors', () => {
  it('maps a plain string detail to the general error', () => {
    expect(generalError(parseApiErrors({ detail: 'Invalid email or password' }))).toBe('Invalid email or password');
  });

  it('returns an empty map for nothing', () => {
    expect(parseApiErrors(null)).toEqual({});
  });
});
