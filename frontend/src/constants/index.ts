export const CARDS_PER_PAGE = 15;

export const BREAKDOWN_MAX = {
  Novelty: 3,
  Utility: 1,
  Results: 2,
  Access: 1,
} as const;

export const NAV_ITEMS = [
  { id: 'papers', label: 'Papers' },
  { id: 'trends', label: 'Trends' },
  { id: 'lists', label: 'Reading Lists' },
  { id: 'settings', label: 'Settings' },
] as const;

export const DEFAULT_LISTS = ['To Read', 'Reading', 'Completed'] as const;

export type NavItemId = (typeof NAV_ITEMS)[number]['id'];
