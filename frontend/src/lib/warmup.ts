import {
  eventsOptions, metaOptions, myListingsOptions, myRequestsOptions, ngoDirectoryOptions, notificationsOptions,
  publicListingsOptions, publicStatsOptions,
} from '../hooks/queries';
import { queryClient } from './queryClient';

/**
 * Fill the cache for the pages people open first, so they appear complete instead of flashing grey skeletons.
 * The option objects are the very ones the page hooks use, so the cache keys always match.
 */
export function warmPublicData(): void {
  const q = queryClient;
  void q.prefetchQuery(metaOptions());
  void q.prefetchQuery(publicStatsOptions());
  void q.prefetchQuery(publicListingsOptions({ limit: 6 })); // home
  void q.prefetchQuery(publicListingsOptions({ q: '', district: '', near: '', category: '', fulfilment: '', limit: 24 })); // Find Food
  void q.prefetchQuery(eventsOptions({ event_type: '', district: '' }));
  void q.prefetchQuery(ngoDirectoryOptions({ q: '', district: '' }));
}

/** What each dashboard asks for first, fetched as soon as we know who is signed in. */
export function warmRoleData(user: { id: number; role: string }): void {
  const q = queryClient;
  if (user.role === 'admin') return;
  void q.prefetchQuery(notificationsOptions());
  if (user.role === 'donor') {
    void q.prefetchQuery(myListingsOptions(user.id));
    void q.prefetchQuery(myRequestsOptions());
    return;
  }
  void q.prefetchQuery(myRequestsOptions());
  void q.prefetchQuery(publicListingsOptions({ limit: 1 }));
  void q.prefetchQuery(publicListingsOptions({ q: '', category: '', limit: 48 })); // "food near me"
  if (user.role === 'ngo') void q.prefetchQuery(eventsOptions({ owner_id: user.id }));
}
