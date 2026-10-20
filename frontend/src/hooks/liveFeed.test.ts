import { describe, expect, it, vi } from 'vitest';
import { startLiveFeed, type LiveEnv, type Topic } from './liveFeed';

/** A tiny stand-in for the browser's shared state: one lock manager and one broadcast hub for ALL fake tabs. */
function makeBrowser() {
  const sources: FakeSource[] = [];
  const channels = new Set<FakeChannel>();
  const queue: { cb: () => Promise<void>; resolve: () => void; reject: (e: unknown) => void; signal?: AbortSignal }[] = [];
  let held = false;

  class FakeSource {
    onmessage: ((e: { data: string }) => void) | null = null;
    closed = false;
    constructor(public url: string) {
      sources.push(this);
    }
    close() {
      this.closed = true;
    }
    emit(topic: string) {
      if (!this.closed) this.onmessage?.({ data: JSON.stringify({ topic }) });
    }
  }

  class FakeChannel {
    onmessage: ((e: { data: unknown }) => void) | null = null;
    constructor() {
      channels.add(this);
    }
    closed = false;
    postMessage(data: unknown) {
      // a real closed BroadcastChannel throws, which is what kills a zombie leader's relay
      if (this.closed) throw new DOMException('Channel is closed', 'InvalidStateError');
      for (const c of channels) if (c !== this) c.onmessage?.({ data });
    }
    close() {
      this.closed = true;
      channels.delete(this);
    }
  }

  function grantNext() {
    if (held) return;
    const next = queue.shift();
    if (!next) return;
    held = true;
    // Like a real browser, the callback runs in a LATER task - after the grant. An abort that arrives in
    // between can no longer remove the request, which is exactly the race the production code must survive.
    setTimeout(() => {
      next.cb().finally(() => {
        held = false;
        next.resolve();
        grantNext();
      });
    }, 0);
  }

  const locks = {
    request(_name: string, opts: { signal?: AbortSignal }, cb: () => Promise<void>) {
      return new Promise<void>((resolve, reject) => {
        const entry = { cb, resolve, reject, signal: opts.signal };
        opts.signal?.addEventListener('abort', () => {
          const i = queue.indexOf(entry);
          if (i >= 0) {
            queue.splice(i, 1);
            reject(new DOMException('aborted', 'AbortError'));
          }
        });
        queue.push(entry);
        grantNext();
      });
    },
  };

  const env: LiveEnv = {
    EventSource: FakeSource as unknown as typeof EventSource,
    BroadcastChannel: FakeChannel as unknown as typeof BroadcastChannel,
    locks: locks as unknown as LockManager,
  };
  return { env, sources };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('startLiveFeed', () => {
  it('opens ONE stream however many tabs are open, and every tab hears it', async () => {
    const { env, sources } = makeBrowser();
    const a: Topic[] = [], b: Topic[] = [], c: Topic[] = [];
    const stopA = startLiveFeed('/events', (t) => a.push(t), env);
    const stopB = startLiveFeed('/events', (t) => b.push(t), env);
    const stopC = startLiveFeed('/events', (t) => c.push(t), env);
    await tick();

    expect(sources).toHaveLength(1);
    sources[0].emit('listings');
    expect([a, b, c]).toEqual([['listings'], ['listings'], ['listings']]);
    [stopA, stopB, stopC].forEach((s) => s());
  });

  it('hands the stream to another tab when the leader goes away', async () => {
    const { env, sources } = makeBrowser();
    const b: Topic[] = [];
    const stopLeader = startLiveFeed('/events', () => {}, env);
    const stopB = startLiveFeed('/events', (t) => b.push(t), env);
    await tick();
    await tick();
    expect(sources).toHaveLength(1);

    stopLeader(); // the leader tab closes
    await tick();
    await tick();
    expect(sources[0].closed).toBe(true);
    expect(sources).toHaveLength(2); // tab B took over

    sources[1].emit('requests');
    expect(b).toEqual(['requests']);
    stopB();
  });

  it('a tab that stops while still waiting never opens a stream', async () => {
    const { env, sources } = makeBrowser();
    const stopLeader = startLiveFeed('/events', () => {}, env);
    const stopWaiting = startLiveFeed('/events', () => {}, env);
    await tick();
    await tick();
    stopWaiting();
    stopLeader();
    await tick();
    expect(sources).toHaveLength(1);
  });

  it('a tab that is stopped right after starting (React dev remount) never becomes a zombie leader', async () => {
    const { env, sources } = makeBrowser();
    const heard: Topic[] = [];
    const firstMountHeard = vi.fn();
    // mount -> unmount -> mount in the same tick, as React StrictMode does
    const stopFirst = startLiveFeed('/events', firstMountHeard, env);
    stopFirst();
    const stopSecond = startLiveFeed('/events', (t) => heard.push(t), env);
    await tick();
    await tick();

    expect(sources).toHaveLength(1); // only the second mount opened a stream
    expect(sources[0].closed).toBe(false);
    sources[0].emit('events');
    expect(heard).toEqual(['events']);
    expect(firstMountHeard).not.toHaveBeenCalled(); // the dead first mount must not still be listening
    stopSecond();
  });

  it('after a stopped tab hands the lock back, another tab can lead and relay', async () => {
    const { env, sources } = makeBrowser();
    const stopGone = startLiveFeed('/events', () => {}, env);
    stopGone(); // stopped before its grant was delivered
    const heardB: Topic[] = [];
    const stopB = startLiveFeed('/events', (t) => heardB.push(t), env);
    const heardC: Topic[] = [];
    const stopC = startLiveFeed('/events', (t) => heardC.push(t), env);
    await tick();
    await tick();
    sources[sources.length - 1].emit('listings');
    expect(heardB).toEqual(['listings']);
    expect(heardC).toEqual(['listings']); // relayed to the other tab
    stopB();
    stopC();
  });

  it('ignores garbage messages', async () => {
    const { env, sources } = makeBrowser();
    const got = vi.fn();
    const stop = startLiveFeed('/events', got, env);
    await tick();
    sources[0].onmessage?.({ data: 'not json' });
    expect(got).not.toHaveBeenCalled();
    stop();
  });

  it('falls back to a stream per tab when the browser cannot coordinate', () => {
    const { env, sources } = makeBrowser();
    const noLocks: LiveEnv = { EventSource: env.EventSource };
    const got: Topic[] = [];
    const stop1 = startLiveFeed('/events', (t) => got.push(t), noLocks);
    const stop2 = startLiveFeed('/events', () => {}, noLocks);
    expect(sources).toHaveLength(2);
    sources[0].emit('events');
    expect(got).toEqual(['events']);
    stop1();
    stop2();
    expect(sources.every((s) => s.closed)).toBe(true);
  });

  it('does nothing where EventSource does not exist', () => {
    const stop = startLiveFeed('/events', vi.fn(), {});
    expect(() => stop()).not.toThrow();
  });
});
