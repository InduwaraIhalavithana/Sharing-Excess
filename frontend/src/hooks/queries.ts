import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import type { Attendee, CommunityEvent, Feedback, ListingsPage, RequestsResponse } from '../types/api';

/** Query keys in one place so invalidation stays consistent. */
export const keys = {
  listings: ['listings'] as const,
  requests: ['requests'] as const,
  feedback: ['feedback'] as const,
  stats: ['public-stats'] as const,
  events: ['events'] as const,
};

export interface PublicStats {
  success: boolean;
  listings_available: number;
  requests_open: number;
  meals_delivered: number;
  donors: number;
  recipients: number;
  listings_shared: number;
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


// ── Community events ─────────────────────────────────────────────────────────

export interface EventInput {
  title: string;
  description: string;
  location: string;
  starts_at: string;
  ends_at: string | null;
  capacity: number | null;
}

/** Everyone sees events; when signed in, each one also says whether *you* joined. */
export function useEvents() {
  return useQuery({
    queryKey: keys.events,
    queryFn: () => api<{ success: boolean; events: CommunityEvent[] }>('/api/community-events'),
    staleTime: 15_000,
  });
}

export function useJoinEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, join }: { id: number; join: boolean }) =>
      api<{ success: boolean; message: string }>(`/api/community-events/${id}/join`, { method: join ? 'POST' : 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.events }),
  });
}

export function useSubscribeToEvents() {
  return useMutation({
    mutationFn: (email: string) =>
      api<{ success: boolean }>('/api/community-events/subscribe', { method: 'POST', body: JSON.stringify({ email }) }),
  });
}

/** Staff: create (no id) or update (id) an event. */
export function useSaveEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id?: number; data: EventInput }) =>
      api<{ success: boolean; event: CommunityEvent }>(id ? `/api/community-events/${id}` : '/api/community-events', {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.events }),
  });
}

export function useDeleteEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<{ success: boolean }>(`/api/community-events/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.events }),
  });
}

export function useAttendees(eventId: number | null) {
  return useQuery({
    queryKey: [...keys.events, 'attendees', eventId],
    queryFn: () => api<{ success: boolean; attendees: Attendee[] }>(`/api/community-events/${eventId}/attendees`),
    enabled: eventId !== null,
  });
}
