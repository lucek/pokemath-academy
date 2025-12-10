-- Migration: Create views
-- Description: Helper views for frontend queries

-- View: my_collection_vw
-- Combines captured_pokemon with pokemon details and types
CREATE OR REPLACE VIEW my_collection_vw AS
SELECT 
    cp.id AS capture_id,
    cp.user_id,
    cp.pokemon_id,
    cp.variant,
    cp.captured_at,
    p.name AS pokemon_name,
    p.stats,
    p.sprites,
    p.region,
    COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'type_id', pt.type_id,
                'type_name', t.name,
                'slot', pt.slot
            ) ORDER BY pt.slot
        ) FILTER (WHERE pt.pokemon_id IS NOT NULL),
        '[]'::jsonb
    ) AS type_details
FROM captured_pokemon cp
INNER JOIN pokemon p ON cp.pokemon_id = p.id
LEFT JOIN pokemon_types pt ON p.id = pt.pokemon_id
LEFT JOIN types t ON pt.type_id = t.id
GROUP BY 
    cp.id,
    cp.user_id,
    cp.pokemon_id,
    cp.variant,
    cp.captured_at,
    p.name,
    p.stats,
    p.sprites,
    p.region;

COMMENT ON VIEW my_collection_vw IS 'User Pokemon collection with full details including type information';

-- Materialized View: user_capture_stats
-- Aggregated statistics for user captures
CREATE MATERIALIZED VIEW user_capture_stats AS
SELECT 
    user_id,
    COUNT(*) AS total_captured,
    COUNT(DISTINCT pokemon_id) AS unique_pokemon_count,
    COUNT(*) FILTER (WHERE variant = 'shiny') AS shiny_count,
    COUNT(*) FILTER (WHERE variant = 'normal') AS normal_count,
    MAX(captured_at) AS last_capture_at
FROM captured_pokemon
GROUP BY user_id
UNION ALL
SELECT 
    NULL AS user_id,
    COUNT(*) AS total_captured,
    COUNT(DISTINCT pokemon_id) AS unique_pokemon_count,
    COUNT(*) FILTER (WHERE variant = 'shiny') AS shiny_count,
    COUNT(*) FILTER (WHERE variant = 'normal') AS normal_count,
    MAX(captured_at) AS last_capture_at
FROM captured_pokemon;

-- Create unique index for CONCURRENT refresh
CREATE UNIQUE INDEX user_capture_stats_user_id_idx ON user_capture_stats(user_id);

COMMENT ON MATERIALIZED VIEW user_capture_stats IS 'Aggregated capture statistics per user and globally (NULL user_id = global stats)';

