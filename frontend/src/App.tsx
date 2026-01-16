import { useState, useEffect, useMemo, useRef, type FC } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import type { Paper, Filters } from '@/types';
import type { NavItemId } from '@/constants';
import { buildQueryString, getScoreColor, fetchBibtex } from '@/utils';
import { useBookmarks, useReadingLists } from '@/hooks';
import { TopNav, MobileBottomNav, SidebarSection } from '@/components/navigation';
import { ScoreBreakdownChips, ReadingListDropdown } from '@/components/ui';
import { TrendsPage, ReadingListsPage, SettingsPage } from '@/pages';

const SkeletonCard: FC = () => (
  <div className="bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-800 p-4 animate-pulse">
    <div className="flex justify-between mb-3">
      <div className="flex gap-2">
        <div className="h-4 w-16 bg-stone-200 dark:bg-stone-700 rounded" />
        <div className="h-4 w-20 bg-stone-200 dark:bg-stone-700 rounded" />
      </div>
      <div className="h-6 w-8 bg-stone-200 dark:bg-stone-700 rounded" />
    </div>
    <div className="h-5 w-full bg-stone-200 dark:bg-stone-700 rounded mb-2" />
    <div className="h-5 w-3/4 bg-stone-200 dark:bg-stone-700 rounded mb-3" />
    <div className="h-4 w-1/2 bg-stone-200 dark:bg-stone-700 rounded mb-4" />
    <div className="space-y-2">
      <div className="h-4 w-full bg-stone-200 dark:bg-stone-700 rounded" />
      <div className="h-4 w-full bg-stone-200 dark:bg-stone-700 rounded" />
      <div className="h-4 w-2/3 bg-stone-200 dark:bg-stone-700 rounded" />
    </div>
  </div>
);

interface PaperGridCardProps {
  paper: Paper;
  isBookmarked: boolean;
  onToggleBookmark: (arxivId: string) => void;
  currentList: string | null;
  listNames: string[];
  onSelectList: (arxivId: string, listName: string | null) => void;
  isFocused: boolean;
  onSelect: () => void;
  onToggleExpand: () => void;
}

const PaperGridCard: FC<PaperGridCardProps> = ({
  paper,
  isBookmarked,
  onToggleBookmark,
  currentList,
  listNames,
  onSelectList,
  isFocused,
  onSelect,
  onToggleExpand,
}) => {
  const score = paper.excitement_score || 0;
  const cardRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (isFocused && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [isFocused]);

  const handleCite = async () => {
    try {
      const bibtex = await fetchBibtex(paper.arxiv_id);
      await navigator.clipboard.writeText(bibtex);
    } catch (e) {
      console.error('Failed to copy BibTeX:', e);
    }
  };

  return (
    <article
      ref={cardRef}
      onClick={onSelect}
      className={`paper-card bg-white dark:bg-stone-900 rounded-lg border-2 cursor-pointer ${
        isFocused
          ? 'border-amber-500 dark:border-amber-400 ring-2 ring-amber-500/20'
          : 'border-stone-200 dark:border-stone-800 hover:border-amber-300 dark:hover:border-amber-700/50'
      }`}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            {paper.reasoning_category && (
              <span className="text-[10px] font-medium uppercase tracking-wider text-amber-700 dark:text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded">
                {paper.reasoning_category}
              </span>
            )}
            <span className="text-[10px] text-stone-400">{paper.date?.slice(0, 10)}</span>
          </div>
          {score > 0 && (
            <div className={`flex items-baseline gap-0.5 ${getScoreColor(score)}`}>
              <span className="text-lg font-bold leading-none">{score}</span>
              <span className="text-[10px] text-stone-400">/7</span>
            </div>
          )}
        </div>

        <h3 className="font-semibold text-stone-900 dark:text-stone-100 mb-1 leading-snug">
          <a href={paper.arxiv_link} target="_blank" rel="noopener noreferrer" className="hover:text-amber-700 dark:hover:text-amber-400">
            {paper.title}
          </a>
        </h3>

        <p className="text-xs text-stone-500 dark:text-stone-400 mb-3 line-clamp-1">{paper.authors}</p>

        {paper.tldr && (
          <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed mb-2 line-clamp-3">
            {paper.tldr}
          </p>
        )}

        {paper.score_breakdown && (
          <div className="mb-3">
            <ScoreBreakdownChips breakdownString={paper.score_breakdown} compact />
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-stone-100 dark:border-stone-800">
          <div className="flex items-center gap-1">
            <button
              onClick={onToggleExpand}
              className="px-2 py-1.5 text-xs text-amber-700 dark:text-amber-500 hover:text-amber-800 dark:hover:text-amber-400 font-medium rounded-md hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
            >
              Read more
            </button>
            <a
              href={paper.arxiv_link}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2 py-1.5 text-xs text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 rounded-md hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            >
              arXiv
            </a>
            {paper.arxiv_id && (
              <button
                onClick={handleCite}
                className="px-2 py-1.5 text-xs text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 rounded-md hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
              >
                Cite
              </button>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onToggleBookmark(paper.arxiv_id)}
              className={`px-2 py-1.5 text-xs rounded-md transition-colors ${
                isBookmarked ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20' : 'text-stone-400 hover:text-amber-500 hover:bg-stone-100 dark:hover:bg-stone-800'
              }`}
            >
              {isBookmarked ? 'Saved' : 'Save'}
            </button>
            <ReadingListDropdown
              currentList={currentList}
              listNames={listNames}
              onSelectList={(list) => onSelectList(paper.arxiv_id, list)}
            />
          </div>
        </div>
      </div>

    </article>
  );
};

function App() {
  const [themePreference, setThemePreference] = useState(() => {
    return localStorage.getItem('themePreference') || 'system';
  });

  const darkMode = useMemo(() => {
    if (themePreference === 'dark') return true;
    if (themePreference === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }, [themePreference]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('themePreference', themePreference);
  }, [darkMode, themePreference]);

  const [defaultSort, setDefaultSort] = useState(() => {
    return localStorage.getItem('defaultSort') || 'score';
  });
  useEffect(() => {
    localStorage.setItem('defaultSort', defaultSort);
  }, [defaultSort]);

  const [defaultMinScore, setDefaultMinScore] = useState(() => {
    return parseInt(localStorage.getItem('defaultMinScore') || '0', 10);
  });
  useEffect(() => {
    localStorage.setItem('defaultMinScore', defaultMinScore.toString());
  }, [defaultMinScore]);

  const [keyboardEnabled, setKeyboardEnabled] = useState(() => {
    const saved = localStorage.getItem('keyboardEnabled');
    return saved !== null ? JSON.parse(saved) : true;
  });
  useEffect(() => {
    localStorage.setItem('keyboardEnabled', JSON.stringify(keyboardEnabled));
  }, [keyboardEnabled]);

  const [activePage, setActivePage] = useState<NavItemId>('papers');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const { bookmarks, toggleBookmark, isBookmarked, clearBookmarks } = useBookmarks();
  const { readingLists, addToList, removeFromList, getListForPaper, getListNames, getListCount, clearLists } = useReadingLists();

  const getInitialFilters = (): Filters => {
    const params = new URLSearchParams(window.location.search);
    const savedSort = localStorage.getItem('defaultSort') || 'score';
    const savedMinScore = parseInt(localStorage.getItem('defaultMinScore') || '0', 10);
    return {
      search: params.get('search') || '',
      author: params.get('author') || '',
      dateFrom: params.get('dateFrom') || '',
      dateTo: params.get('dateTo') || '',
      selectedCategories: new Set(params.getAll('category')),
      onlySummarized: params.get('onlySummarized') === 'true',
      minScore: parseInt(params.get('minScore') || savedMinScore.toString(), 10),
      onlyScored: params.get('onlyScored') === 'true',
      onlyBookmarked: false,
      selectedList: null,
      sort: (params.get('sort') || savedSort) as 'newest' | 'score',
    };
  };

  const [filters, setFilters] = useState<Filters>(getInitialFilters);
  const [currentPage, setCurrentPage] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return parseInt(params.get('page') || '0', 10);
  });

  useEffect(() => {
    const queryString = buildQueryString(filters, currentPage);
    const newUrl = queryString ? `?${queryString}` : window.location.pathname;
    window.history.replaceState(null, '', newUrl);
  }, [filters, currentPage]);

  const [papers, setPapers] = useState<Paper[]>([]);
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [resultsCount, setResultsCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/categories')
      .then(res => res.json())
      .then(data => setAllCategories(data))
      .catch(err => console.error("Failed to fetch categories:", err));
  }, []);

  useEffect(() => {
    setIsLoading(true);
    const queryString = buildQueryString(filters, currentPage);

    const timer = setTimeout(() => {
      fetch(`/api/papers?${queryString}`)
        .then(res => res.json())
        .then(data => {
          setPapers(data.papers);
          setTotalPages(data.total_pages);
          setResultsCount(data.results_count);
          setIsLoading(false);
        })
        .catch(err => {
          console.error("Failed to fetch papers:", err);
          setIsLoading(false);
        });
    }, 10);

    return () => clearTimeout(timer);
  }, [filters, currentPage]);

  const filtersForPageReset = { ...filters, search: undefined };
  useEffect(() => {
    setCurrentPage(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filtersForPageReset), filters.search]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 0 && newPage < totalPages) {
      setCurrentPage(newPage);
      window.scrollTo(0, 0);
    }
  };

  const PapersPageContent: FC = () => {
    const [focusedIndex, setFocusedIndex] = useState(0);
    const [expandedId, setExpandedId] = useState<number | null>(null);

    const filteredPapers = papers
      .filter(paper => !filters.onlyBookmarked || isBookmarked(paper.arxiv_id))
      .filter(paper => !filters.selectedList || getListForPaper(paper.arxiv_id) === filters.selectedList);

    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (!keyboardEnabled) return;
        if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;

        const paper = filteredPapers[focusedIndex];

        switch (e.key) {
          case 'j':
          case 'ArrowDown':
            e.preventDefault();
            setFocusedIndex(prev => Math.min(prev + 1, filteredPapers.length - 1));
            break;
          case 'k':
          case 'ArrowUp':
            e.preventDefault();
            setFocusedIndex(prev => Math.max(prev - 1, 0));
            break;
          case 'Enter':
            e.preventDefault();
            if (paper) {
              setExpandedId(expandedId === paper.id ? null : paper.id);
            }
            break;
          case 's':
            e.preventDefault();
            if (paper?.arxiv_id) {
              toggleBookmark(paper.arxiv_id);
            }
            break;
          case 'o':
            e.preventDefault();
            if (paper?.arxiv_link) {
              window.open(paper.arxiv_link, '_blank');
            }
            break;
          case 'Escape':
            e.preventDefault();
            setExpandedId(null);
            break;
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [focusedIndex, filteredPapers, expandedId]);

    useEffect(() => {
      setFocusedIndex(0);
      setExpandedId(null);
    }, []);

    return (
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-stone-500">{resultsCount} papers</span>
          {totalPages > 1 && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 0}
                className="text-sm text-stone-500 hover:text-stone-700 disabled:opacity-30"
              >
                ← Prev
              </button>
              <span className="text-sm text-stone-400">{currentPage + 1} / {totalPages}</span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages - 1}
                className="text-sm text-stone-500 hover:text-stone-700 disabled:opacity-30"
              >
                Next →
              </button>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
            {[...Array(9)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : filteredPapers.length > 0 ? (
          <>
            <div className="paper-grid grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
              {filteredPapers.map((paper, index) => (
                <div
                  key={paper.id}
                  className="animate-card-in"
                  style={{ animationDelay: `${Math.min(index * 40, 300)}ms` }}
                >
                  <PaperGridCard
                    paper={paper}
                    isBookmarked={isBookmarked(paper.arxiv_id)}
                    onToggleBookmark={toggleBookmark}
                    currentList={getListForPaper(paper.arxiv_id)}
                    listNames={getListNames()}
                    onSelectList={addToList}
                    isFocused={index === focusedIndex}
                    onSelect={() => setFocusedIndex(index)}
                    onToggleExpand={() => setExpandedId(paper.id)}
                  />
                </div>
              ))}
            </div>

            {/* Paper Detail Modal */}
            {expandedId && (() => {
              const expandedPaper = filteredPapers.find(p => p.id === expandedId);
              if (!expandedPaper) return null;
              return (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                  <div
                    className="fixed inset-0 bg-black/70"
                    onClick={() => setExpandedId(null)}
                  />
                  <div
                    className="relative min-h-screen flex items-start justify-center p-4 pt-16"
                    onClick={() => setExpandedId(null)}
                  >
                    <div
                      className="relative w-full max-w-6xl bg-white dark:bg-stone-900 rounded-xl shadow-2xl animate-fade-in overflow-hidden"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Modal Header */}
                      <div className="sticky top-0 z-10 bg-white dark:bg-stone-900 border-b border-stone-200 dark:border-stone-800 px-6 py-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              {expandedPaper.reasoning_category && (
                                <span className="text-[10px] font-medium uppercase tracking-wider text-amber-700 dark:text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded">
                                  {expandedPaper.reasoning_category}
                                </span>
                              )}
                              <span className="text-xs text-stone-400">{expandedPaper.date?.slice(0, 10)}</span>
                              {expandedPaper.excitement_score > 0 && (
                                <span className={`text-sm font-bold ${getScoreColor(expandedPaper.excitement_score)}`}>
                                  {expandedPaper.excitement_score}/7
                                </span>
                              )}
                            </div>
                            <h2 className="font-serif text-xl font-bold text-stone-900 dark:text-stone-100 leading-tight">
                              {expandedPaper.title}
                            </h2>
                            <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">{expandedPaper.authors}</p>
                          </div>
                          <button
                            onClick={() => setExpandedId(null)}
                            className="p-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Modal Content */}
                      <div className="grid lg:grid-cols-2 gap-6 p-6">
                        {/* Left: Summary */}
                        <div className="min-w-0 overflow-hidden">
                          {expandedPaper.tldr && (
                            <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                              <p className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-500 mb-2">TL;DR</p>
                              <p className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed">{expandedPaper.tldr}</p>
                            </div>
                          )}
                          {expandedPaper.summary_md && (
                            <div className="prose prose-sm prose-stone dark:prose-invert max-w-none">
                              <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(
                                expandedPaper.summary_md.replace(/^##?\s*TL;?DR\s*\n+[\s\S]*?(?=\n##?\s|\n*$)/i, '')
                              ) as string) }} />
                            </div>
                          )}
                          {(expandedPaper.excitement_reasoning || expandedPaper.score_breakdown) && (
                            <div className="mt-6 pt-6 border-t border-stone-200 dark:border-stone-700">
                              <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-3">Assessment</h4>
                              {expandedPaper.score_breakdown && (
                                <div className="mb-3">
                                  <ScoreBreakdownChips breakdownString={expandedPaper.score_breakdown} compact={false} />
                                </div>
                              )}
                              {expandedPaper.excitement_reasoning && (
                                <p className="text-sm text-stone-600 dark:text-stone-400 italic">{expandedPaper.excitement_reasoning}</p>
                              )}
                            </div>
                          )}
                          {/* Action buttons */}
                          <div className="flex items-center gap-3 mt-6 pt-4 border-t border-stone-200 dark:border-stone-700">
                            <a
                              href={expandedPaper.arxiv_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 text-sm text-amber-700 dark:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                            >
                              View on arXiv →
                            </a>
                            <button
                              onClick={async () => {
                                const bibtex = await fetchBibtex(expandedPaper.arxiv_id);
                                await navigator.clipboard.writeText(bibtex);
                              }}
                              className="px-3 py-1.5 text-sm text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors"
                            >
                              Copy BibTeX
                            </button>
                            <button
                              onClick={() => toggleBookmark(expandedPaper.arxiv_id)}
                              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                                isBookmarked(expandedPaper.arxiv_id)
                                  ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20'
                                  : 'text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800'
                              }`}
                            >
                              {isBookmarked(expandedPaper.arxiv_id) ? 'Saved' : 'Save'}
                            </button>
                          </div>
                        </div>
                        {/* Right: PDF */}
                        {expandedPaper.arxiv_id && (
                          <div className="min-w-0 flex flex-col">
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="text-sm font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                                Paper
                              </h3>
                              <a
                                href={`https://arxiv.org/pdf/${expandedPaper.arxiv_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-amber-700 dark:text-amber-400 hover:text-amber-600 dark:hover:text-amber-300 transition-colors"
                              >
                                Open in new tab →
                              </a>
                            </div>
                            <div className="flex-1 rounded-lg overflow-hidden">
                              <iframe
                                src={`/api/pdf/${expandedPaper.arxiv_id}`}
                                className="w-full h-[calc(100vh-8rem)] min-h-[700px] bg-white"
                                title={`${expandedPaper.title} PDF`}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </>
        ) : (
          <div className="flex items-center justify-center h-64">
            <p className="text-stone-400">No papers found</p>
          </div>
        )}

        {totalPages > 1 && !isLoading && (
          <div className="flex justify-center gap-4 mt-6 pt-4 border-t border-stone-200 dark:border-stone-800">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 0}
              className="text-sm text-stone-500 hover:text-stone-700 disabled:opacity-30"
            >
              ← Previous
            </button>
            <span className="text-sm text-stone-400">Page {currentPage + 1} of {totalPages}</span>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages - 1}
              className="text-sm text-stone-500 hover:text-stone-700 disabled:opacity-30"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] dark:bg-stone-950 text-stone-900 dark:text-stone-100">
      <TopNav
        activePage={activePage}
        setActivePage={setActivePage}
        darkMode={darkMode}
        onToggleDarkMode={() => setThemePreference(darkMode ? 'light' : 'dark')}
      />

      <div className="flex">
        {/* Sidebar - only content on Papers page, but toggle area always present on lg screens */}
        <div className="hidden lg:flex flex-shrink-0 h-[calc(100vh-3rem)] sticky top-12">
          {activePage === 'papers' ? (
            <>
              <aside className={`sidebar-collapse overflow-y-auto bg-stone-100 dark:bg-stone-900 border-r border-stone-200 dark:border-stone-800 ${
                sidebarCollapsed ? 'w-0 p-0 overflow-hidden opacity-0' : 'w-64 xl:w-72 p-4 opacity-100'
              }`}>
              <div className="space-y-3 min-w-[240px]">
                <SidebarSection title="Search" defaultOpen>
                  <input
                    type="text"
                    defaultValue={filters.search}
                    onChange={e => {
                      const value = e.target.value;
                      setTimeout(() => setFilters(prev => ({ ...prev, search: value })), 300);
                    }}
                    placeholder="Search papers..."
                    className="w-full px-2.5 py-1.5 text-sm bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-md text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <input
                    type="text"
                    defaultValue={filters.author}
                    onChange={e => {
                      const value = e.target.value;
                      setTimeout(() => setFilters(prev => ({ ...prev, author: value })), 300);
                    }}
                    placeholder="Filter by author..."
                    className="w-full px-2.5 py-1.5 text-sm bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-md text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500 mt-1.5"
                  />
                </SidebarSection>

                <SidebarSection title="Sort" defaultOpen>
                  <div className="flex gap-1.5">
                    {[{ label: 'Newest', value: 'newest' }, { label: 'Top', value: 'score' }].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setFilters(prev => ({ ...prev, sort: opt.value as 'newest' | 'score' }))}
                        className={`flex-1 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                          filters.sort === opt.value
                            ? 'bg-amber-700 text-white'
                            : 'bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-400 border border-stone-300 dark:border-stone-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </SidebarSection>

                <SidebarSection title="Filters" defaultOpen>
                  <div className="space-y-1.5">
                    {[
                      { key: 'onlySummarized' as const, label: 'With Summary' },
                      { key: 'onlyScored' as const, label: 'With Score' },
                      { key: 'onlyBookmarked' as const, label: `Bookmarked (${bookmarks.size})` },
                    ].map(({ key, label }) => (
                      <label key={key} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={filters[key]}
                          onChange={() => setFilters(prev => ({ ...prev, [key]: !prev[key] }))}
                          className="w-3.5 h-3.5 rounded border-stone-400 text-amber-600 focus:ring-amber-500"
                        />
                        <span className="text-xs text-stone-700 dark:text-stone-300">{label}</span>
                      </label>
                    ))}
                  </div>
                </SidebarSection>

                <SidebarSection title="Min Score" defaultOpen={false}>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0"
                      max="7"
                      value={filters.minScore}
                      onChange={e => setFilters(prev => ({ ...prev, minScore: parseInt(e.target.value, 10) }))}
                      className="flex-1 h-1.5 bg-stone-300 dark:bg-stone-700 rounded-full appearance-none cursor-pointer accent-amber-600"
                    />
                    <span className="text-xs font-medium text-amber-700 dark:text-amber-500 w-6">{filters.minScore}/7</span>
                  </div>
                </SidebarSection>

                <SidebarSection title="Topics" defaultOpen={false}>
                  <div className="flex flex-wrap gap-1">
                    {allCategories.map(cat => (
                      <button
                        key={cat}
                        onClick={() => {
                          setFilters(prev => {
                            const newCats = new Set(prev.selectedCategories);
                            if (newCats.has(cat)) newCats.delete(cat);
                            else newCats.add(cat);
                            return { ...prev, selectedCategories: newCats };
                          });
                        }}
                        className={`px-1.5 py-0.5 text-xs rounded transition-colors ${
                          filters.selectedCategories.has(cat)
                            ? 'bg-amber-700 text-white'
                            : 'bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-400 border border-stone-300 dark:border-stone-700'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </SidebarSection>

                <SidebarSection title="Reading Lists" defaultOpen={false}>
                  <div className="flex flex-wrap gap-1">
                    <button
                      onClick={() => setFilters(prev => ({ ...prev, selectedList: null }))}
                      className={`px-1.5 py-0.5 text-xs rounded transition-colors ${
                        !filters.selectedList
                          ? 'bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-900'
                          : 'bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-400 border border-stone-300 dark:border-stone-700'
                      }`}
                    >
                      All
                    </button>
                    {getListNames().map(name => (
                      <button
                        key={name}
                        onClick={() => setFilters(prev => ({ ...prev, selectedList: prev.selectedList === name ? null : name }))}
                        className={`px-1.5 py-0.5 text-xs rounded transition-colors ${
                          filters.selectedList === name
                            ? 'bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-900'
                            : 'bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-400 border border-stone-300 dark:border-stone-700'
                        }`}
                      >
                        {name} ({getListCount(name)})
                      </button>
                    ))}
                  </div>
                </SidebarSection>

                <div className="pt-3 border-t border-stone-200 dark:border-stone-700 space-y-1.5">
                  <button
                    onClick={() => {
                      const queryString = buildQueryString(filters, 0).replace('&page=0', '').replace('page=0', '');
                      window.location.href = `/api/export/csv?${queryString}`;
                    }}
                    className="w-full px-2.5 py-1.5 text-xs text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-md transition-colors"
                  >
                    Export CSV
                  </button>
                  <button
                    onClick={() => navigator.clipboard.writeText(window.location.href)}
                    className="w-full px-2.5 py-1.5 text-xs text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-md transition-colors"
                  >
                    Share Link
                  </button>
                </div>
              </div>
            </aside>

            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="flex items-center justify-center w-6 h-12 my-auto -ml-px bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 border border-l-0 border-stone-300 dark:border-stone-700 rounded-r-lg transition-colors"
              title={sidebarCollapsed ? "Show filters" : "Hide filters"}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`text-stone-500 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`}
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            </>
          ) : (
            /* Spacer to maintain consistent layout on non-Papers pages */
            <div className="w-6" />
          )}
        </div>

        <main className="flex-1 min-w-0">
          <div key={activePage} className="animate-fade-in max-w-[1600px] mx-auto">
            {activePage === 'papers' && <PapersPageContent />}

            {activePage === 'trends' && <TrendsPage papers={papers} />}

            {activePage === 'lists' && (
              <ReadingListsPage
                readingLists={readingLists}
                papers={papers}
                onRemoveFromList={removeFromList}
              />
            )}

            {activePage === 'settings' && (
              <SettingsPage
                themePreference={themePreference}
                setThemePreference={setThemePreference}
                defaultSort={defaultSort}
                setDefaultSort={setDefaultSort}
                defaultMinScore={defaultMinScore}
                setDefaultMinScore={setDefaultMinScore}
                keyboardEnabled={keyboardEnabled}
                setKeyboardEnabled={setKeyboardEnabled}
                onClearBookmarks={clearBookmarks}
                onClearLists={clearLists}
                bookmarkCount={bookmarks.size}
                bookmarks={bookmarks}
                readingLists={readingLists}
              />
            )}
          </div>
        </main>
      </div>

      {mobileFiltersOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileFiltersOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-80 max-w-[85vw] bg-stone-100 dark:bg-stone-900 overflow-y-auto animate-slide-in">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-stone-900 dark:text-stone-100">Filters</h2>
                <button
                  onClick={() => setMobileFiltersOpen(false)}
                  className="p-2 text-stone-500 hover:text-stone-900 dark:hover:text-stone-100"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-2">Search</label>
                  <input
                    type="text"
                    defaultValue={filters.search}
                    onChange={e => {
                      const value = e.target.value;
                      setTimeout(() => setFilters(prev => ({ ...prev, search: value })), 300);
                    }}
                    placeholder="Search papers..."
                    className="w-full px-3 py-2.5 text-sm bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-2">Sort</label>
                  <div className="flex gap-2">
                    {[{ label: 'Newest', value: 'newest' }, { label: 'Top Score', value: 'score' }].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setFilters(prev => ({ ...prev, sort: opt.value as 'newest' | 'score' }))}
                        className={`flex-1 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                          filters.sort === opt.value
                            ? 'bg-amber-700 text-white'
                            : 'bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-400 border border-stone-300 dark:border-stone-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-2">
                    Min Score: {filters.minScore}/7
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="7"
                    value={filters.minScore}
                    onChange={e => setFilters(prev => ({ ...prev, minScore: parseInt(e.target.value, 10) }))}
                    className="w-full h-2 bg-stone-300 dark:bg-stone-700 rounded-full appearance-none cursor-pointer accent-amber-600"
                  />
                </div>

                <button
                  onClick={() => setMobileFiltersOpen(false)}
                  className="w-full py-3 bg-amber-700 text-white font-medium rounded-lg mt-4"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      <MobileBottomNav
        activePage={activePage}
        setActivePage={setActivePage}
        onOpenFilters={() => setMobileFiltersOpen(true)}
      />

      <div className="md:hidden h-16" />
    </div>
  );
}

export default App;
