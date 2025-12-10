-- Migration: Create pokemon_types table
-- Description: Many-to-many junction table for fast filtering by type

CREATE TABLE IF NOT EXISTS pokemon_types (
    pokemon_id INTEGER NOT NULL,
    type_id SMALLINT NOT NULL,
    slot SMALLINT NOT NULL CHECK (slot IN (1, 2)),
    PRIMARY KEY (pokemon_id, type_id),
    CONSTRAINT fk_pokemon_types_pokemon 
        FOREIGN KEY (pokemon_id) 
        REFERENCES pokemon(id) 
        ON DELETE RESTRICT,
    CONSTRAINT fk_pokemon_types_type 
        FOREIGN KEY (type_id) 
        REFERENCES types(id) 
        ON DELETE RESTRICT
);

-- Index for filtering by type
CREATE INDEX pokemon_types_type_id_idx ON pokemon_types(type_id);

-- Enable RLS
ALTER TABLE pokemon_types ENABLE ROW LEVEL SECURITY;

-- Policy: Public read-only access
CREATE POLICY pokemon_types_public_read_only 
    ON pokemon_types
    FOR SELECT 
    USING (true);

-- Comments
COMMENT ON TABLE pokemon_types IS 'Junction table linking Pokemon to their types';
COMMENT ON COLUMN pokemon_types.slot IS 'Type slot: 1 for primary type, 2 for secondary type';


