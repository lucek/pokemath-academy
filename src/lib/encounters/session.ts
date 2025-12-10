import type { EncounterResponseDto, EncounterSession, QuestionDto } from '../../types';

/**
 * Convert the externally facing encounter payload into an internal session
 * snapshot with correct answer metadata so that submissions can be verified.
 */
export function buildEncounterSession(
  encounter: EncounterResponseDto,
  userId: string,
  ttlMs: number,
): EncounterSession {
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + ttlMs);

  return {
    encounterId: encounter.encounterId,
    userId,
    pokemonId: encounter.pokemon.id,
    pokemonName: encounter.pokemon.name,
    pokemonSprite: encounter.pokemon.sprite,
    isShiny: encounter.pokemon.isShiny,
    stage: encounter.pokemon.stage,
    questions: encounter.questions.map((question) => ({
      id: question.id,
      question: question.question,
      options: [...question.options],
      correctIndex: deriveCorrectIndex(question),
    })),
    attemptsRemaining: encounter.attemptsRemaining,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

export function deriveCorrectIndex(question: QuestionDto): number {
  const parsed = parseQuestion(question.question);
  if (!parsed) {
    throw new Error(`[buildEncounterSession] Unable to parse question: ${question.question}`);
  }

  const correctAnswer = computeAnswer(parsed.operand1, parsed.operator, parsed.operand2);
  const index = question.options.findIndex((option) => option === correctAnswer);

  if (index === -1) {
    throw new Error(
      `[buildEncounterSession] Correct answer missing from options for question ${question.id}`,
    );
  }

  return index;
}

export function parseQuestion(
  question: string,
): { operand1: number; operator: '+' | '-' | '*'; operand2: number } | null {
  const match = question.match(/^\s*(\d+)\s*([+\-*])\s*(\d+)\s*=/);
  if (!match) {
    return null;
  }

  const operand1 = Number.parseInt(match[1], 10);
  const operator = match[2] as '+' | '-' | '*';
  const operand2 = Number.parseInt(match[3], 10);

  if (!Number.isFinite(operand1) || !Number.isFinite(operand2)) {
    return null;
  }

  return { operand1, operator, operand2 };
}

export function computeAnswer(
  operand1: number,
  operator: '+' | '-' | '*',
  operand2: number,
): number {
  if (operator === '+') {
    return operand1 + operand2;
  }

  if (operator === '-') {
    return operand1 - operand2;
  }

  return operand1 * operand2;
}
