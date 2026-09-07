import { useState, useEffect, useCallback } from 'react';
import { DEFAULT_LISTS } from '@/constants';
import { readJsonStorage, writeJsonStorage } from '@/utils/storage';

export type ReadingLists = Record<string, string[]>;

interface UseReadingListsReturn {
  readingLists: ReadingLists;
  addToList: (arxivId: string, listName: string | null) => void;
  removeFromList: (arxivId: string, listName: string) => void;
  getListForPaper: (arxivId: string) => string | null;
  getListNames: () => string[];
  getListCount: (listName: string) => number;
  clearLists: () => void;
}

const createEmptyLists = (): ReadingLists => {
  return DEFAULT_LISTS.reduce((acc, name) => {
    acc[name] = [];
    return acc;
  }, {} as ReadingLists);
};

const isReadingLists = (value: unknown): value is ReadingLists => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return Object.values(value).every(
    (papers) => Array.isArray(papers) && papers.every((paperId) => typeof paperId === 'string'),
  );
};

export const useReadingLists = (): UseReadingListsReturn => {
  const [readingLists, setReadingLists] = useState<ReadingLists>(() => {
    const saved = readJsonStorage('reading_lists', isReadingLists, () => ({}));
    return { ...createEmptyLists(), ...saved };
  });

  useEffect(() => {
    writeJsonStorage('reading_lists', readingLists);
  }, [readingLists]);

  const addToList = useCallback((arxivId: string, listName: string | null) => {
    setReadingLists(prev => {
      const updated = { ...prev };
      // Remove from all lists first
      Object.keys(updated).forEach(list => {
        updated[list] = updated[list].filter(id => id !== arxivId);
      });
      // Add to the selected list
      if (listName && updated[listName]) {
        updated[listName] = [...updated[listName], arxivId];
      }
      return updated;
    });
  }, []);

  const removeFromList = useCallback((arxivId: string, listName: string) => {
    setReadingLists(prev => ({
      ...prev,
      [listName]: prev[listName].filter(id => id !== arxivId)
    }));
  }, []);

  const getListForPaper = useCallback((arxivId: string): string | null => {
    for (const [listName, papers] of Object.entries(readingLists)) {
      if (papers.includes(arxivId)) {
        return listName;
      }
    }
    return null;
  }, [readingLists]);

  const getListNames = useCallback(() => Object.keys(readingLists), [readingLists]);

  const getListCount = useCallback((listName: string) => readingLists[listName]?.length || 0, [readingLists]);

  const clearLists = useCallback(() => {
    setReadingLists(createEmptyLists());
  }, []);

  return { readingLists, addToList, removeFromList, getListForPaper, getListNames, getListCount, clearLists };
};
