import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { API_BASE } from '../config';
import { keys } from './queries';
import { startLiveFeed } from './liveFeed';

/**
 * Subscribes to the server's live-update stream (Server-Sent Events) and refreshes whatever
 * data the change affects. The stream carries only "X changed" signals, never data, and the
 * browser reconnects by itself if the connection drops. Mount once, near the app root.
 *
 * All tabs of the same browser share one connection (see liveFeed.ts).
 */
export function useLiveUpdates() {
  const qc = useQueryClient();

  useEffect(() => {
    return startLiveFeed(`${API_BASE}/api/events`, (topic) => {
      if (topic === 'listings') qc.invalidateQueries({ queryKey: keys.listings });
      if (topic === 'requests') qc.invalidateQueries({ queryKey: keys.requests });
      if (topic === 'feedback') qc.invalidateQueries({ queryKey: keys.admin });
      if (topic === 'notifications') qc.invalidateQueries({ queryKey: keys.notifications });
      if (topic === 'events') qc.invalidateQueries({ queryKey: keys.events });
      qc.invalidateQueries({ queryKey: keys.stats });
    });
  }, [qc]);
}
