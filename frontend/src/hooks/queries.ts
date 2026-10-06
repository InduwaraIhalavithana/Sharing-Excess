import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import type {
  AppNotification, Attendee, CommunityEvent, FoodRequest, Listing, ListingsPage, Meta, NgoCard,
  RatingSummary, RequestsResponse,
} from '../types/api';

/** Query keys in one place so invalidation stays consistent. */
export const keys = {
  listings: ['listings'] as const,
  requests: ['requests'] as const,
  stats: ['public-stats'] as const,
  events: ['events'] as const,
  notifications: ['notifications'] as const,
  ngos: ['ngos'] as const,
  admin: ['admin'] as const,
  meta: ['meta'] as const,
};

export interface PublicStats {
  success: boolean;
  listings_available: number;
  requests_open: number;
  handovers_completed: number;
  listings_shared: number;
  districts_covered: number;
  donors: number;
  recipients: number;
  ngos: number;
  events_upcoming: number;
}

const qs = (params: Record<string, string | number | boolean | null | undefined>) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '' && v !== false) p.set(k, String(v));
  });
  const s = p.toString();
  return s ? `?${s}` : '';
};

// ── Public data ──────────────────────────────────────────────────────────────

/** The fixed lists (districts, categories, units ...) the forms and filters are built from. */
export function useMeta() {
  return useQuery({
    queryKey: keys.meta,
    queryFn: () => api<{ success: boolean } & Meta>('/api/meta'),
    staleTime: Infinity,
  });
}

export interface BrowseFilters {
  q?: string;
  district?: string;
  category?: string;
  fulfilment?: string;
  near?: string;
  limit?: number;
}

/** Active listings, same district first, then neighbours, then the rest. */
export function usePublicListings(opts: BrowseFilters = {}) {
  const { limit = 20, ...rest } = opts;
  return useQuery({
    queryKey: [...keys.listings, 'public', rest, limit],
    queryFn: () => api<ListingsPage>(`/api/listings${qs({ ...rest, q: rest.q?.trim(), limit })}`),
    placeholderData: keepPreviousData, // keep old cards on screen while a new search loads
  });
}

export function useListing(id: number | undefined) {
  return useQuery({
    queryKey: [...keys.listings, 'one', id],
    queryFn: () => api<{ success: boolean; listing: Listing }>(`/api/listings/${id}`),
    enabled: id != null,
  });
}

export function usePublicStats() {
  return useQuery({ queryKey: keys.stats, queryFn: () => api<PublicStats>('/api/public/stats'), staleTime: 60_000 });
}

export function useRatingSummary(userId: number | undefined) {
  return useQuery({
    queryKey: ['rating', userId],
    queryFn: () => api<RatingSummary>(`/api/ratings/user/${userId}`),
    enabled: userId != null,
  });
}

// ── Signed-in data ───────────────────────────────────────────────────────────

/** The donor's own listings with every status (active, sold out, expired, closed). */
export function useMyListings(donorId: number | undefined) {
  return useQuery({
    queryKey: [...keys.listings, 'mine', donorId],
    queryFn: () => api<ListingsPage>(`/api/listings?donor_id=${donorId}&limit=100`),
    enabled: donorId != null,
    refetchInterval: 30_000,
  });
}

/** Requests as the signed-in user sees them: recipients/NGOs their own, donors those on their listings. */
export function useMyRequests(enabled = true) {
  return useQuery({
    queryKey: [...keys.requests, 'mine'],
    queryFn: () => api<RequestsResponse>('/api/requests'),
    enabled,
    refetchInterval: 30_000,
  });
}

export function useNotifications(enabled: boolean) {
  return useQuery({
    queryKey: keys.notifications,
    queryFn: () => api<{ success: boolean; unread: number; notifications: AppNotification[] }>('/api/notifications?limit=20'),
    enabled,
    refetchInterval: 60_000,
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
    qc.invalidateQueries({ queryKey: keys.notifications }),
  ]);
}

export function useCreateRequest() {
  const refresh = useRefreshAfter();
  return useMutation({
    mutationFn: (body: { listing_id: number; quantity_requested: number; message: string }) =>
      api<{ success: boolean; message: string; request: FoodRequest }>('/api/requests', {
        method: 'POST', body: JSON.stringify(body),
      }),
    onSuccess: refresh,
  });
}

export function useRespondToRequest() {
  const refresh = useRefreshAfter();
  return useMutation({
    mutationFn: ({ requestId, status, reason = '' }: { requestId: number; status: 'accepted' | 'declined'; reason?: string }) =>
      api<{ success: boolean; message: string }>(`/api/requests/${requestId}/respond`, {
        method: 'PUT', body: JSON.stringify({ status, reason }),
      }),
    onSuccess: refresh,
  });
}

export type HandoverStatus = 'cancelled' | 'collected' | 'completed' | 'no_show';

export function useUpdateRequestStatus() {
  const refresh = useRefreshAfter();
  return useMutation({
    mutationFn: ({ requestId, status, reason = '' }: { requestId: number; status: HandoverStatus; reason?: string }) =>
      api<{ success: boolean; message: string }>(`/api/requests/${requestId}/status`, {
        method: 'PUT', body: JSON.stringify({ status, reason }),
      }),
    onSuccess: refresh,
  });
}

export function useRate() {
  const refresh = useRefreshAfter();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { request_id: number; score: number; comment: string }) =>
      api<{ success: boolean; message: string }>('/api/ratings', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: async () => {
      await refresh();
      qc.invalidateQueries({ queryKey: ['rating'] });
    },
  });
}

export function useReport() {
  return useMutation({
    mutationFn: (body: { target_type: 'listing' | 'user' | 'event' | 'request'; target_id: number; reason: string }) =>
      api<{ success: boolean; message: string }>('/api/reports', { method: 'POST', body: JSON.stringify(body) }),
  });
}

export function useCloseListing() {
  const refresh = useRefreshAfter();
  return useMutation({
    mutationFn: ({ id, reason = '' }: { id: number; reason?: string }) =>
      api<{ success: boolean }>(`/api/listings/${id}/close`, { method: 'POST', body: JSON.stringify({ reason }) }),
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

export function useUpdateListing() {
  const refresh = useRefreshAfter();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      api<{ success: boolean; listing: Listing }>(`/api/listings/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: refresh,
  });
}

/** POST the post-food form (multipart: fields + 1-3 photos). */
export function useCreateListing() {
  const refresh = useRefreshAfter();
  return useMutation({
    mutationFn: (form: FormData) => api<{ success: boolean; message: string; listing: Listing }>('/api/listings', { method: 'POST', body: form }),
    onSuccess: refresh,
  });
}

export function useNotificationActions() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: keys.notifications });
  return {
    markRead: useMutation({ mutationFn: (id: number) => api(`/api/notifications/${id}/read`, { method: 'POST' }), onSuccess: refresh }),
    markAll: useMutation({ mutationFn: () => api('/api/notifications/read-all', { method: 'POST' }), onSuccess: refresh }),
  };
}

// ── Community events ─────────────────────────────────────────────────────────

export interface EventInput {
  title: string;
  description: string;
  location: string;
  district: string;
  event_type: string;
  starts_at: string;
  ends_at: string | null;
  capacity: number | null;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
}

export interface EventFilters {
  event_type?: string;
  district?: string;
  q?: string;
  owner_id?: number;
}

/** Everyone sees events; when signed in, each one also says whether *you* joined. */
export function useEvents(filters: EventFilters = {}) {
  return useQuery({
    queryKey: [...keys.events, filters],
    queryFn: () => api<{ success: boolean; events: CommunityEvent[] }>(`/api/community-events${qs({ ...filters })}`),
    staleTime: 15_000,
    placeholderData: keepPreviousData,
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

/** NGO: create (no id) or update (id) an event. */
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

export function useEventAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: number; action: 'cancel' | 'delete' }) =>
      action === 'cancel'
        ? api<{ success: boolean }>(`/api/community-events/${id}/cancel`, { method: 'POST' })
        : api<{ success: boolean }>(`/api/community-events/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.events }),
  });
}

export function useEventImages() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: keys.events });
  return {
    add: useMutation({
      mutationFn: ({ id, file }: { id: number; file: File }) => {
        const form = new FormData();
        form.append('image', file);
        return api<{ success: boolean; images: string[] }>(`/api/community-events/${id}/images`, { method: 'POST', body: form });
      },
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: ({ id, url }: { id: number; url: string }) =>
        api<{ success: boolean }>(`/api/community-events/${id}/images?url=${encodeURIComponent(url)}`, { method: 'DELETE' }),
      onSuccess: refresh,
    }),
  };
}

export function useAttendees(eventId: number | null) {
  return useQuery({
    queryKey: [...keys.events, 'attendees', eventId],
    queryFn: () => api<{ success: boolean; attendees: Attendee[] }>(`/api/community-events/${eventId}/attendees`),
    enabled: eventId !== null,
  });
}

// ── NGOs ─────────────────────────────────────────────────────────────────────

export function useNgoDirectory(filters: { q?: string; district?: string } = {}) {
  return useQuery({
    queryKey: [...keys.ngos, filters],
    queryFn: () => api<{ success: boolean; ngos: NgoCard[] }>(`/api/ngos${qs({ ...filters, q: filters.q?.trim() })}`),
    placeholderData: keepPreviousData,
  });
}

// ── Admin ────────────────────────────────────────────────────────────────────

export interface AdminUser {
  id: number; name: string; email: string; role: string; status: string; district: string | null;
  location: string | null; phone_number: string | null; org_name: string | null; ngo_status: string | null;
  created_at: string | null;
  org_description?: string | null; org_logo?: string | null;
}

export interface AdminReport {
  id: number; reporter_id: number | null; reporter_name: string | null; target_type: string; target_id: number;
  reason: string; status: string; admin_note: string | null; created_at: string | null;
}

export interface AdminFeedback {
  id: number; request_id: number | null; author_id: number; author_name: string; author_role: string | null;
  rating: number | null; comment: string; image_path: string | null; admin_reply: string | null;
  feedback_status: string; created_at: string | null;
}

export interface AdminListing {
  id: number; food_name: string; category: string; status: string; district: string; quantity_total: number;
  quantity_available: number; unit: string; expires_at: string; created_at: string | null; donor_id: number;
  donor_name: string | null;
}

export interface AdminStats {
  total_users: number; users_by_role: Record<string, number>; pending_ngos: number; total_listings: number;
  listings_by_status: Record<string, number>; listings_by_district: Record<string, number>;
  total_requests: number; requests_by_status: Record<string, number>; handovers_completed: number;
  open_reports: number; open_feedback: number; upcoming_events: number;
  top_categories: { category: string; count: number }[];
  completed_by_month: { year: number; month: number; count: number }[];
}

export function useAdminData<T>(path: string, name: string, extra: Record<string, string> = {}) {
  return useQuery({
    queryKey: [...keys.admin, name, extra],
    queryFn: () => api<T>(`/api/admin/${path}${qs(extra)}`),
    refetchInterval: 60_000,
  });
}

/** Run an admin action (any method/path) and refresh everything the admin panel shows. */
export function useAdminAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ path, method = 'POST', body }: { path: string; method?: string; body?: unknown }) =>
      api<{ success: boolean; message?: string }>(`/api/admin/${path}`, {
        method, body: body === undefined ? undefined : JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.admin });
      qc.invalidateQueries({ queryKey: keys.listings });
      qc.invalidateQueries({ queryKey: keys.ngos });
      qc.invalidateQueries({ queryKey: keys.events });
      qc.invalidateQueries({ queryKey: keys.stats });
    },
  });
}
