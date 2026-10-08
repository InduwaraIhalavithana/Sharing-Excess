import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../contexts/AuthContext';
import { LanguageProvider } from '../i18n/LanguageContext';
import type { FoodRequest, Listing } from '../types/api';
import ListingDetail from './ListingDetail';
import NotificationBell from './NotificationBell';
import PostFood from './PostFood';
import RequestBoard from './RequestBoard';

const listing: Listing = {
  id: 7, donor_id: 1, donor_name: 'Lanka Bakers', donor_rating: { average: 4.5, count: 2 }, food_name: 'Fresh bread', description: 'Baked today',
  category: 'bakery', quantity_total: 10, quantity_available: 6, unit: 'loaves', district: 'Colombo', area: 'Pettah',
  expires_at: '2030-01-01T18:00:00', prepared_at: null, fulfilment: 'pickup', images: [], status: 'active', created_at: null, proximity: 'same_district',
};

const request = (over: Partial<FoodRequest> = {}): FoodRequest => ({
  id: 1,
  listing: { id: 7, food_name: 'Fresh bread', unit: 'loaves', district: 'Colombo', area: 'Pettah', category: 'other', image: null, status: 'active', expires_at: '2030-01-01T18:00:00', fulfilment: 'pickup' },
  quantity_requested: 3, message: null, status: 'pending', decline_reason: null, created_at: '2030-01-01T10:00:00', responded_at: null,
  collected_at: null, completed_at: null,
  recipient: { id: 2, name: 'Nimali', kind: 'person', org_name: null, district: 'Gampaha' },
  donor: { id: 1, name: 'Lanka Bakers' }, i_am: 'donor', can_rate: false, ...over,
});

interface Call { url: string; method: string; body?: string }
function mockApi(routes: Record<string, unknown>) {
  const calls: Call[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method ?? 'GET', body: init?.body as string | undefined });
    const key = Object.keys(routes).find((k) => url.includes(k));
    const body = key ? routes[key] : { success: true };
    return { ok: true, status: 200, json: () => Promise.resolve(body) };
  }));
  return calls;
}

function wrap(ui: React.ReactNode, path = '/') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <LanguageProvider><AuthProvider><MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter></AuthProvider></LanguageProvider>
    </QueryClientProvider>,
  );
}

const signIn = (role: string, extra: object = {}) => {
  localStorage.setItem('user', JSON.stringify({ id: 2, name: 'Nimali', email: 'n@example.com', role, status: 'active', district: 'Gampaha', ...extra }));
  localStorage.setItem('se_token', 'tok');
};

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('RequestBoard', () => {
  it('lets a donor accept a pending request, and decline only with a reason', async () => {
    const calls = mockApi({});
    const user = userEvent.setup();
    wrap(<RequestBoard requests={[request()]} notify={() => {}} />);
    await user.click(screen.getByRole('button', { name: /decline/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /^decline$/i }));
    expect(await within(dialog).findByText(/write a reason/i)).toBeInTheDocument();
    expect(calls.some((c) => c.url.includes('/respond'))).toBe(false);
    await user.type(within(dialog).getByRole('textbox'), 'Gave it away');
    await user.click(within(dialog).getByRole('button', { name: /^decline$/i }));
    await waitFor(() => expect(calls.some((c) => c.url.endsWith('/api/requests/1/respond') && c.body?.includes('Gave it away'))).toBe(true));
  });

  it('hides contact details until a request is accepted, then shows each side the other', () => {
    const pending = request({ recipient: { id: 2, name: 'Nimali', kind: 'person', org_name: null, district: 'Gampaha' } });
    const { unmount } = wrap(<RequestBoard requests={[pending]} notify={() => {}} />);
    expect(screen.queryByTestId('contact-box')).toBeNull();
    unmount();
    const accepted = request({ status: 'accepted', recipient: { id: 2, name: 'Nimali', kind: 'person', org_name: null, district: 'Gampaha', phone: '0773334444', email: 'n@x.lk' } });
    wrap(<RequestBoard requests={[accepted]} notify={() => {}} />);
    expect(screen.getByTestId('contact-box')).toHaveTextContent('0773334444');
  });

  it('gives a recipient cancel but not accept, and offers rating once completed', async () => {
    const user = userEvent.setup();
    const calls = mockApi({});
    wrap(<RequestBoard requests={[request({ i_am: 'recipient' }), request({ id: 2, i_am: 'recipient', status: 'completed', can_rate: true })]} notify={() => {}} />);
    expect(screen.queryByRole('button', { name: /^accept$/i })).toBeNull();
    expect(screen.getAllByRole('button', { name: /^cancel$/i })).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: /rate/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /send rating/i }));
    expect(await within(dialog).findByText(/choose 1 to 5 stars/i)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('radio', { name: '4' }));
    await user.click(within(dialog).getByRole('button', { name: /send rating/i }));
    await waitFor(() => expect(calls.some((c) => c.url.endsWith('/api/ratings') && c.body?.includes('"score":4'))).toBe(true));
  });
});

describe('ListingDetail', () => {
  const routes = (l: Listing) => ({ '/api/listings/7': { success: true, listing: l }, '/api/auth/me': { success: true, user: JSON.parse(localStorage.getItem('user') ?? 'null') } });
  const page = () => wrap(<Routes><Route path="/listings/:id" element={<ListingDetail />} /></Routes>, '/listings/7');

  it('shows a guest the place but no private details, and asks them to sign in', async () => {
    mockApi(routes(listing));
    page();
    expect(await screen.findByRole('heading', { name: 'Fresh bread' })).toBeInTheDocument();
    expect(screen.getByText(/Pettah/)).toBeInTheDocument();
    expect(screen.getByText(/only after they accept/i)).toBeInTheDocument();
    expect(screen.getByText(/sign in to request/i)).toBeInTheDocument();
    expect(screen.queryByTestId('contact-box')).toBeNull();
  });

  it('lets a recipient pick a quantity up to what remains and sends it', async () => {
    signIn('recipient');
    const calls = mockApi({ ...routes(listing), '/api/requests': { success: true, message: 'Sent', request: request() } });
    const user = userEvent.setup();
    page();
    await screen.findByRole('heading', { name: 'Fresh bread' });
    const plus = screen.getByRole('button', { name: '+' });
    for (let i = 0; i < 10; i++) await user.click(plus);          // can never exceed the 6 left
    expect(screen.getByLabelText('Quantity')).toHaveValue(6);
    expect(plus).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /send request/i }));
    await waitFor(() => expect(calls.find((c) => c.url.endsWith('/api/requests') && c.method === 'POST')?.body).toContain('"quantity_requested":6'));
  });

  it('shows the donor contact block when the server includes it', async () => {
    signIn('recipient');
    mockApi(routes({ ...listing, contact: { name: 'Lanka Bakers', phone: '0112445210', email: 'b@x.lk', address: '12 Lane, Pettah' } }));
    page();
    expect(await screen.findByTestId('contact-box')).toHaveTextContent('0112445210');
    expect(screen.queryByText(/only after they accept/i)).toBeNull();
  });

  it('explains that an unapproved NGO must wait', async () => {
    signIn('ngo', { ngo_status: 'pending' });
    mockApi(routes(listing));
    page();
    expect(await screen.findByText(/waiting for admin approval/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /send request/i })).toBeNull();
  });
});

describe('PostFood', () => {
  it('turns non-donors away and validates the form before sending anything', async () => {
    signIn('recipient');
    mockApi({});
    const { unmount } = wrap(<PostFood />);
    expect(screen.getByText(/only donor accounts/i)).toBeInTheDocument();
    unmount();

    localStorage.clear();
    signIn('donor', { district: 'Colombo' });
    const calls = mockApi({ '/api/meta': { success: true, districts: ['Colombo'], categories: ['bakery'], units: ['kg'], fulfilment: [], event_types: [], neighbours: {} } });
    const user = userEvent.setup();
    wrap(<PostFood />);
    await user.click(screen.getByRole('button', { name: /publish my listing/i }));
    for (const msg of [/what the food is/i, /choose a food type/i, /quantity above 0/i, /at least one photo/i, /confirm the food is safe/i]) {
      expect(await screen.findByText(msg)).toBeInTheDocument();
    }
    expect(calls.some((c) => c.url.endsWith('/api/listings') && c.method === 'POST')).toBe(false);
  });
});

describe('NotificationBell', () => {
  it('shows the unread count and opens the notification a click refers to', async () => {
    signIn('recipient');
    const calls = mockApi({
      '/api/notifications': { success: true, unread: 2, notifications: [
        { id: 5, kind: 'new_listing', title: 'New food near you', body: '10 kg in Gampaha', link: '/listings/7', is_read: false, created_at: '2030-01-01T10:00:00' }] },
    });
    const user = userEvent.setup();
    wrap(<Routes><Route path="/" element={<NotificationBell />} /><Route path="/listings/:id" element={<p>listing page</p>} /></Routes>);
    expect(await screen.findByTestId('bell-count')).toHaveTextContent('2');
    await user.click(screen.getByRole('button', { name: /notifications/i }));
    await user.click(await screen.findByRole('menuitem', { name: /new food near you/i }));
    expect(await screen.findByText('listing page')).toBeInTheDocument();
    expect(calls.some((c) => c.url.endsWith('/api/notifications/5/read') && c.method === 'POST')).toBe(true);
  });
});

describe('accessibility fixes from the audit', () => {
  it('the login dialog is a labelled modal whose fields have names', async () => {
    mockApi({});
    const { default: LoginModal } = await import('../LoginModal.jsx');
    wrap(<LoginModal onClose={() => {}} onLoginSuccess={() => {}} onSwitchToSignup={() => {}} onForgotPassword={() => {}} />);
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).getByLabelText(/email/i)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/^password$/i)).toBeInTheDocument();
  });

  it('district filters announce themselves', async () => {
    mockApi({ '/api/meta': { success: true, districts: ['Colombo'], categories: [], units: [], fulfilment: [], event_types: [], neighbours: {} } });
    const { DistrictSelect } = await import('./ui');
    wrap(<DistrictSelect value="" onChange={() => {}} allLabel="All districts" />);
    expect(await screen.findByRole('combobox', { name: /district/i })).toBeInTheDocument();
  });

  it('account settings labels focus their fields', async () => {
    signIn('recipient');
    mockApi({ '/api/meta': { success: true, districts: ['Gampaha'], categories: [], units: [], fulfilment: [], event_types: [], neighbours: {} },
      '/api/auth/me': { success: true, user: JSON.parse(localStorage.getItem('user') ?? 'null') } });
    const { default: AccountSettings } = await import('./AccountSettings');
    wrap(<AccountSettings />);
    expect(await screen.findByLabelText(/full name/i)).toHaveValue('Nimali');
    expect(screen.getByLabelText(/current password/i)).toHaveAttribute('type', 'password');
  });
});
