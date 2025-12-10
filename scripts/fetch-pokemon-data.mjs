#!/usr/bin/env node

/* eslint-env node */
/* global fetch */
/* eslint-disable no-console */
/* global console, process */
/**
 * Fetch Pokémon (1..151) and write trimmed JSON objects matching our schema:
 * - id, name, height, weight
 * - hp, attack, defense, speed (derived from stats array)
 * - sprites (kept unfiltered, full object as returned by PokeAPI)
 * - types simplified to: [{ slot, name }]
 *
 * Usage examples:
 *   node scripts/fetch-pokemon-data.mjs
 *   node scripts/fetch-pokemon-data.mjs --start=1 --end=151 --concurrency=6 --out=supabase/pokeapi_data/pokemon
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const POKEAPI_BASE = 'https://pokeapi.co/api/v2';

function parseArgs(argv) {
  const options = {
    start: 1,
    end: 151,
    concurrency: 6,
    outDir: 'supabase/pokeapi_data/pokemon',
  };
  for (const arg of argv) {
    if (arg.startsWith('--start=')) options.start = Number(arg.split('=')[1] || '1');
    else if (arg.startsWith('--end=')) options.end = Number(arg.split('=')[1] || '151');
    else if (arg.startsWith('--concurrency='))
      options.concurrency = Number(arg.split('=')[1] || '6');
    else if (arg.startsWith('--out='))
      options.outDir = arg.split('=')[1] || 'supabase/pokeapi_data/pokemon';
  }
  if (!Number.isFinite(options.start) || options.start < 1) options.start = 1;
  if (!Number.isFinite(options.end) || options.end < options.start) options.end = options.start;
  if (!Number.isFinite(options.concurrency) || options.concurrency < 1) options.concurrency = 6;
  return options;
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

function sanitizeName(name) {
  return String(name).trim().toLowerCase().replace(/\s+/g, '-');
}

async function fetchJson(url, retries = 5) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const res = await fetch(url, {
        headers: {
          'user-agent': '10x-pokemath-fetch-script/1.0 (+https://example.local)',
          accept: 'application/json',
        },
      });
      if (!res.ok) {
        if (res.status === 429 || res.status >= 500) {
          throw new Error(`HTTP ${res.status} ${res.statusText}`);
        }
        const text = await res.text();
        throw new Error(`HTTP ${res.status} ${res.statusText}: ${text.slice(0, 200)}`);
      }
      return await res.json();
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        const backoffMs = 500 * 2 ** attempt + Math.floor(Math.random() * 250);
        await sleep(backoffMs);
        continue;
      }
      break;
    }
  }
  throw lastError;
}

function deriveBaseStats(statsArray) {
  if (!Array.isArray(statsArray)) {
    throw new Error('stats array missing from PokeAPI payload');
  }
  const nameToValue = new Map();
  for (const entry of statsArray) {
    if (!entry || typeof entry.base_stat !== 'number' || !entry.stat || !entry.stat.name) continue;
    nameToValue.set(String(entry.stat.name), entry.base_stat);
  }
  const hp = nameToValue.get('hp');
  const attack = nameToValue.get('attack');
  const defense = nameToValue.get('defense');
  const speed = nameToValue.get('speed');
  if (
    typeof hp !== 'number' ||
    typeof attack !== 'number' ||
    typeof defense !== 'number' ||
    typeof speed !== 'number'
  ) {
    throw new Error('One or more base stats are missing (hp, attack, defense, speed)');
  }
  return { hp, attack, defense, speed };
}

function trimPokemonToSchema(p) {
  if (!p || typeof p !== 'object') throw new Error('Invalid pokemon object');
  const { hp, attack, defense, speed } = deriveBaseStats(p.stats);
  const types =
    Array.isArray(p.types) &&
    p.types
      .map((t) => ({
        slot: typeof t?.slot === 'number' ? t.slot : null,
        name: t?.type && typeof t.type === 'object' ? t.type.name : null,
      }))
      .filter((t) => Number.isInteger(t.slot) && typeof t.name === 'string');

  return {
    id: p.id,
    name: p.name,
    height: p.height,
    weight: p.weight,
    hp,
    attack,
    defense,
    speed,
    // Keep sprites unfiltered per requirement
    sprites: p.sprites ?? null,
    types: types || [],
  };
}

async function writeJsonAtomic(filePath, data) {
  const tmp = `${filePath}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(tmp, filePath);
}

async function fetchOneAndSave(id, outDir) {
  const p = await fetchJson(`${POKEAPI_BASE}/pokemon/${id}`);
  const trimmed = trimPokemonToSchema(p);
  const filename = `${trimmed.id}-${sanitizeName(trimmed.name)}.json`;
  const dest = path.join(outDir, filename);
  await writeJsonAtomic(dest, trimmed);
  return { id: trimmed.id, name: trimmed.name, file: dest };
}

async function mapWithConcurrency(items, limit, task) {
  const total = items.length;
  let index = 0;
  let completed = 0;
  let failed = 0;

  const worker = async () => {
    while (true) {
      const i = index;
      index += 1;
      if (i >= total) break;
      const item = items[i];
      try {
        await task(item, i);
        completed += 1;
      } catch (err) {
        failed += 1;
        console.error(`[error] ${item}: ${(err && err.message) || err}`);
      }
      await sleep(50 + Math.floor(Math.random() * 150));
    }
  };

  const workers = Array.from({ length: Math.min(limit, total) }, () => worker());
  await Promise.all(workers);
  return { completed, failed };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const outDir = path.resolve(process.cwd(), options.outDir);
  await ensureDir(outDir);

  const ids = Array.from({ length: options.end - options.start + 1 }, (_, i) => options.start + i);
  console.log(
    `[info] Fetching ${ids.length} Pokémon (${options.start}-${options.end}) with concurrency=${options.concurrency} -> ${path.relative(
      process.cwd(),
      outDir,
    )}`,
  );

  const { completed, failed } = await mapWithConcurrency(ids, options.concurrency, async (id) => {
    const result = await fetchOneAndSave(id, outDir);
    console.log(
      `[saved] #${result.id} ${result.name} -> ${path.relative(process.cwd(), result.file)}`,
    );
  });

  console.log(`[done] Completed: ${completed}, Failed: ${failed}`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
