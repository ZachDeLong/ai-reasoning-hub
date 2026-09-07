import { useState, useEffect, useCallback } from 'react';
import { readJsonStorage, writeJsonStorage } from '@/utils/storage';

interface UseBookmarksReturn {
  bookmarks: Set<string>;
  toggleBookmark: (arxivId: string) => void;
  isBookmarked: (arxivId: string) => boolean;
  clearBookmarks: () => void;
}

export const useBookmarks = (): UseBookmarksReturn => {
  const [bookmarks, setBookmarks] = useState<Set<string>>(() => {
    const saved = readJsonStorage(
      'paper_bookmarks',
      (value): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string'),
      () => [],
    );
    return new Set(saved);
  });

  useEffect(() => {
    writeJsonStorage('paper_bookmarks', [...bookmarks]);
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
