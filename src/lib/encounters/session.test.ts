import { buildEncounterSession, deriveCorrectIndex, parseQuestion } from './session';
import pikachuSprite from '@/assets/icons/pikachu.png?url';
import { describe, expect, it } from 'vitest';

import type { EncounterResponseDto } from '../../types';

const createEncounter = (): EncounterResponseDto => ({
  encounterId: 'enc-1',
  pokemon: {
    id: 25,
    name: 'pikachu',
    sprite: pikachuSprite,
    isShiny: false,
    stage: 1,
    flavorText: null,
    types: [],
  },
  questions: [
    {
      id: 'q1',
      question: '3 + 4 = ?',
      options: [7, 8, 9, 10],
    },
  ],
  attemptsRemaining: 3,
});

describe('buildEncounterSession', () => {
  it('assigns correctIndex when correct answer is present', () => {
    const encounter = createEncounter();

    const session = buildEncounterSession(encounter, 'user-1', 5000);

    expect(session.questions[0]?.correctIndex).toBe(0);
    expect(session.userId).toBe('user-1');
    expect(session.encounterId).toBe(encounter.encounterId);
  });
});

describe('deriveCorrectIndex', () => {
  it('throws when the question cannot be parsed', () => {
    expect(() =>
      deriveCorrectIndex({
        id: 'bad',
        question: 'invalid format',
        options: [1, 2, 3, 4],
      }),
    ).toThrowError(/Unable to parse question/);
  });

  it('throws when the correct answer is missing', () => {
    expect(() =>
      deriveCorrectIndex({
        id: 'missing',
        question: '2 + 2 = ?',
        options: [1, 3, 5, 7],
      }),
    ).toThrowError(/Correct answer missing/);
  });
});

describe('parseQuestion', () => {
  it('parses addition, subtraction, and multiplication formats', () => {
    expect(parseQuestion('12 + 5 = ?')).toEqual({ operand1: 12, operator: '+', operand2: 5 });
    expect(parseQuestion('9-4= ?')).toEqual({ operand1: 9, operator: '-', operand2: 4 });
    expect(parseQuestion('7 * 3 = ?')).toEqual({ operand1: 7, operator: '*', operand2: 3 });
  });

  it('returns null for invalid formats', () => {
    expect(parseQuestion('who knows')).toBeNull();
    expect(parseQuestion('++ 1 = 2')).toBeNull();
  });
});
