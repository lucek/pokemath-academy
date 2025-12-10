-- Migration: Create pokemon_evolutions table
-- Description: Pokemon evolution chains with trigger conditions

CREATE TABLE IF NOT EXISTS pokemon_evolutions (
    base_id INTEGER NOT NULL,
    evolution_id INTEGER NOT NULL,
    trigger JSONB,
    PRIMARY KEY (base_id, evolution_id),
    CONSTRAINT fk_pokemon_evolutions_base 
        FOREIGN KEY (base_id) 
        REFERENCES pokemon(id) 
        ON DELETE RESTRICT,
    CONSTRAINT fk_pokemon_evolutions_evolution 
        FOREIGN KEY (evolution_id) 
        REFERENCES pokemon(id) 
        ON DELETE RESTRICT
);

-- Enable RLS
ALTER TABLE pokemon_evolutions ENABLE ROW LEVEL SECURITY;

-- Policy: Public read-only access
CREATE POLICY pokemon_evolutions_public_read_only 
    ON pokemon_evolutions
    FOR SELECT 
    USING (true);

-- Comments
COMMENT ON TABLE pokemon_evolutions IS 'Pokemon evolution chains';
COMMENT ON COLUMN pokemon_evolutions.trigger IS 'JSONB containing evolution conditions (min_level, item, etc.)';


