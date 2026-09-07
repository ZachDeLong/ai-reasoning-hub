import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  fetchCategories,
  fetchPapers,
  fetchPapersByArxivIds,
  fetchStats,
  parseCategoriesResponse,
  parseStatsResponse,
} from './api';

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

const fullPaper = {
  ...statsPaper,
  arxiv_id: '2609.00001',
  tldr: 'Short summary',
  summary_md: 'Long summary',
  excitement_reasoning: 'Promising work',
  last_scored_at: '2026-09-07T12:00:00Z',
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

describe('fetchPapersByArxivIds', () => {
  it('posts saved IDs and forwards cancellation', async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      papers: [fullPaper],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchPapersByArxivIds(['2609.00001'], controller.signal)).resolves.toEqual([fullPaper]);
    expect(fetchMock).toHaveBeenCalledWith('/api/papers/by-arxiv-ids', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ arxiv_ids: ['2609.00001'] }),
      signal: controller.signal,
    });
  });

  it('rejects malformed successful responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })));

    await expect(fetchPapersByArxivIds(['2609.00001'])).rejects.toThrow('Invalid reading-list response');
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

  it('rejects malformed successful responses instead of passing them to the filter UI', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ categories: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })));

    await expect(fetchCategories()).rejects.toThrow('Invalid categories response');
  });
});

describe('parseCategoriesResponse', () => {
  it('normalizes whitespace and removes duplicate categories', () => {
    expect(parseCategoriesResponse([' Reasoning ', 'Planning', 'Reasoning'])).toEqual([
      'Reasoning',
      'Planning',
    ]);
  });

  it.each([
    null,
    { categories: ['Reasoning'] },
    ['Reasoning', 42],
    ['Reasoning', '   '],
  ])('rejects invalid category payload %#', payload => {
    expect(() => parseCategoriesResponse(payload)).toThrow('Invalid categories response');
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
