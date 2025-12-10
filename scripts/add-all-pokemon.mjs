#!/usr/bin/env node
/* eslint-env node */
/* eslint-disable no-console */
/* global console, process */

import { createClient } from '@supabase/supabase-js';

function camelCaseKey(key) {
  return key.replaceAll(/-([a-z])/g, (_, char) => char.toUpperCase());
}

function parseArgs(argv) {
  const options = {
    start: 1,
    end: 151,
    variant: 'normal',
  };
  for (const rawArg of argv) {
    if (!rawArg.startsWith('--')) continue;
    const [rawKey, ...rest] = rawArg.slice(2).split('=');
    const key = camelCaseKey(rawKey);
    const value = rest.length > 0 ? rest.join('=') : 'true';
    options[key] = value;
  }
  return options;
}

function requireEnv(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  throw new TypeError(`Missing required environment variable: ${names.join(' or ')}`);
}

function ensureUserId(value) {
  const uuidPattern = /^[\da-fA-F-]{36}$/;
  if (!value || !uuidPattern.test(value)) {
    throw new TypeError('Provide a valid --user-id (UUID v4).');
  }
  return value;
}

function normalizeRange(rawStart, rawEnd) {
  const start = Number(rawStart ?? 1);
  const end = Number(rawEnd ?? start);

  if (!Number.isInteger(start) || start < 1) {
    throw new TypeError('--start must be a positive integer (>= 1).');
  }
  if (!Number.isInteger(end) || end < start) {
    throw new TypeError('--end must be an integer greater than or equal to --start.');
  }

  return { start, end };
}

function normalizeVariants(rawVariant) {
  const normalized = (rawVariant || 'normal').toLowerCase();
  if (normalized === 'both') return ['normal', 'shiny'];
  if (normalized === 'normal' || normalized === 'shiny') return [normalized];
  throw new TypeError('Variant must be one of: normal, shiny, both.');
}

function normalizeCapturedAt(rawValue) {
  if (!rawValue) return new Date().toISOString();
  const parsed = new Date(rawValue);
  if (Number.isNaN(parsed.getTime())) {
    throw new TypeError('Invalid --captured-at value. Provide an ISO 8601 date.');
  }
  return parsed.toISOString();
}

async function assertUserExists(client, userId) {
  const { data, error } = await client.auth.admin.getUserById(userId);
  if (error) {
    throw new Error(`Unable to verify user (${userId}): ${error.message}`);
  }
  return data.user;
}

async function fetchPokemonIds(client, { start, end }) {
  const { data, error } = await client
    .from('pokemon')
    .select('id, name')
    .gte('id', start)
    .lte('id', end)
    .order('id');

  if (error) {
    throw new Error(`Failed to read pokemon ids: ${error.message}`);
  }

  const expectedIds = new Set(Array.from({ length: end - start + 1 }, (_, i) => start + i));
  for (const row of data) {
    expectedIds.delete(row.id);
  }
  if (expectedIds.size > 0) {
    const missing = Array.from(expectedIds.values()).sort((a, b) => a - b);
    throw new Error(
      `Missing Pokémon in database for ids: ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? '...' : ''}`,
    );
  }

  return data.map((row) => row.id);
}

async function loadExistingCaptures(client, { userId, pokemonIds, variants }) {
  const { data, error } = await client
    .from('captured_pokemon')
    .select('pokemon_id, variant')
    .eq('user_id', userId)
    .in('pokemon_id', pokemonIds)
    .in('variant', variants);

  if (error) {
    throw new Error(`Failed to check existing captures: ${error.message}`);
  }

  const set = new Set();
  for (const row of data) {
    set.add(`${row.pokemon_id}:${row.variant}`);
  }
  return set;
}

async function insertCaptures(client, rows) {
  const { data, error } = await client
    .from('captured_pokemon')
    .upsert(rows, { onConflict: 'user_id,pokemon_id,variant' })
    .select('user_id, pokemon_id, variant, captured_at');

  if (error) {
    throw new Error(`Failed to insert captures: ${error.message}`);
  }
  return data;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const userId = ensureUserId(args.userId || args.userID || args.user);
  const { start, end } = normalizeRange(args.start, args.end);
  const variants = normalizeVariants(args.variant);
  const capturedAt = normalizeCapturedAt(args.capturedAt);
  const dryRun = String(args.dryRun || '').toLowerCase() === 'true';

  const supabaseUrl = requireEnv('SUPABASE_URL', 'VITE_SUPABASE_URL');
  const supabaseServiceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY');

  const client = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, detectSessionInUrl: false },
    global: { headers: { 'x-client-info': '10x-pokemath-add-all-pokemon-script' } },
  });

  await assertUserExists(client, userId);
  console.log(`[info] User verified: ${userId}`);

  const pokemonIds = await fetchPokemonIds(client, { start, end });
  console.log(`[info] Loaded ${pokemonIds.length} Pokémon ids (${start}-${end}).`);

  const existing = await loadExistingCaptures(client, { userId, pokemonIds, variants });
  const rows = [];

  for (const pokemonId of pokemonIds) {
    for (const variant of variants) {
      const key = `${pokemonId}:${variant}`;
      if (existing.has(key)) continue;
      rows.push({ user_id: userId, pokemon_id: pokemonId, variant, captured_at: capturedAt });
    }
  }

  if (rows.length === 0) {
    console.log(
      `[info] Nothing to insert. All requested captures already exist for user=${userId}.`,
    );
    return;
  }

  if (dryRun) {
    console.log(
      `[dry-run] Would insert ${rows.length} captures for user=${userId} with variants=${variants.join(', ')} (range ${start}-${end}).`,
    );
    return;
  }

  const inserted = await insertCaptures(client, rows);
  console.log(
    `✅ Inserted ${inserted.length} captures for user=${userId} (${variants.join(', ')}) from #${start} to #${end}.`,
  );
}

try {
  await main();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
