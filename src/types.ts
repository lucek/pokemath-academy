/**
 * DTO and Command Model Type Definitions for PokéMath API
 *
 * This file contains all Data Transfer Objects (DTOs) and Command Models
 * used in the REST API, derived from database entity types.
 */

import type { Enums, Tables } from './db/database.types';

// ============================================================================
// DATABASE ENTITY ALIASES
// ============================================================================

/** Base Pokemon entity from database */
export type PokemonEntity = Tables<'pokemon'>;

/** Captured Pokemon entity from database */
export type CapturedPokemonEntity = Tables<'captured_pokemon'>;

/** Pokemon type entity from database */
export type TypeEntity = Tables<'types'>;

/** Pokemon-type junction entity from database */
export type PokemonTypeEntity = Tables<'pokemon_types'>;

/** Pokemon evolution entity from database */
export type PokemonEvolutionEntity = Tables<'pokemon_evolutions'>;

/** User profile entity from database */
export type ProfileEntity = Tables<'profiles'>;

/** Collection view entity from database */
export type MyCollectionViewEntity = Tables<'my_collection_vw'>;

/** User capture stats view entity from database */
export type UserCaptureStatsEntity = Tables<'user_capture_stats'>;

/** Variant enum type from database */
export type VariantEnum = Enums<'variant_enum'>;

// ============================================================================
// POKEMON DTOs
// ============================================================================

/**
 * Pokemon stats structure as stored in JSONB
 */
export interface PokemonStatsDto {
  height: number;
  weight: number;
  hp: number;
  attack: number;
  defense: number;
  speed: number;
}

/**
 * Pokemon sprites structure as stored in JSONB
 */
export interface PokemonSpritesDto {
  front_default: string;
  front_shiny: string;
}

/**
 * Type information with slot for Pokemon
 * Derived from TypeEntity + slot from junction table
 */
export interface PokemonTypeDto {
  id: number;
  name: string;
  slot: number;
}

/**
 * Simplified evolution line information returned by the backend.
 */
export interface EvolutionLineEntryDto {
  id: number;
  name: string;
  sprite: string;
  types?: PokemonTypeDto[];
  in_collection: boolean;
  is_current: boolean;
  base_id: number | null;
  can_evolve: boolean;
}

export interface EvolutionLineDto {
  pokemon: {
    id: number;
    name: string;
    sprite: string;
    in_collection: boolean;
  };
  evolutions: EvolutionLineEntryDto[];
}

/**
 * Pokemon list item for GET /api/pokemon
 * Extended from PokemonEntity with parsed types
 */
export interface PokemonListItemDto {
  id: number;
  name: string;
  stats: PokemonStatsDto;
  sprites: PokemonSpritesDto;
  flavor_text: string | null;
  types: PokemonTypeDto[];
  region: string | null;
}

/**
 * Detailed Pokemon information for GET /api/pokemon/:id
 * Extended from PokemonListItemDto with evolutions, capture status and timestamps
 */
export type PokemonDetailDto = PokemonListItemDto & {
  evolution_line?: EvolutionLineDto | null;
  capture_status?: PokemonCaptureStatusDto | null;
  created_at: string | null;
};

/**
 * Capture ownership information for a Pokemon
 */
export interface PokemonCaptureStatusDto {
  baseId: number;
  isBaseCaught: boolean;
  owned: {
    variant: 'normal' | 'shiny';
    capturedAt: string | null;
  }[];
}

/**
 * Type information for GET /api/types
 * Direct mapping from TypeEntity
 */
export interface TypeDto {
  id: number;
  name: string;
}

/**
 * Pagination metadata for list endpoints
 */
export interface PaginationDto {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/**
 * Response wrapper for GET /api/pokemon
 */
export interface PokemonListResponseDto {
  data: PokemonListItemDto[];
  pagination: PaginationDto;
}

/**
 * Response wrapper for GET /api/types
 */
export interface TypeListResponseDto {
  data: TypeDto[];
}

// ============================================================================
// ENCOUNTER DTOs
// ============================================================================

/**
 * Pokemon information in encounter context
 */
export interface EncounterPokemonDto {
  id: number;
  name: string;
  sprite: string;
  isShiny: boolean;
  stage: 1 | 2 | 3;
  flavorText: string | null;
  types: PokemonTypeDto[];
}

/**
 * Math question with multiple choice options
 * Options are returned as array where index determines button position (0-3)
 */
export interface QuestionDto {
  id: string;
  question: string;
  options: number[];
}

/**
 * Request body for POST /api/encounters/wild
 */
export interface EncounterWildRequestDto {
  seed?: string;
}

/**
 * Request body for POST /api/encounters/evolution
 */
export interface EncounterEvolutionRequestDto {
  baseId: number;
  evolutionId: number;
  seed?: string;
}

/**
 * Response for POST /api/encounters/wild and POST /api/encounters/evolution
 */
export interface EncounterResponseDto {
  encounterId: string;
  pokemon: EncounterPokemonDto;
  questions: QuestionDto[];
  attemptsRemaining: number;
}

/**
 * Individual answer in encounter submission
 * selectedOption is 1-4 representing frontend button number
 */
export interface AnswerDto {
  questionId: string;
  selectedOption: number;
}

/**
 * Request body for POST /api/encounters/submit
 */
export interface EncounterSubmitRequestDto {
  encounterId: string;
  answers: AnswerDto[];
}

/**
 * Score information in submission response
 */
export interface EncounterScoreDto {
  correct: number;
  total: number;
}

/**
 * Captured Pokemon information in successful submission
 */
export interface CapturedPokemonDto {
  id: number;
  name: string;
  sprite: string;
  variant: VariantEnum;
  capturedAt?: string;
}

/**
 * Success response for POST /api/encounters/submit (captured)
 */
export interface EncounterSubmitSuccessDto {
  success: true;
  result: 'captured';
  score: EncounterScoreDto;
  pokemon: CapturedPokemonDto;
  newCapture: boolean;
}

/**
 * Success response for POST /api/encounters/submit (already captured)
 */
export interface EncounterSubmitDuplicateDto {
  success: true;
  result: 'already_captured';
  score: EncounterScoreDto;
  pokemon: Omit<CapturedPokemonDto, 'capturedAt'>;
  newCapture: false;
  message: string;
}

/**
 * Failure response for POST /api/encounters/submit
 */
export interface EncounterSubmitFailureDto {
  success: false;
  result: 'failed';
  score: EncounterScoreDto;
  attemptsRemaining: number;
  canRetry: boolean;
  message: string;
}

/**
 * Union type for all possible encounter submission responses
 */
export type EncounterSubmitResponseDto =
  | EncounterSubmitSuccessDto
  | EncounterSubmitDuplicateDto
  | EncounterSubmitFailureDto;

// ============================================================================
// COLLECTION DTOs
// ============================================================================

/**
 * Collection item for GET /api/collection
 * Derived from MyCollectionViewEntity with parsed types
 */
export interface CollectionItemDto {
  pokemonId: number;
  name: string;
  sprites: PokemonSpritesDto;
  types: PokemonTypeDto[];
  variant: VariantEnum;
  capturedAt: string | null;
  isCaught: boolean;
}

/**
 * Response wrapper for GET /api/collection
 */
export interface CollectionResponseDto {
  data: CollectionItemDto[];
  pagination: PaginationDto;
}

/**
 * Type breakdown for collection stats
 */
export interface TypeBreakdownDto {
  typeId: number;
  typeName: string;
  count: number;
}

/**
 * Recent capture information for stats
 */
export interface RecentCaptureDto {
  pokemonId: number;
  name: string;
  sprite: string;
  variant: VariantEnum;
  capturedAt: string;
}

/**
 * Variant breakdown for collection stats
 */
export interface VariantBreakdownDto {
  normal: number;
  shiny: number;
}

/**
 * Collection statistics for GET /api/collection/stats
 * Derived from UserCaptureStatsEntity with additional computed fields
 */
export interface CollectionStatsDto {
  totalCaptured: number;
  totalPossible: number;
  percentage: number;
  shinyCount: number;
  variantBreakdown: VariantBreakdownDto;
  typeBreakdown: TypeBreakdownDto[];
  recentCaptures: RecentCaptureDto[];
}

// ============================================================================
// PROFILE DTOs
// ============================================================================

/**
 * Profile stats summary
 */
export interface ProfileStatsDto {
  totalCaptured: number;
  shinyCount: number;
}

/**
 * User profile for GET /api/profile
 * Derived from ProfileEntity with stats
 */
export interface ProfileDto {
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: string | null;
  stats: ProfileStatsDto;
}

/**
 * Request body for PUT /api/profile
 * Partial update allowed for profile fields
 */
export interface ProfileUpdateRequestDto {
  displayName?: string;
  avatarUrl?: string;
}

/**
 * Response for PUT /api/profile
 * Returns full profile without stats
 */
export type ProfileUpdateResponseDto = Omit<ProfileDto, 'stats'>;

// ============================================================================
// UTILITY DTOs
// ============================================================================

/**
 * Health check response for GET /api/health
 */
export interface HealthCheckDto {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  database: 'connected' | 'disconnected';
  version: string;
}

/**
 * Error details structure
 */
export type ErrorDetailsDto = Record<string, unknown>;

/**
 * Standard error response format for all endpoints
 */
export interface ErrorResponseDto {
  error: {
    code: string;
    message: string;
    details?: ErrorDetailsDto;
  };
}

// ============================================================================
// QUERY PARAMETER TYPES
// ============================================================================

/**
 * Query parameters for GET /api/pokemon
 */
export interface PokemonListQueryParams {
  type?: number;
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Query parameters for GET /api/collection
 */
export interface CollectionQueryParams {
  caught?: boolean;
  type?: number;
  shiny?: boolean;
  sort?: 'pokedex' | 'name' | 'date';
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

// ============================================================================
// COMMAND MODELS (for internal business logic)
// ============================================================================

/**
 * Command to create a wild encounter
 * Used internally by encounter service
 */
export interface CreateWildEncounterCommand {
  userId: string;
  seed?: string;
}

/**
 * Command to create an evolution encounter
 * Used internally by encounter service
 */
export interface CreateEvolutionEncounterCommand {
  userId: string;
  baseId: number;
  evolutionId: number;
  seed?: string;
}

/**
 * Command to submit encounter answers
 * Used internally by encounter service
 */
export interface SubmitEncounterCommand {
  userId: string;
  encounterId: string;
  answers: AnswerDto[];
}

/**
 * Command to capture a Pokemon
 * Used internally by collection service
 */
export interface CapturePokemonCommand {
  userId: string;
  pokemonId: number;
  variant: VariantEnum;
}

/**
 * Command to release a Pokemon from collection
 * Used internally by collection service
 */
export interface ReleasePokemonCommand {
  userId: string;
  pokemonId: number;
  variant: VariantEnum;
}

/**
 * Command to update user profile
 * Used internally by profile service
 */
export interface UpdateProfileCommand {
  userId: string;
  displayName?: string;
  avatarUrl?: string;
}

/**
 * Internal representation of an encounter session
 * Stored in Redis or in-memory cache
 */
export interface EncounterSession {
  encounterId: string;
  userId: string;
  pokemonId: number;
  pokemonName: string;
  pokemonSprite: string;
  isShiny: boolean;
  stage: 1 | 2 | 3;
  questions: {
    id: string;
    question: string;
    options: number[];
    correctIndex: number; // Internal: 0-3 array index of correct answer
  }[];
  attemptsRemaining: number;
  createdAt: string;
  expiresAt: string;
}

/**
 * Internal representation of a generated math question
 * Used during question generation before storing in session
 */
export interface GeneratedQuestion {
  operand1: number;
  operator: '+' | '-' | '*' | '/';
  operand2: number;
  correctAnswer: number;
  distractors: number[];
}

/**
 * LRU cache entry for question deduplication
 * Stored per-user to avoid showing recent questions
 */
export interface QuestionCacheEntry {
  userId: string;
  questionHash: string;
  operand1: number;
  operator: string;
  operand2: number;
  result: number;
  generatedAt: string;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard to check if submission response is success
 */
export function isEncounterSuccess(
  response: EncounterSubmitResponseDto,
): response is EncounterSubmitSuccessDto | EncounterSubmitDuplicateDto {
  return response.success === true;
}

/**
 * Type guard to check if submission response is failure
 */
export function isEncounterFailure(
  response: EncounterSubmitResponseDto,
): response is EncounterSubmitFailureDto {
  return response.success === false;
}

/**
 * Type guard to check if submission is new capture
 */
export function isNewCapture(
  response: EncounterSubmitResponseDto,
): response is EncounterSubmitSuccessDto {
  return response.success === true && response.result === 'captured';
}

/**
 * Type guard to check if submission is duplicate capture
 */
export function isDuplicateCapture(
  response: EncounterSubmitResponseDto,
): response is EncounterSubmitDuplicateDto {
  return response.success === true && response.result === 'already_captured';
}
