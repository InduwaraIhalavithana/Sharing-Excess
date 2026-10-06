import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import type { Feedback, ListingsPage, RequestsResponse } from '../types/api';

/** Query keys in one place so invalidation stays consistent. */
export const keys = {
  listings: ['listings'] as const,
  requests: ['requests'] as const,
  feedback: ['feedback'] as const,
  stats: ['public-stats'] as const,
};

export interface PublicStats {
  success: boolean;
  listings_available: number;
  requests_open: number;
  meals_delivered: number;
  donors: number;
  recipients: number;
}

// ── Public data ──────────────────────────────────────────────────────────────

/** Approved, available listings. `q` is the optional search text. */
export function usePublicListings(opts: { q?: string; limit?: number } = {}) {
  const { q = '', limit = 20 } = opts;
  const params = new URLSearchParams({ limit: String(limit) });
  if (q.trim()) params.set('q', q.trim());
  return useQuery({
    queryKey: [...keys.listings, 'public', q.trim(), limit],
    queryFn: () => api<ListingsPage>(`/api/listings?${params}`),
    placeholderData: keepPreviousData, // keep old cards on screen while a new search loads
  });
}

export function usePublicStats() {
  return useQuery({ queryKey: keys.stats, queryFn: () => api<PublicStats>('/api/public/stats'), staleTime: 60_000 });
}

export function useFeedbackList() {
  return useQuery({
    queryKey: keys.feedback,
    queryFn: () => api<{ success: boolean; feedback: Feedback[] }>('/api/feedback'),
  });
}

// ── Signed-in data ───────────────────────────────────────────────────────────

/** The donor's incoming-requests board. Refreshes itself every 30 seconds. */
export function useDonorRequests(enabled: boolean) {
  return useQuery({
    queryKey: [...keys.requests, 'donor-board'],
    queryFn: () => api<RequestsResponse>('/api/requests?donor_view=true'),
    enabled,
    refetchInterval: 30_000,
  });
}

/** Every listing owned by the donor, including pending-review and rejected ones. */
export function useMyListings(donorId: number | undefined) {
  return useQuery({
    queryKey: [...keys.listings, 'mine', donorId],
    queryFn: () => api<ListingsPage>(`/api/listings?donor_id=${donorId}&limit=100`),
    enabled: donorId != null,
    refetchInterval: 30_000,
  });
}

export function useMyRequests(recipientId: number | undefined) {
  return useQuery({
    queryKey: [...keys.requests, 'mine', recipientId],
    queryFn: () => api<RequestsResponse>(`/api/requests?recipient_id=${recipientId}`),
    enabled: recipientId != null,
    refetchInterval: 30_000,
  });
}

// ── Mutations ────────────────────────────────────────────────────────────────

/** Anything that changes requests or listings refreshes both lists. */
function useRefreshAfter() {
  const qc = useQueryClient();
  return () => Promise.all([
    qc.invalidateQueries({ queryKey: keys.requests }),
    qc.invalidateQueries({ queryKey: keys.listings }),
    qc.invalidateQueries({ queryKey: keys.stats }),
  ]);
}

export function useRespondToRequest() {
  const refresh = useRefreshAfter();
  return useMutation({
    mutationFn: ({ requestId, status }: { requestId: number; status: 'accepted' | 'declined' }) =>
      api<{ success: boolean }>(`/api/requests/${requestId}/respond`, {
        method: 'PUT',
        body: JSON.stringify({ request_id: requestId, status }),
      }),
    onSuccess: refresh,
  });
}

export function useUpdateRequestStatus() {
  const refresh = useRefreshAfter();
  return useMutation({
    mutationFn: ({ requestId, status }: { requestId: number; status: string }) =>
      api<{ success: boolean }>(`/api/requests/${requestId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ request_id: requestId, status }),
      }),
    onSuccess: refresh,
  });
}

export function useDeleteRequest() {
  const refresh = useRefreshAfter();
  return useMutation({
    mutationFn: (requestId: number) => api<{ success: boolean }>(`/api/requests/${requestId}`, { method: 'DELETE' }),
    onSuccess: refresh,
  });
}

export function useDeleteListing() {
  const refresh = useRefreshAfter();
  return useMutation({
    mutationFn: (listingId: number) => api<{ success: boolean }>(`/api/listings/${listingId}`, { method: 'DELETE' }),
    onSuccess: refresh,
  });
}

/** POST a multipart form (listing / request with an optional photo). */
export function useCreateWithForm(path: '/api/listings' | '/api/requests') {
  const refresh = useRefreshAfter();
  return useMutation({
    mutationFn: (form: FormData) => api<{ success: boolean; message?: string }>(path, { method: 'POST', body: form }),
    onSuccess: refresh,
  });
}
