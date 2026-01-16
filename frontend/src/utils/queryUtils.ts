import type { Filters } from '@/types';

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
