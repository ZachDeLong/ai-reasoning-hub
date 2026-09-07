import type { PapersResponse, StatsResponse } from '@/types';

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
  return response.json();
};

export const fetchBibtex = async (arxivId: string): Promise<string> => {
  const response = await fetch(`/api/bibtex/${arxivId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch BibTeX');
  }
  return response.text();
};
