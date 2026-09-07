import type { PapersResponse, StatsPaper, StatsResponse } from '@/types';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isStatsPaper = (value: unknown): value is StatsPaper => {
  if (!isRecord(value)) return false;

  const stringFields = [
    'title',
    'authors',
    'date',
    'reasoning_category',
    'arxiv_link',
    'score_breakdown',
  ] as const;
  if (!stringFields.every(field => typeof value[field] === 'string')) return false;

  const score = value.excitement_score;
  if (typeof score !== 'number' || !Number.isInteger(score) || score < 0 || score > 7) return false;
  if (typeof value.id !== 'number' || !Number.isSafeInteger(value.id)) return false;

  const date = value.date;
  return typeof date === 'string' && (date === '' || !Number.isNaN(Date.parse(date)));
};

export const parseStatsResponse = (value: unknown): StatsResponse => {
  if (!isRecord(value) || !Array.isArray(value.papers) || !value.papers.every(isStatsPaper)) {
    throw new Error('Invalid stats response');
  }
  return { papers: value.papers };
};

export const fetchPapers = async (
  queryString: string,
  signal?: AbortSignal,
): Promise<PapersResponse> => {
  const response = await fetch(`/api/papers?${queryString}`, { signal });
  if (!response.ok) {
    throw new Error('Failed to fetch papers');
  }
  return response.json();
};

export const fetchCategories = async (signal?: AbortSignal): Promise<string[]> => {
  const response = await fetch('/api/categories', { signal });
  if (!response.ok) {
    throw new Error('Failed to fetch categories');
  }
  return response.json();
};

export const fetchStats = async (signal?: AbortSignal): Promise<StatsResponse> => {
  const response = await fetch('/api/papers/stats', { signal });
  if (!response.ok) {
    throw new Error('Failed to fetch stats');
  }
  return parseStatsResponse(await response.json());
};

export const fetchBibtex = async (arxivId: string): Promise<string> => {
  const response = await fetch(`/api/bibtex/${arxivId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch BibTeX');
  }
  return response.text();
};
