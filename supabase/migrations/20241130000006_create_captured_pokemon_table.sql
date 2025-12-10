-- Migration: Create captured_pokemon table
-- Description: User's captured Pokemon collection with variant support

-- Create variant enum
CREATE TYPE variant_enum AS ENUM ('normal', 'shiny');

-- Create captured_pokemon table
CREATE TABLE IF NOT EXISTS captured_pokemon (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    pokemon_id INTEGER NOT NULL,
    variant variant_enum NOT NULL,
    captured_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT fk_captured_pokemon_user 
        FOREIGN KEY (user_id) 
        REFERENCES auth.users(id) 
        ON DELETE RESTRICT,
    CONSTRAINT fk_captured_pokemon_pokemon 
        FOREIGN KEY (pokemon_id) 
        REFERENCES pokemon(id) 
        ON DELETE RESTRICT,
    CONSTRAINT unique_user_pokemon_variant 
        UNIQUE (user_id, pokemon_id, variant)
);

-- Index for user queries
CREATE INDEX captured_pokemon_user_idx ON captured_pokemon(user_id);

-- Enable RLS
ALTER TABLE captured_pokemon ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own captured Pokemon
CREATE POLICY captured_pokemon_owner 
    ON captured_pokemon
    FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Comments
COMMENT ON TABLE captured_pokemon IS 'User Pokemon collection';
COMMENT ON COLUMN captured_pokemon.variant IS 'Pokemon variant: normal or shiny';


