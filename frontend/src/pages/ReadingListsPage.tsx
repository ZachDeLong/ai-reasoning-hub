import { useEffect, useMemo, useState, type FC } from 'react';
import type { Paper } from '@/types';
import type { ReadingLists } from '@/hooks';
import { fetchPapersByArxivIds, getScoreColor } from '@/utils';

interface ReadingListsPageProps {
  readingLists: ReadingLists;
  onRemoveFromList: (arxivId: string, listName: string) => void;
  onExpandPaper: (paper: Paper) => void;
}

export const ReadingListsPage: FC<ReadingListsPageProps> = ({
  readingLists,
  onRemoveFromList,
  onExpandPaper,
}) => {
  const [activeList, setActiveList] = useState(Object.keys(readingLists)[0] || 'To Read');
  const [papersByArxivId, setPapersByArxivId] = useState<Record<string, Paper>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryAttempt, setRetryAttempt] = useState(0);

  const savedPaperIds = useMemo(
    () => [...new Set(Object.values(readingLists).flat())],
    [readingLists],
  );

  useEffect(() => {
    if (savedPaperIds.length === 0) {
      setPapersByArxivId({});
      setLoadError(null);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setLoadError(null);
    fetchPapersByArxivIds(savedPaperIds, controller.signal)
      .then(fetchedPapers => {
        setPapersByArxivId(Object.fromEntries(
          fetchedPapers.map(paper => [paper.arxiv_id, paper]),
        ));
      })
      .catch(error => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError('Could not load your saved papers.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [savedPaperIds, retryAttempt]);

  const activePaperIds = readingLists[activeList] ?? [];
  const hasLoadedPapers = Object.keys(papersByArxivId).length > 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-4">
      <h1 className="font-serif text-3xl font-bold text-stone-900 dark:text-stone-100 mb-8">
        Reading Lists
      </h1>

      <div className="flex gap-2 mb-6 border-b border-stone-200 dark:border-stone-800">
        {Object.keys(readingLists).map(listName => (
          <button
            key={listName}
            onClick={() => setActiveList(listName)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeList === listName
                ? 'border-amber-600 text-amber-800 dark:text-amber-400'
                : 'border-transparent text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'
            }`}
          >
            {listName}
            <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-stone-100 dark:bg-stone-800">
              {readingLists[listName].length}
            </span>
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 overflow-hidden">
        {activePaperIds.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-stone-500 dark:text-stone-400">No papers in this list yet</p>
            <p className="text-sm text-stone-400 dark:text-stone-500 mt-1">
              Add papers from the Papers tab
            </p>
          </div>
        ) : isLoading && !hasLoadedPapers ? (
          <div className="p-12 text-center text-stone-500 dark:text-stone-400">
            Loading saved papers…
          </div>
        ) : loadError && !hasLoadedPapers ? (
          <div role="alert" className="p-12 text-center">
            <p className="text-sm text-red-700 dark:text-red-300">{loadError}</p>
            <button
              onClick={() => setRetryAttempt(attempt => attempt + 1)}
              className="mt-3 rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-600"
            >
              Retry
            </button>
          </div>
        ) : (
          activePaperIds.map(arxivId => {
            const paper = papersByArxivId[arxivId];
            if (!paper) {
              return (
                <div key={arxivId} className="flex items-center justify-between gap-4 p-4 border-b border-stone-100 dark:border-stone-800 last:border-b-0">
                  <div className="min-w-0">
                    <p className="font-medium text-stone-700 dark:text-stone-300">{arxivId}</p>
                    <p className="text-sm text-stone-500 dark:text-stone-400">Paper details are no longer available</p>
                  </div>
                  <button
                    onClick={() => onRemoveFromList(arxivId, activeList)}
                    className="p-1.5 text-stone-400 hover:text-red-500 transition-colors"
                    title="Remove from list"
                  >
                    ✕
                  </button>
                </div>
              );
            }
            return (
              <div
                key={arxivId}
                onClick={() => onExpandPaper(paper)}
                className="p-4 border-b border-stone-100 dark:border-stone-800 last:border-b-0 hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-stone-900 dark:text-stone-100 hover:text-amber-700 dark:hover:text-amber-400 transition-colors">
                      {paper.title}
                    </span>
                    <p className="text-sm text-stone-500 dark:text-stone-400 mt-1 truncate">
                      {paper.authors}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {paper.excitement_score > 0 && (
                      <span className={`text-sm font-bold ${getScoreColor(paper.excitement_score)}`}>
                        {paper.excitement_score}
                      </span>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); onRemoveFromList(arxivId, activeList); }}
                      className="p-1.5 text-stone-400 hover:text-red-500 transition-colors"
                      title="Remove from list"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
