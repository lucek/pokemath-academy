const GLOBAL_STORE_KEY = '__POKEMATH_QUESTION_LRU__';
const MAX_RECENT_QUESTIONS = 50;

type GlobalWithQuestionLru = typeof globalThis & {
  [GLOBAL_STORE_KEY]?: Map<string, string[]>;
};

const getStore = (): Map<string, string[]> => {
  const globalWithStore = globalThis as GlobalWithQuestionLru;
  const store = (globalWithStore[GLOBAL_STORE_KEY] ??= new Map<string, string[]>());
  return store;
};

const questionStore = getStore();

/**
 * Tracks recently served questions per user to reduce repetition in future encounters.
 * Currently backed by an in-memory Map and limited to the latest 50 question hashes.
 */
export const QuestionLruService = {
  record(userId: string, questionIds: string | string[]): void {
    if (!userId) {
      return;
    }

    const normalized = Array.isArray(questionIds) ? questionIds : [questionIds];
    if (normalized.length === 0) {
      return;
    }

    const entry = ensureEntry(userId);
    for (const questionId of normalized) {
      if (!questionId) {
        continue;
      }

      const existingIndex = entry.indexOf(questionId);
      if (existingIndex !== -1) {
        entry.splice(existingIndex, 1);
      }

      entry.push(questionId);
      if (entry.length > MAX_RECENT_QUESTIONS) {
        entry.shift();
      }
    }
  },

  recent(userId: string): string[] {
    const entry = questionStore.get(userId);
    return entry ? [...entry] : [];
  },
} as const;

function ensureEntry(userId: string): string[] {
  const existing = questionStore.get(userId);
  if (existing) {
    return existing;
  }

  const created: string[] = [];
  questionStore.set(userId, created);
  return created;
}
