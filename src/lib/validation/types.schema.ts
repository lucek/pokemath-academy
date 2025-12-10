import { z } from 'zod';

/**
 * Validation schema for GET /api/types query parameters.
 * The endpoint does not accept any parameters, so we enforce a strict empty object.
 */
export const typesListQuerySchema = z.object({}).strict();

/**
 * Inferred query params type, kept for future parity with other schemas.
 */
export type TypesListQueryParams = z.infer<typeof typesListQuerySchema>;
