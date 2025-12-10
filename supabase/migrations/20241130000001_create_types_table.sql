-- Migration: Create types table
-- Description: Dictionary table for 18 Pokemon types

CREATE TABLE IF NOT EXISTS types (
    id SMALLINT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

-- Enable RLS
ALTER TABLE types ENABLE ROW LEVEL SECURITY;

-- Policy: Public read-only access
CREATE POLICY types_public_read_only 
    ON types
    FOR SELECT 
    USING (true);

-- Comment
COMMENT ON TABLE types IS 'Dictionary of Pokemon types (Normal, Fire, Water, etc.)';


