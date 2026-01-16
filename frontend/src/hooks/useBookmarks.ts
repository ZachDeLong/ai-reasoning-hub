import { useState, useEffect, useCallback } from 'react';

interface UseBookmarksReturn {
  bookmarks: Set<string>;
  toggleBookmark: (arxivId: string) => void;
  isBookmarked: (arxivId: string) => boolean;
  clearBookmarks: () => void;
}

export const useBookmarks = (): UseBookmarksReturn => {
  const [bookmarks, setBookmarks] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('paper_bookmarks');
    return saved ? new Set(JSON.parse(saved) as string[]) : new Set();
  });

  useEffect(() => {
    localStorage.setItem('paper_bookmarks', JSON.stringify([...bookmarks]));
  }, [bookmarks]);

  const toggleBookmark = useCallback((arxivId: string) => {
    setBookmarks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(arxivId)) {
        newSet.delete(arxivId);
      } else {
        newSet.add(arxivId);
      }
      return newSet;
    });
  }, []);

  const isBookmarked = useCallback((arxivId: string) => bookmarks.has(arxivId), [bookmarks]);

  const clearBookmarks = useCallback(() => setBookmarks(new Set()), []);

  return { bookmarks, toggleBookmark, isBookmarked, clearBookmarks };
};
