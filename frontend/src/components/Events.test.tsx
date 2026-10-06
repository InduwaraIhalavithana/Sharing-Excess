import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../contexts/AuthContext';
import { LanguageProvider } from '../i18n/LanguageContext';
import type { CommunityEvent } from '../types/api';
import Events from './Events';

const base: CommunityEvent = {
  id: 1, title: 'Community Food Drive', description: 'Bring surplus food.', location: 'Colombo City Centre',
  starts_at: '2030-01-15T08:00:00', ends_at: '2030-01-15T12:00:00', capacity: 30, going: 4, spots_left: 26,
  full: false, is_past: false, joined: false,
};

function mockApi(events: CommunityEvent[]) {
  const calls: { url: string; method: string }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method ?? 'GET' });
    const body = url.includes('/api/community-events') && !url.includes('/join') && !url.includes('subscribe')
      ? { success: true, events }
      : url.includes('public/stats')
        ? { success: true, meals_delivered: 4, donors: 10, recipients: 8, listings_shared: 15, listings_available: 12, requests_open: 6 }
        : { success: true, message: 'You have joined the event' };
    return { ok: true, status: 200, json: () => Promise.resolve(body) };
  }));
  return calls;
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <LanguageProvider>
        <AuthProvider>
          <MemoryRouter><Events /></MemoryRouter>
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('Events page', () => {
  it('shows upcoming and past events separately, with spots left', async () => {
    mockApi([base, { ...base, id: 2, title: 'Old Drive', is_past: true, going: 12 }]);
    renderPage();
    // (it appears twice on purpose: in the list and in the "Next event" highlight)
    expect((await screen.findAllByText('Community Food Drive')).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('26 spots left').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Old Drive')).toBeInTheDocument();
    expect(screen.getByText('12 took part')).toBeInTheDocument();
    // a past event can't be joined: only the upcoming one has a button
    expect(screen.getAllByRole('button', { name: /join event/i })).toHaveLength(1);
  });

  it('shows an honest empty state when staff have not published anything', async () => {
    mockApi([]);
    renderPage();
    expect(await screen.findByText(/no upcoming events/i)).toBeInTheDocument();
  });

  it('asks signed-out visitors to log in instead of joining', async () => {
    const calls = mockApi([base]);
    const opened = vi.fn();
    window.addEventListener('openLogin', opened);
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: /join event/i }));
    window.removeEventListener('openLogin', opened);
    expect(opened).toHaveBeenCalledOnce();
    expect(calls.some((c) => c.url.includes('/join'))).toBe(false);
  });

  it('lets a signed-in user join', async () => {
    localStorage.setItem('user', JSON.stringify({ id: 9, name: 'Nimali', email: 'n@example.com', role: 'recipient', status: 'active' }));
    localStorage.setItem('se_token', 'tok');
    const calls = mockApi([base]);
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: /join event/i }));
    await waitFor(() => expect(calls.some((c) => c.url.endsWith('/api/community-events/1/join') && c.method === 'POST')).toBe(true));
    expect(await screen.findByText('You have joined the event')).toBeInTheDocument();
  });

  it('disables joining a full event and rejects a bad subscribe email without calling the server', async () => {
    const calls = mockApi([{ ...base, full: true, spots_left: 0, going: 30 }]);
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByRole('button', { name: /event full/i })).toBeDisabled();
    await user.type(screen.getByLabelText(/email address/i), 'nope');
    await user.click(screen.getByRole('button', { name: /notify me/i }));
    expect(await screen.findByText(/valid email/i)).toBeInTheDocument();
    expect(calls.some((c) => c.url.includes('subscribe'))).toBe(false);
  });
});
