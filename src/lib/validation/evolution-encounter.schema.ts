import { z } from 'zod';

/**
 * Validation schema for POST /api/encounters/evolution
 *
 * Requires baseId and evolutionId (positive integers).
 * Optional seed is trimmed and limited to 128 characters.
 */
export const evolutionEncounterRequestSchema = z
  .object({
    baseId: z.number().int().min(1, 'baseId must be a positive integer'),
    evolutionId: z.number().int().min(1, 'evolutionId must be a positive integer'),
    seed: z
      .string()
      .trim()
      .min(1, 'Seed must contain at least 1 character')
      .max(128, 'Seed must not exceed 128 characters')
      .optional(),
  })
  .strict();

export type EvolutionEncounterRequestInput = z.infer<typeof evolutionEncounterRequestSchema>;
