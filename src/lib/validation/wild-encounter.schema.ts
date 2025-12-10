import { z } from 'zod';

/**
 * Validation schema for POST /api/encounters/wild
 *
 * Accepts optional seed string used to drive deterministic RNG for the encounter.
 * Seed is trimmed, limited to 128 characters, and must contain at least one
 * non-space character when provided.
 */
export const wildEncounterRequestSchema = z
  .object({
    seed: z
      .string()
      .trim()
      .min(1, 'Seed must contain at least 1 character')
      .max(128, 'Seed must not exceed 128 characters')
      .optional(),
  })
  .strict();

export type WildEncounterRequestInput = z.infer<typeof wildEncounterRequestSchema>;
