export interface Filters {
  search: string;
  author: string;
  dateFrom: string;
  dateTo: string;
  selectedCategories: Set<string>;
  onlySummarized: boolean;
  minScore: number;
  onlyScored: boolean;
  onlyBookmarked: boolean;
  selectedList: string | null;
  sort: 'newest' | 'score';
}

export const defaultFilters: Filters = {
  search: '',
  author: '',
  dateFrom: '',
  dateTo: '',
  selectedCategories: new Set(),
  onlySummarized: false,
  minScore: 0,
  onlyScored: false,
  onlyBookmarked: false,
  selectedList: null,
  sort: 'score',
};
