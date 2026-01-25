import type { FC } from 'react';
import type { Paper } from '@/types';
import { getScoreColor, fetchBibtex } from '@/utils';
import { ExpandableSection, ReadingListDropdown } from '@/components/ui';

interface PaperCardProps {
  paper: Paper;
  isBookmarked: boolean;
  onToggleBookmark: (arxivId: string) => void;
  currentList: string | null;
  listNames: string[];
  onSelectList: (arxivId: string, listName: string | null) => void;
}

export const PaperCard: FC<PaperCardProps> = ({
  paper,
  isBookmarked,
  onToggleBookmark,
  currentList,
  listNames,
  onSelectList,
}) => {
  const score = paper.excitement_score || 0;

  const handleCite = async () => {
    try {
      const bibtex = await fetchBibtex(paper.arxiv_id);
      await navigator.clipboard.writeText(bibtex);
    } catch (e) {
      console.error('Failed to copy BibTeX:', e);
    }
  };

  return (
    <article className="bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-800 overflow-hidden hover:border-stone-300 dark:hover:border-stone-700 transition-colors">
      <div className="p-4 pb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {paper.reasoning_category && (
              <span className="font-cholla text-xs font-medium uppercase tracking-wider text-amber-800 dark:text-amber-500">
                {paper.reasoning_category}
              </span>
            )}
            <span className="text-xs text-stone-400 dark:text-stone-500">
              {paper.date}
            </span>
          </div>
          {score > 0 && (
            <div className={`flex items-center gap-1 ${getScoreColor(score)}`}>
              <span className="font-cholla text-base font-bold">{score}</span>
              <span className="text-xs text-stone-400">/7</span>
            </div>
          )}
        </div>

        <h2 className="mb-1">
          <a
            href={paper.arxiv_link}
            target="_blank"
            rel="noopener noreferrer"
            className="font-serif text-lg font-semibold text-stone-900 dark:text-stone-100 hover:text-amber-800 dark:hover:text-amber-400 transition-colors leading-snug"
          >
            {paper.title}
          </a>
        </h2>

        <p className="text-sm text-stone-500 dark:text-stone-400 mb-2" title={paper.authors}>
          {paper.authors}
        </p>

        {paper.tldr && (
          <blockquote className="pl-3 border-l-2 border-amber-400 dark:border-amber-600 text-sm text-stone-600 dark:text-stone-300 italic leading-relaxed">
            {paper.tldr}
          </blockquote>
        )}
      </div>

      <div className="px-4 py-2.5 bg-stone-50 dark:bg-stone-800/50 border-t border-stone-100 dark:border-stone-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {paper.summary_md && (
              <ExpandableSection title="Summary">
                {paper.summary_md}
                {paper.excitement_reasoning && (
                  <div className="mt-4 pt-4 border-t border-stone-200 dark:border-stone-700">
                    <p className="text-sm font-semibold text-stone-700 dark:text-stone-300 mb-2">Assessment</p>
                    <p className="text-stone-600 dark:text-stone-400">{paper.excitement_reasoning}</p>
                    {paper.score_breakdown && (
                      <p className="text-xs text-stone-500 mt-3 font-medium">{paper.score_breakdown}</p>
                    )}
                  </div>
                )}
              </ExpandableSection>
            )}
            {paper.arxiv_id && (
              <ExpandableSection title="PDF">
                <iframe
                  src={`/api/pdf/${paper.arxiv_id}`}
                  width="100%"
                  height="600"
                  className="border border-stone-200 dark:border-stone-700 rounded-lg"
                  title={`${paper.title} PDF`}
                />
              </ExpandableSection>
            )}
            {paper.arxiv_id && (
              <button
                onClick={handleCite}
                className="text-sm text-stone-500 dark:text-stone-400 hover:text-amber-800 dark:hover:text-amber-400 transition-colors"
              >
                Cite
              </button>
            )}
          </div>

          {paper.arxiv_id && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => onToggleBookmark(paper.arxiv_id)}
                className={`text-lg transition-colors ${
                  isBookmarked
                    ? 'text-amber-500 hover:text-amber-600'
                    : 'text-stone-400 hover:text-amber-500'
                }`}
                title={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}
              >
                {isBookmarked ? 'Saved' : 'Save'}
              </button>
              <ReadingListDropdown
                currentList={currentList}
                listNames={listNames}
                onSelectList={(list) => onSelectList(paper.arxiv_id, list)}
              />
            </div>
          )}
        </div>
      </div>
    </article>
  );
};
