import { beforeEach, describe, expect, it } from 'vitest';

import { QuestionLruService } from './question-lru.service';

type QuestionStoreGlobal = typeof globalThis & {
  __POKEMATH_QUESTION_LRU__?: Map<string, string[]>;
};

const resetStore = (): Map<string, string[]> => {
  const globalWithStore = globalThis as QuestionStoreGlobal;
  if (!globalWithStore.__POKEMATH_QUESTION_LRU__) {
    globalWithStore.__POKEMATH_QUESTION_LRU__ = new Map();
  }
  globalWithStore.__POKEMATH_QUESTION_LRU__.clear();
  return globalWithStore.__POKEMATH_QUESTION_LRU__;
};

describe('QuestionLruService.record', () => {
  beforeEach(() => {
    resetStore();
  });

  it('adds ids and moves existing ones to the end', () => {
    QuestionLruService.record('user', ['q1', 'q2']);
    expect(QuestionLruService.recent('user')).toEqual(['q1', 'q2']);

    QuestionLruService.record('user', 'q1');
    expect(QuestionLruService.recent('user')).toEqual(['q2', 'q1']);
  });

  it('keeps only the 50 most recent entries', () => {
    const manyIds = Array.from({ length: 55 }, (_, index) => `q${index}`);

    QuestionLruService.record('user', manyIds);

    const history = QuestionLruService.recent('user');
    expect(history).toHaveLength(50);
    expect(history[0]).toBe('q5');
    expect(history.at(-1)).toBe('q54');
    expect(history).not.toContain('q0');
    expect(history).not.toContain('q4');
  });

  it('ignores empty userId and empty question lists', () => {
    QuestionLruService.record('', ['q1']);
    QuestionLruService.record('user', []);

    expect(QuestionLruService.recent('')).toEqual([]);
    expect(QuestionLruService.recent('user')).toEqual([]);
  });
});

describe('QuestionLruService.recent', () => {
  beforeEach(() => {
    resetStore();
  });

  it('returns a copy that does not mutate the original store', () => {
    QuestionLruService.record('user', ['q1']);

    const history = QuestionLruService.recent('user');
    history.push('new');

    expect(QuestionLruService.recent('user')).toEqual(['q1']);
    expect(history).toEqual(['q1', 'new']);
  });
});
