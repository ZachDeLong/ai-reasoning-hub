import type { PapersResponse, StatsResponse } from '@/types';

export const fetchPapers = async (queryString: string): Promise<PapersResponse> => {
  const response = await fetch(`/api/papers?${queryString}`);
  if (!response.ok) {
    throw new Error('Failed to fetch papers');
  }
  return response.json();
};

export const fetchCategories = async (): Promise<string[]> => {
  const response = await fetch('/api/categories');
  if (!response.ok) {
    throw new Error('Failed to fetch categories');
  }
  return response.json();
};

export const fetchStats = async (): Promise<StatsResponse> => {
  const response = await fetch('/api/papers/stats');
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
