import { z } from 'zod';

/**
 * Validation schema for GET /api/pokemon query parameters
 *
 * Validates all query parameters with appropriate constraints:
 * - type: optional positive integer for Pokemon type ID filtering
 * - search: optional string (1-50 chars) for full-text search on Pokemon name
 * - limit: number of results per page (1-151), defaults to 50
 * - offset: pagination offset (>= 0), defaults to 0
 *
 * Note: Uses .nullish() to handle both null (missing params) and undefined
 */
export const pokemonListQuerySchema = z.object({
  type: z
    .union([z.string(), z.number()])
    .pipe(z.coerce.number().int().positive())
    .nullish()
    .describe('Filter by Pokemon type ID'),

  search: z
    .string()
    .min(1, 'Search must be at least 1 character')
    .max(50, 'Search must be at most 50 characters')
    .trim()
    .nullish()
    .describe('Full-text search on Pokemon name'),

  limit: z
    .union([z.string(), z.number(), z.null()])
    .transform((val) => val ?? 50)
    .pipe(z.coerce.number().int().min(1).max(151))
    .describe('Number of results per page'),

  offset: z
    .union([z.string(), z.number(), z.null()])
    .transform((val) => val ?? 0)
    .pipe(z.coerce.number().int().min(0))
    .describe('Pagination offset'),
});

/**
 * Inferred TypeScript type from the validation schema
 */
export type PokemonListQueryParams = z.infer<typeof pokemonListQuerySchema>;

/**
 * Validation schema for GET /api/pokemon/:id path parameters
 */
export const pokemonDetailParamsSchema = z
  .object({
    id: z
      .union([z.string(), z.number()])
      .pipe(
        z.coerce
          .number()
          .int()
          .min(1, 'Pokemon ID must be at least 1')
          .max(151, 'Pokemon ID must be at most 151'),
      )
      .describe('Pokemon ID between 1 and 151'),
  })
  .strict();

export type PokemonDetailParams = z.infer<typeof pokemonDetailParamsSchema>;
