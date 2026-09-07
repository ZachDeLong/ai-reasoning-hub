import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  readJsonStorage,
  readStorageValue,
  writeJsonStorage,
  writeStorageValue,
} from './storage';

const isStringArray = (value: unknown): value is string[] => (
  Array.isArray(value) && value.every((item) => typeof item === 'string')
);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('storage recovery', () => {
  it('returns parsed JSON when it satisfies the stored schema', () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn().mockReturnValue('["2401.12345"]'),
    });

    expect(readJsonStorage('papers', isStringArray, () => [])).toEqual(['2401.12345']);
  });

  it.each(['{not-json', '{"unexpected":true}'])('falls back for invalid stored JSON: %s', (stored) => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn().mockReturnValue(stored),
    });

    expect(readJsonStorage('papers', isStringArray, () => ['fallback'])).toEqual(['fallback']);
  });

  it('falls back when storage access is blocked', () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => { throw new Error('blocked'); }),
    });

    expect(readStorageValue('theme', (value) => value, () => 'system')).toBe('system');
  });

  it('validates raw preferences before returning them', () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn().mockReturnValue('unexpected'),
    });

    const value = readStorageValue(
      'theme',
      (stored) => ['system', 'light', 'dark'].includes(stored) ? stored : undefined,
      () => 'system',
    );

    expect(value).toBe('system');
  });

  it('serializes JSON writes', () => {
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', { setItem });

    expect(writeJsonStorage('papers', ['2401.12345'])).toBe(true);
    expect(setItem).toHaveBeenCalledWith('papers', '["2401.12345"]');
  });

  it('does not throw when storage writes are blocked', () => {
    vi.stubGlobal('localStorage', {
      setItem: vi.fn(() => { throw new Error('quota exceeded'); }),
    });

    expect(writeStorageValue('theme', 'dark')).toBe(false);
    expect(writeJsonStorage('papers', ['2401.12345'])).toBe(false);
  });
});
