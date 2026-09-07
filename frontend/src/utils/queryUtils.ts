import type { Filters } from '@/types';

const parseSafeInteger = (value: string | null): number | null => {
  if (value === null || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
};

export const parsePageParam = (value: string | null): number => {
  const parsed = parseSafeInteger(value);
  return parsed !== null && parsed >= 0 ? parsed : 0;
};

export const parseMinScoreParam = (value: string | null, fallback: number): number => {
  const parsed = parseSafeInteger(value);
  return parsed !== null && parsed >= 0 && parsed <= 7 ? parsed : fallback;
};

export const parseSortParam = (
  value: string | null,
  fallback: Filters['sort'],
): Filters['sort'] => value === 'newest' || value === 'score' ? value : fallback;

export const buildQueryString = (filters: Filters, page: number): string => {
  const params = new URLSearchParams();

  if (filters.search) params.set('search', filters.search);
  if (filters.author) params.set('author', filters.author);
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.set('dateTo', filters.dateTo);

  filters.selectedCategories.forEach(cat => {
    params.append('category', cat);
  });

  if (filters.onlySummarized) params.set('onlySummarized', 'true');
  if (filters.minScore > 0) params.set('minScore', String(filters.minScore));
  if (filters.onlyScored) params.set('onlyScored', 'true');
  params.set('sort', filters.sort);
  params.set('page', String(page));

  return params.toString();
};
