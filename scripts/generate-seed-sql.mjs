#!/usr/bin/env node
/* eslint-env node */
/* eslint-disable no-console */
/* global console, process */

/**
 * Generate database seed SQL from PokeAPI data
 *
 * This script reads the preprocessed PokeAPI data and generates SQL INSERT statements
 * compatible with the Supabase migration schema.
 */

import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const POKEAPI_DATA_DIR = join(__dirname, '../supabase/pokeapi_data');
const OUTPUT_FILE = join(__dirname, '../supabase/seed.sql');

// Type name to ID mapping based on PokeAPI
const TYPE_NAME_TO_ID = {
  normal: 1,
  fighting: 2,
  flying: 3,
  poison: 4,
  ground: 5,
  rock: 6,
  bug: 7,
  ghost: 8,
  steel: 9,
  fire: 10,
  water: 11,
  grass: 12,
  electric: 13,
  psychic: 14,
  ice: 15,
  dragon: 16,
  dark: 17,
  fairy: 18,
};

/**
 * Escape single quotes for SQL
 */
function escapeSql(str) {
  if (str === null || str === undefined) return 'NULL';
  return str.toString().replace(/'/g, "''");
}

/**
 * Convert JS object to SQL-safe JSONB literal
 */
function toJsonb(obj) {
  return `'${escapeSql(JSON.stringify(obj))}'::jsonb`;
}

/**
 * Load all type files and generate INSERT statements
 */
function generateTypesInserts() {
  const typesDir = join(POKEAPI_DATA_DIR, 'types');
  const typeFiles = readdirSync(typesDir).filter((f) => f.endsWith('.json'));

  const inserts = [];

  for (const file of typeFiles) {
    const data = JSON.parse(readFileSync(join(typesDir, file), 'utf-8'));
    const typeId = data.id;
    const typeName = data.name;

    inserts.push(`(${typeId}, '${escapeSql(typeName)}')`);
  }

  return inserts;
}

/**
 * Load all pokemon files and generate INSERT statements
 */
function generatePokemonInserts() {
  const pokemonDir = join(POKEAPI_DATA_DIR, 'pokemon');
  const pokemonFiles = readdirSync(pokemonDir)
    .filter((f) => f.endsWith('.json'))
    .sort((a, b) => {
      const idA = parseInt(a.split('-')[0]);
      const idB = parseInt(b.split('-')[0]);
      return idA - idB;
    });

  const pokemonInserts = [];
  const pokemonTypesInserts = [];

  for (const file of pokemonFiles) {
    const data = JSON.parse(readFileSync(join(pokemonDir, file), 'utf-8'));

    // Build stats JSONB object
    const stats = {
      height: data.height,
      weight: data.weight,
      hp: data.hp,
      attack: data.attack,
      defense: data.defense,
      speed: data.speed,
    };

    // Store full sprites object as JSONB
    const sprites = data.sprites;

    // Flavor text (Pokédex description)
    const flavorText = data.flavor_text ? `'${escapeSql(data.flavor_text)}'` : 'NULL';

    // All Gen 1 Pokemon are from Kanto region
    const region = 'kanto';

    // Pokemon insert (types are stored in pokemon_types junction table)
    pokemonInserts.push(
      `(${data.id}, '${escapeSql(data.name)}', ${toJsonb(stats)}, ${toJsonb(sprites)}, ${flavorText}, '${region}')`,
    );

    // Pokemon types junction table inserts
    for (const type of data.types) {
      const typeId = TYPE_NAME_TO_ID[type.name.toLowerCase()];
      if (!typeId) {
        console.warn(`Warning: Unknown type "${type.name}" for pokemon ${data.name}`);
        continue;
      }

      pokemonTypesInserts.push(`(${data.id}, ${typeId}, ${type.slot})`);
    }
  }

  return { pokemonInserts, pokemonTypesInserts };
}

/**
 * Generate evolution data
 * Note: This is a simplified version. Full evolution chains would require
 * additional data from PokeAPI evolution-chain endpoint.
 *
 * For now, we'll generate basic evolutions based on Gen 1 knowledge.
 */
function generateEvolutionInserts() {
  // Basic Gen 1 evolution chains (base_id, evolution_id, trigger)
  const evolutions = [
    // Bulbasaur line
    { base: 1, evo: 2, trigger: { min_level: 16 } },
    { base: 2, evo: 3, trigger: { min_level: 32 } },

    // Charmander line
    { base: 4, evo: 5, trigger: { min_level: 16 } },
    { base: 5, evo: 6, trigger: { min_level: 36 } },

    // Squirtle line
    { base: 7, evo: 8, trigger: { min_level: 16 } },
    { base: 8, evo: 9, trigger: { min_level: 36 } },

    // Caterpie line
    { base: 10, evo: 11, trigger: { min_level: 7 } },
    { base: 11, evo: 12, trigger: { min_level: 10 } },

    // Weedle line
    { base: 13, evo: 14, trigger: { min_level: 7 } },
    { base: 14, evo: 15, trigger: { min_level: 10 } },

    // Pidgey line
    { base: 16, evo: 17, trigger: { min_level: 18 } },
    { base: 17, evo: 18, trigger: { min_level: 36 } },

    // Rattata line
    { base: 19, evo: 20, trigger: { min_level: 20 } },

    // Spearow line
    { base: 21, evo: 22, trigger: { min_level: 20 } },

    // Ekans line
    { base: 23, evo: 24, trigger: { min_level: 22 } },

    // Pikachu line
    { base: 25, evo: 26, trigger: { item: 'thunder-stone' } },

    // Sandshrew line
    { base: 27, evo: 28, trigger: { min_level: 22 } },

    // Nidoran♀ line
    { base: 29, evo: 30, trigger: { min_level: 16 } },
    { base: 30, evo: 31, trigger: { item: 'moon-stone' } },

    // Nidoran♂ line
    { base: 32, evo: 33, trigger: { min_level: 16 } },
    { base: 33, evo: 34, trigger: { item: 'moon-stone' } },

    // Clefairy line
    { base: 35, evo: 36, trigger: { item: 'moon-stone' } },

    // Vulpix line
    { base: 37, evo: 38, trigger: { item: 'fire-stone' } },

    // Jigglypuff line
    { base: 39, evo: 40, trigger: { item: 'moon-stone' } },

    // Zubat line
    { base: 41, evo: 42, trigger: { min_level: 22 } },

    // Oddish line
    { base: 43, evo: 44, trigger: { min_level: 21 } },
    { base: 44, evo: 45, trigger: { item: 'leaf-stone' } },

    // Paras line
    { base: 46, evo: 47, trigger: { min_level: 24 } },

    // Venonat line
    { base: 48, evo: 49, trigger: { min_level: 31 } },

    // Diglett line
    { base: 50, evo: 51, trigger: { min_level: 26 } },

    // Meowth line
    { base: 52, evo: 53, trigger: { min_level: 28 } },

    // Psyduck line
    { base: 54, evo: 55, trigger: { min_level: 33 } },

    // Mankey line
    { base: 56, evo: 57, trigger: { min_level: 28 } },

    // Growlithe line
    { base: 58, evo: 59, trigger: { item: 'fire-stone' } },

    // Poliwag line
    { base: 60, evo: 61, trigger: { min_level: 25 } },
    { base: 61, evo: 62, trigger: { item: 'water-stone' } },

    // Abra line
    { base: 63, evo: 64, trigger: { min_level: 16 } },
    { base: 64, evo: 65, trigger: { trade: true } },

    // Machop line
    { base: 66, evo: 67, trigger: { min_level: 28 } },
    { base: 67, evo: 68, trigger: { trade: true } },

    // Bellsprout line
    { base: 69, evo: 70, trigger: { min_level: 21 } },
    { base: 70, evo: 71, trigger: { item: 'leaf-stone' } },

    // Tentacool line
    { base: 72, evo: 73, trigger: { min_level: 30 } },

    // Geodude line
    { base: 74, evo: 75, trigger: { min_level: 25 } },
    { base: 75, evo: 76, trigger: { trade: true } },

    // Ponyta line
    { base: 77, evo: 78, trigger: { min_level: 40 } },

    // Slowpoke line
    { base: 79, evo: 80, trigger: { min_level: 37 } },

    // Magnemite line
    { base: 81, evo: 82, trigger: { min_level: 30 } },

    // Doduo line
    { base: 84, evo: 85, trigger: { min_level: 31 } },

    // Seel line
    { base: 86, evo: 87, trigger: { min_level: 34 } },

    // Grimer line
    { base: 88, evo: 89, trigger: { min_level: 38 } },

    // Shellder line
    { base: 90, evo: 91, trigger: { item: 'water-stone' } },

    // Gastly line
    { base: 92, evo: 93, trigger: { min_level: 25 } },
    { base: 93, evo: 94, trigger: { trade: true } },

    // Onix line
    // Note: Steelix is Gen 2, skipping

    // Drowzee line
    { base: 96, evo: 97, trigger: { min_level: 26 } },

    // Krabby line
    { base: 98, evo: 99, trigger: { min_level: 28 } },

    // Voltorb line
    { base: 100, evo: 101, trigger: { min_level: 30 } },

    // Exeggcute line
    { base: 102, evo: 103, trigger: { item: 'leaf-stone' } },

    // Cubone line
    { base: 104, evo: 105, trigger: { min_level: 28 } },

    // Koffing line
    { base: 109, evo: 110, trigger: { min_level: 35 } },

    // Rhyhorn line
    { base: 111, evo: 112, trigger: { min_level: 42 } },

    // Horsea line
    { base: 116, evo: 117, trigger: { min_level: 32 } },

    // Goldeen line
    { base: 118, evo: 119, trigger: { min_level: 33 } },

    // Staryu line
    { base: 120, evo: 121, trigger: { item: 'water-stone' } },

    // Magikarp line
    { base: 129, evo: 130, trigger: { min_level: 20 } },

    // Eevee lines
    { base: 133, evo: 134, trigger: { item: 'water-stone' } }, // Vaporeon
    { base: 133, evo: 135, trigger: { item: 'thunder-stone' } }, // Jolteon
    { base: 133, evo: 136, trigger: { item: 'fire-stone' } }, // Flareon

    // Omanyte line
    { base: 138, evo: 139, trigger: { min_level: 40 } },

    // Kabuto line
    { base: 140, evo: 141, trigger: { min_level: 40 } },

    // Dratini line
    { base: 147, evo: 148, trigger: { min_level: 30 } },
    { base: 148, evo: 149, trigger: { min_level: 55 } },
  ];

  const inserts = evolutions.map((evo) => `(${evo.base}, ${evo.evo}, ${toJsonb(evo.trigger)})`);

  return inserts;
}

/**
 * Main generation function
 */
function generateSeedSql() {
  console.log('🌱 Generating database seed...');

  // Generate all inserts
  console.log('📦 Processing types...');
  const typeInserts = generateTypesInserts();

  console.log('📦 Processing pokemon...');
  const { pokemonInserts, pokemonTypesInserts } = generatePokemonInserts();

  console.log('📦 Processing evolutions...');
  const evolutionInserts = generateEvolutionInserts();

  // Build SQL file
  const sql = `-- Migration: Seed database with Pokemon data
-- Description: Insert all Gen 1 Pokemon, types, and evolution data from PokeAPI
-- Generated: ${new Date().toISOString()}

-- Disable RLS for seeding
ALTER TABLE types DISABLE ROW LEVEL SECURITY;
ALTER TABLE pokemon DISABLE ROW LEVEL SECURITY;
ALTER TABLE pokemon_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE pokemon_evolutions DISABLE ROW LEVEL SECURITY;

-- Insert types
INSERT INTO types (id, name) VALUES
${typeInserts.join(',\n')}
ON CONFLICT (id) DO NOTHING;

-- Insert pokemon
INSERT INTO pokemon (id, name, stats, sprites, flavor_text, region) VALUES
${pokemonInserts.join(',\n')}
ON CONFLICT (id) DO NOTHING;

-- Insert pokemon_types junction table
INSERT INTO pokemon_types (pokemon_id, type_id, slot) VALUES
${pokemonTypesInserts.join(',\n')}
ON CONFLICT (pokemon_id, type_id) DO NOTHING;

-- Insert pokemon evolutions
INSERT INTO pokemon_evolutions (base_id, evolution_id, trigger) VALUES
${evolutionInserts.join(',\n')}
ON CONFLICT (base_id, evolution_id) DO NOTHING;

-- Re-enable RLS
ALTER TABLE types ENABLE ROW LEVEL SECURITY;
ALTER TABLE pokemon ENABLE ROW LEVEL SECURITY;
ALTER TABLE pokemon_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE pokemon_evolutions ENABLE ROW LEVEL SECURITY;

-- Refresh materialized view
REFRESH MATERIALIZED VIEW user_capture_stats;
`;

  // Write to file
  writeFileSync(OUTPUT_FILE, sql, 'utf-8');

  console.log(`✅ Seed generated successfully!`);
  console.log(`   Types: ${typeInserts.length}`);
  console.log(`   Pokemon: ${pokemonInserts.length}`);
  console.log(`   Pokemon-Type Relations: ${pokemonTypesInserts.length}`);
  console.log(`   Evolutions: ${evolutionInserts.length}`);
  console.log(`   Output: ${OUTPUT_FILE}`);
}

// Run the script
try {
  generateSeedSql();
} catch (error) {
  console.error('❌ Error generating seed:', error);
  process.exit(1);
}
