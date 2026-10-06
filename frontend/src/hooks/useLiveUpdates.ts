import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { API_BASE } from '../config';
import { keys } from './queries';

/** Fired on `window` for every live signal, so pages that don't use TanStack Query (the admin panel) can refetch. */
export const LIVE_EVENT = 'se:live';

type Topic = 'listings' | 'requests' | 'feedback';

/**
 * Subscribes to the server's live-update stream (Server-Sent Events) and refreshes whatever
 * data the change affects. The stream carries only "X changed" signals, never data, and the
 * browser reconnects by itself if the connection drops. Mount once, near the app root.
 */
export function useLiveUpdates() {
  const qc = useQueryClient();

  useEffect(() => {
    if (typeof EventSource === 'undefined') return;
    const source = new EventSource(`${API_BASE}/api/events`);

    source.onmessage = (e: MessageEvent<string>) => {
      let topic: Topic | undefined;
      try {
        topic = (JSON.parse(e.data) as { topic: Topic }).topic;
      } catch {
        return;
      }
      if (topic === 'listings') qc.invalidateQueries({ queryKey: keys.listings });
      if (topic === 'requests') qc.invalidateQueries({ queryKey: keys.requests });
      if (topic === 'feedback') qc.invalidateQueries({ queryKey: keys.feedback });
      qc.invalidateQueries({ queryKey: keys.stats });
      window.dispatchEvent(new CustomEvent(LIVE_EVENT, { detail: topic }));
    };

    return () => source.close();
  }, [qc]);
}
