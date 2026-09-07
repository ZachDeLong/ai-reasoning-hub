export interface Paper {
  id: number;
  arxiv_id: string;
  title: string;
  authors: string;
  date: string;
  reasoning_category: string;
  arxiv_link: string;
  tldr: string;
  summary_md: string;
  excitement_score: number;
  excitement_reasoning: string;
  score_breakdown: string;
  last_scored_at: string;
}

export interface PapersResponse {
  papers: Paper[];
  total_pages: number;
  results_count: number;
}

export interface StatsResponse {
  papers: StatsPaper[];
}

export type StatsPaper = Pick<
  Paper,
  | 'id'
  | 'title'
  | 'authors'
  | 'date'
  | 'reasoning_category'
  | 'arxiv_link'
  | 'excitement_score'
  | 'score_breakdown'
>;
