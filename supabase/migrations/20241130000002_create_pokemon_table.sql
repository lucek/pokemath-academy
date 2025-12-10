-- Migration: Create pokemon table
-- Description: Main Pokemon table with stats and sprites stored as JSONB

CREATE TABLE IF NOT EXISTS pokemon (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    stats JSONB NOT NULL,
    sprites JSONB NOT NULL,
    flavor_text TEXT,
    region TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Unique constraint on lowercase name
CREATE UNIQUE INDEX pokemon_name_unique ON pokemon (LOWER(name));

-- GIN index for full-text search on name
CREATE INDEX pokemon_name_gin ON pokemon USING gin (to_tsvector('simple', name));

-- Enable RLS
ALTER TABLE pokemon ENABLE ROW LEVEL SECURITY;

-- Policy: Public read-only access
CREATE POLICY pokemon_public_read_only 
    ON pokemon
    FOR SELECT 
    USING (true);

-- Comments
COMMENT ON TABLE pokemon IS 'Main Pokemon table with core data from PokeAPI';
COMMENT ON COLUMN pokemon.stats IS 'JSONB containing: height, weight, hp, attack, defense, speed';
COMMENT ON COLUMN pokemon.sprites IS 'JSONB containing full sprites structure from PokeAPI';
COMMENT ON COLUMN pokemon.flavor_text IS 'Pokédex description text (English, from Red version)';
COMMENT ON COLUMN pokemon.region IS 'Region name (currently always "kanto")';
COMMENT ON COLUMN pokemon.id IS 'Pokemon ID from PokeAPI (Pokedex number for Gen 1)';
COMMENT ON COLUMN pokemon.name IS 'Pokemon name in lowercase';

