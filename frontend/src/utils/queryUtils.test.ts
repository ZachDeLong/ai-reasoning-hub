import { describe, expect, it } from 'vitest';

import { parseMinScoreParam, parsePageParam, parseSortParam } from './queryUtils';

describe('parsePageParam', () => {
  it('accepts non-negative safe integers', () => {
    expect(parsePageParam('0')).toBe(0);
    expect(parsePageParam('12')).toBe(12);
  });

  it.each([null, '', ' ', '-1', '1.5', 'nope', '9007199254740992'])(
    'falls back to page zero for %s',
    (value) => {
      expect(parsePageParam(value)).toBe(0);
    },
  );
});

describe('parseMinScoreParam', () => {
  it('accepts integer scores in the supported range', () => {
    expect(parseMinScoreParam('0', 3)).toBe(0);
    expect(parseMinScoreParam('7', 3)).toBe(7);
  });

  it.each([null, '', '-1', '8', '2.5', 'nope'])(
    'uses the configured fallback for %s',
    (value) => {
      expect(parseMinScoreParam(value, 3)).toBe(3);
    },
  );
});

describe('parseSortParam', () => {
  it('accepts known sort modes and rejects arbitrary URL values', () => {
    expect(parseSortParam('newest', 'score')).toBe('newest');
    expect(parseSortParam('score', 'newest')).toBe('score');
    expect(parseSortParam('random', 'newest')).toBe('newest');
    expect(parseSortParam(null, 'score')).toBe('score');
  });
});
