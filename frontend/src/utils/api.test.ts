import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchCategories, fetchPapers, fetchStats, parseStatsResponse } from './api';

const statsPaper = {
  id: 1,
  title: 'Reasoning Paper',
  authors: 'Ada Lovelace',
  date: '2026-09-07',
  reasoning_category: 'Reasoning',
  arxiv_link: 'https://arxiv.org/abs/2609.00001',
  excitement_score: 6,
  score_breakdown: 'Novelty: 2, Utility: 1, Results: 2, Access: 1',
};

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

describe('fetchStats', () => {
  it('forwards cancellation to the all-papers statistics request', async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ papers: [statsPaper] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchStats(controller.signal)).resolves.toEqual({ papers: [statsPaper] });
    expect(fetchMock).toHaveBeenCalledWith('/api/papers/stats', {
      signal: controller.signal,
    });
  });

  it('rejects malformed successful responses instead of passing them to Trends', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      papers: [{ ...statsPaper, date: 'not-a-date' }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })));

    await expect(fetchStats()).rejects.toThrow('Invalid stats response');
  });
});

describe('parseStatsResponse', () => {
  it('accepts the lightweight stats endpoint shape', () => {
    expect(parseStatsResponse({ papers: [statsPaper] })).toEqual({ papers: [statsPaper] });
  });

  it.each([
    { papers: 'not-an-array' },
    { papers: [{ ...statsPaper, excitement_score: 8 }] },
    { papers: [{ ...statsPaper, authors: null }] },
    { papers: [{ ...statsPaper, id: 1.5 }] },
  ])('rejects invalid stats payload %#', payload => {
    expect(() => parseStatsResponse(payload)).toThrow('Invalid stats response');
  });
});
