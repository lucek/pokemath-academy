import { z } from 'zod';

/**
 * Validation schema for POST /api/encounters/submit
 *
 * Ensures the encounter identifier is a valid UUID and that each answer
 * references a known question identifier while constraining the selected
 * option to the 1-4 range used by the UI buttons.
 */
export const encounterSubmitRequestSchema = z
  .object({
    encounterId: z.string().uuid(),
    answers: z
      .array(
        z
          .object({
            questionId: z.string().min(1),
            selectedOption: z.number().int().min(1).max(4),
          })
          .strict(),
      )
      .min(1)
      .max(10),
  })
  .strict();

export type EncounterSubmitRequestInput = z.infer<typeof encounterSubmitRequestSchema>;
