import { z } from 'zod';

const emptyToUndefined = <T>(value: T | '' | null | undefined): T | undefined =>
  value === '' || value == null ? undefined : value;

const booleanParam = z
  .union([z.string(), z.boolean(), z.null()])
  .transform((value) => emptyToUndefined(value))
  .pipe(z.coerce.boolean().optional());

const positiveIntParam = z
  .union([z.string(), z.number(), z.null()])
  .transform((value) => emptyToUndefined(value))
  .pipe(z.coerce.number().int().positive().optional());

const limitParam = z
  .union([z.string(), z.number(), z.null()])
  .transform((value) => (value === '' || value == null ? 50 : value))
  .pipe(z.coerce.number().int().min(1).max(302));

const offsetParam = z
  .union([z.string(), z.number(), z.null()])
  .transform((value) => (value === '' || value == null ? 0 : value))
  .pipe(z.coerce.number().int().min(0));

/**
 * Validation schema for GET /api/collection query parameters.
 * Applies coercion + sane defaults so downstream layers can rely on strong types.
 */
export const collectionQuerySchema = z
  .object({
    caught: booleanParam.describe('Filter by capture status'),
    type: positiveIntParam.describe('Filter by Pokemon type ID'),
    shiny: booleanParam.describe('Filter by shiny variant (captured only)'),
    sort: z
      .union([z.literal('pokedex'), z.literal('name'), z.literal('date'), z.null()])
      .transform((value) => value ?? 'pokedex')
      .describe('Sort field'),
    order: z
      .union([z.literal('asc'), z.literal('desc'), z.null()])
      .transform((value) => value ?? 'asc')
      .describe('Sort direction'),
    limit: limitParam.describe('Page size'),
    offset: offsetParam.describe('Page offset'),
  })
  .strict();

export type CollectionQueryInput = z.infer<typeof collectionQuerySchema>;
