import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ContactForm from './ContactForm';

function renderForm() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ContactForm />
    </QueryClientProvider>,
  );
}

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/your name/i), 'Nimali Perera');
  await user.type(screen.getByLabelText(/email address/i), 'nimali@example.com');
  await user.type(screen.getByLabelText(/message/i), 'We would like to donate surplus bread every Friday.');
}

afterEach(() => vi.unstubAllGlobals());

describe('ContactForm', () => {
  it('shows field errors and sends nothing when the form is empty', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole('button', { name: /send message/i }));
    expect(await screen.findByText(/please enter your name/i)).toBeInTheDocument();
    expect(screen.getByText(/valid email address/i)).toBeInTheDocument();
    expect(screen.getByText(/at least a few words/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows the thank-you message after the server accepts it', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ success: true }) }));
    const user = userEvent.setup();
    renderForm();
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: /send message/i }));
    expect(await screen.findByText(/thank you for reaching out/i)).toBeInTheDocument();
  });

  it('does NOT claim success when the server cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const user = userEvent.setup();
    renderForm();
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: /send message/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/has not been sent/i));
    expect(screen.queryByText(/thank you for reaching out/i)).not.toBeInTheDocument();
    // what the visitor typed is still there, so nothing is lost
    expect(screen.getByLabelText(/your name/i)).toHaveValue('Nimali Perera');
  });
});
