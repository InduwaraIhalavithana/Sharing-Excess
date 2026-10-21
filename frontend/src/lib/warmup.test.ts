import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eventsOptions, metaOptions, myRequestsOptions, ngoDirectoryOptions, publicListingsOptions, publicStatsOptions } from '../hooks/queries';
import { queryClient } from './queryClient';
import { warmPublicData, warmRoleData } from './warmup';

describe('warm-up', () => {
  beforeEach(() => {
    queryClient.clear();
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ success: true, listings: [], events: [], ngos: [], requests: [] }) })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('fills the cache entries the first pages read, so they open without a skeleton', async () => {
    warmPublicData();
    await vi.waitFor(() => {
      for (const o of [
        metaOptions(), publicStatsOptions(),
        publicListingsOptions({ limit: 6 }),
        publicListingsOptions({ q: '', district: '', near: '', category: '', fulfilment: '', limit: 24 }),
        eventsOptions({ event_type: '', district: '' }),
        ngoDirectoryOptions({ q: '', district: '' }),
      ]) expect(queryClient.getQueryData(o.queryKey)).toBeDefined();
    });
  });

  it('warms a signed-in role without touching the admin', async () => {
    warmRoleData({ id: 7, role: 'recipient' });
    await vi.waitFor(() => expect(queryClient.getQueryData(myRequestsOptions().queryKey)).toBeDefined());
    (fetch as unknown as ReturnType<typeof vi.fn>).mockClear();
    warmRoleData({ id: 1, role: 'admin' });
    expect(fetch).not.toHaveBeenCalled();
  });
});
