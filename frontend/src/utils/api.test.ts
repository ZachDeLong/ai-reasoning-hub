import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchCategories, fetchPapers } from './api';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchPapers', () => {
  it('forwards an abort signal and parses a successful response', async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      papers: [],
      total_pages: 1,
      results_count: 0,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchPapers('page=2', controller.signal)).resolves.toMatchObject({
      total_pages: 1,
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/papers?page=2', {
      signal: controller.signal,
    });
  });

  it('rejects HTTP failures instead of parsing them as paper data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: 'database unavailable' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    )));

    await expect(fetchPapers('page=0')).rejects.toThrow('Failed to fetch papers');
  });
});

describe('fetchCategories', () => {
  it('forwards cancellation to category requests', async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn().mockResolvedValue(new Response('[]', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchCategories(controller.signal)).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledWith('/api/categories', {
      signal: controller.signal,
    });
  });
});
