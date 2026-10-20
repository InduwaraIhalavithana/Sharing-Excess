/**
 * One live-update connection per browser, not per tab.
 *
 * A browser allows only ~6 simultaneous connections to one server, and every open tab used to hold a
 * Server-Sent Events stream forever - with a few tabs open the page's normal requests queued behind them.
 *
 * Now the tabs elect a leader with the Web Locks API: the leader opens the single EventSource and relays each
 * message to the other tabs over a BroadcastChannel. When the leader tab closes, the browser releases its lock
 * and the next waiting tab takes over. Browsers without these APIs fall back to one stream per tab.
 */
export type Topic = 'listings' | 'requests' | 'feedback' | 'events' | 'notifications';

const LOCK_NAME = 'se-live-leader';
const CHANNEL_NAME = 'se-live';

/** The browser features we use, injectable so the election logic can be tested without a browser. */
export interface LiveEnv {
  EventSource?: typeof EventSource;
  BroadcastChannel?: typeof BroadcastChannel;
  locks?: LockManager;
}

function browserEnv(): LiveEnv {
  return {
    EventSource: typeof EventSource === 'undefined' ? undefined : EventSource,
    BroadcastChannel: typeof BroadcastChannel === 'undefined' ? undefined : BroadcastChannel,
    locks: typeof navigator !== 'undefined' ? navigator.locks : undefined,
  };
}

function parseTopic(data: string): Topic | undefined {
  try {
    return (JSON.parse(data) as { topic: Topic }).topic;
  } catch {
    return undefined;
  }
}

/** Starts listening; call the returned function to stop (and give up leadership). */
export function startLiveFeed(url: string, onTopic: (topic: Topic) => void, env: LiveEnv = browserEnv()): () => void {
  const { EventSource: ES, BroadcastChannel: BC, locks } = env;
  if (!ES) return () => {};

  // No way to coordinate between tabs: this tab simply keeps its own stream.
  if (!BC || !locks) {
    const source = new ES(url);
    source.onmessage = (e) => {
      const topic = parseTopic(e.data);
      if (topic) onTopic(topic);
    };
    return () => source.close();
  }

  const channel = new BC(CHANNEL_NAME);
  // Messages relayed by whichever tab is the leader (a channel never echoes to the tab that posted).
  channel.onmessage = (e: MessageEvent<{ topic: Topic }>) => {
    if (e.data?.topic) onTopic(e.data.topic);
  };

  const abort = new AbortController();
  let stopped = false;
  let stopLeading: (() => void) | undefined;

  locks
    .request(LOCK_NAME, { signal: abort.signal }, () => new Promise<void>((resolve) => {
      // Aborting does not cancel a lock the browser has ALREADY granted: its callback still runs later.
      // (React dev mode mounts, unmounts and re-mounts at once, which hits exactly this.) Hand the lock
      // straight back instead of becoming a leader that nobody can stop.
      if (stopped) {
        resolve();
        return;
      }
      // We are the leader until cleanup runs or this tab is closed (the browser then frees the lock).
      const source = new ES(url);
      source.onmessage = (e) => {
        const topic = parseTopic(e.data);
        if (!topic) return;
        onTopic(topic);
        channel.postMessage({ topic });
      };
      stopLeading = () => {
        source.close();
        resolve();
      };
    }))
    .catch(() => {
      /* aborted while waiting to become leader: nothing to clean up */
    });

  return () => {
    stopped = true;
    abort.abort();
    stopLeading?.();
    channel.close();
  };
}
