import { useState, type FC } from 'react';
import type { Paper } from '@/types';
import { getScoreColor, fetchBibtex } from '@/utils';
import { ExpandableSection, ReadingListDropdown } from '@/components/ui';

interface CompactPaperRowProps {
  paper: Paper;
  isBookmarked: boolean;
  onToggleBookmark: (arxivId: string) => void;
  currentList: string | null;
  listNames: string[];
  onSelectList: (arxivId: string, listName: string | null) => void;
}

export const CompactPaperRow: FC<CompactPaperRowProps> = ({
  paper,
  isBookmarked,
  onToggleBookmark,
  currentList,
  listNames,
  onSelectList,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const score = paper.excitement_score || 0;

  const handleCite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const bibtex = await fetchBibtex(paper.arxiv_id);
      await navigator.clipboard.writeText(bibtex);
    } catch (err) {
      console.error('Failed to copy BibTeX:', err);
    }
  };

  return (
    <div>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full py-1.5 px-2 flex items-center gap-2 hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors text-left group"
      >
        <span className={`text-xs font-bold w-5 text-center flex-shrink-0 ${getScoreColor(score)}`}>
          {score || '–'}
        </span>

        <div className="flex-1 min-w-0">
          <h3 className="text-xs font-medium text-stone-900 dark:text-stone-100 truncate group-hover:text-amber-800 dark:group-hover:text-amber-400 transition-colors leading-tight">
            {paper.title}
          </h3>
          <p className="text-[11px] text-stone-400 dark:text-stone-500 truncate leading-tight">
            {paper.authors}
          </p>
        </div>

        <div className="hidden md:flex items-center gap-2 text-[10px] text-stone-400 dark:text-stone-500 flex-shrink-0">
          {paper.reasoning_category && (
            <span className="px-1 py-0.5 bg-stone-100 dark:bg-stone-800 rounded">
              {paper.reasoning_category}
            </span>
          )}
          <span className="w-16 text-right">{paper.date?.slice(0, 10)}</span>
        </div>

        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-stone-300 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isExpanded && (
        <div className="px-2 pb-2 ml-7 border-l-2 border-stone-200 dark:border-stone-700">
          {paper.tldr && (
            <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed mb-2 pl-2">
              {paper.tldr}
            </p>
          )}

          <div className="flex items-center justify-between text-[11px] pl-2">
            <div className="flex items-center gap-3">
              {paper.summary_md && (
                <ExpandableSection title="Summary">
                  {paper.summary_md}
                  {paper.excitement_reasoning && (
                    <div className="mt-3 pt-3 border-t border-stone-200 dark:border-stone-700">
                      <p className="text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Assessment</p>
                      <p className="text-xs text-stone-600 dark:text-stone-400">{paper.excitement_reasoning}</p>
                      {paper.score_breakdown && (
                        <p className="text-[10px] text-stone-500 mt-2">{paper.score_breakdown}</p>
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
                    height="500"
                    className="border border-stone-200 dark:border-stone-700 rounded"
                    title={`${paper.title} PDF`}
                  />
                </ExpandableSection>
              )}
              {paper.arxiv_id && (
                <button
                  onClick={handleCite}
                  className="text-stone-500 dark:text-stone-400 hover:text-amber-700 dark:hover:text-amber-400"
                >
                  Cite
                </button>
              )}
              <a
                href={paper.arxiv_link}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-stone-500 dark:text-stone-400 hover:text-amber-700 dark:hover:text-amber-400"
              >
                arXiv
              </a>
            </div>

            {paper.arxiv_id && (
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleBookmark(paper.arxiv_id);
                  }}
                  className={`transition-colors ${
                    isBookmarked
                      ? 'text-amber-500 hover:text-amber-600'
                      : 'text-stone-400 hover:text-amber-500'
                  }`}
                >
                  {isBookmarked ? 'Saved' : 'Save'}
                </button>
                <div onClick={(e) => e.stopPropagation()}>
                  <ReadingListDropdown
                    currentList={currentList}
                    listNames={listNames}
                    onSelectList={(list) => onSelectList(paper.arxiv_id, list)}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
