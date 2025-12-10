#!/usr/bin/env node
/* eslint-env node */
/* eslint-disable no-console */
/* global console, process */

import { createClient } from '@supabase/supabase-js';

function camelCaseKey(key) {
  return key.replaceAll(/-([a-z])/g, (_, char) => char.toUpperCase());
}

function parseArgs(argv) {
  const options = { variant: 'normal' };
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

function normalizeVariant(value) {
  const normalized = (value || 'normal').toLowerCase();
  if (normalized !== 'normal' && normalized !== 'shiny') {
    throw new TypeError("Variant must be either 'normal' or 'shiny'");
  }
  return normalized;
}

function normalizeCapturedAt(rawValue) {
  if (!rawValue) return new Date().toISOString();
  const parsed = new Date(rawValue);
  if (Number.isNaN(parsed.getTime())) {
    throw new TypeError('Invalid --captured-at value. Provide an ISO 8601 date.');
  }
  return parsed.toISOString();
}

function ensureUserId(value) {
  const uuidPattern = /^[\da-fA-F-]{36}$/;
  if (!value || !uuidPattern.test(value)) {
    throw new TypeError('Provide a valid --user-id (UUID v4).');
  }
  return value;
}

function ensurePokemonIdentifier(value) {
  if (!value) {
    throw new TypeError('Provide --pokemon as a name or Pokédex number.');
  }
  return value.toLowerCase();
}

async function assertUserExists(client, userId) {
  const { data, error } = await client.auth.admin.getUserById(userId);
  if (error) {
    throw new Error(`Unable to verify user (${userId}): ${error.message}`);
  }
  return data.user;
}

async function resolvePokemonId(client, identifier) {
  if (/^[0-9]+$/.test(identifier)) {
    return Number(identifier);
  }

  const { data, error } = await client
    .from('pokemon')
    .select('id, name')
    .eq('name', identifier)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to lookup Pokémon "${identifier}": ${error.message}`);
  }
  if (!data) {
    throw new Error(`Pokémon "${identifier}" not found in database.`);
  }
  return data.id;
}

async function findExistingCapture(client, { userId, pokemonId, variant }) {
  const { data, error } = await client
    .from('captured_pokemon')
    .select('id, captured_at')
    .eq('user_id', userId)
    .eq('pokemon_id', pokemonId)
    .eq('variant', variant)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to check existing capture: ${error.message}`);
  }
  return data;
}

async function insertCapture(client, payload) {
  const { data, error } = await client.from('captured_pokemon').insert(payload).select().single();
  if (error) {
    throw new Error(`Failed to insert capture: ${error.message}`);
  }
  return data;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const userId = ensureUserId(args.userId || args.userID || args.user);
  const pokemonIdentifier = ensurePokemonIdentifier(
    args.pokemon || args.pokemonId || args.pokemonName,
  );
  const variant = normalizeVariant(args.variant);
  const capturedAt = normalizeCapturedAt(args.capturedAt);

  const supabaseUrl = requireEnv('SUPABASE_URL', 'VITE_SUPABASE_URL');
  const supabaseServiceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY');

  const client = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, detectSessionInUrl: false },
    global: { headers: { 'x-client-info': '10x-pokemath-add-captured-pokemon-script' } },
  });

  await assertUserExists(client, userId);
  const pokemonId = await resolvePokemonId(client, pokemonIdentifier);

  const existing = await findExistingCapture(client, { userId, pokemonId, variant });
  if (existing) {
    console.log(
      `Capture already exists (user=${userId}, pokemon=${pokemonId}, variant=${variant}) captured_at=${existing.captured_at}`,
    );
    return;
  }

  const inserted = await insertCapture(client, {
    user_id: userId,
    pokemon_id: pokemonId,
    variant,
    captured_at: capturedAt,
  });

  console.log(
    `✅ Added capture: user=${inserted.user_id}, pokemon=${inserted.pokemon_id}, variant=${inserted.variant}, captured_at=${inserted.captured_at}`,
  );
}

try {
  await main();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
