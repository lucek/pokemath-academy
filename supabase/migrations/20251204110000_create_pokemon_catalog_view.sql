-- Migration: Create pokemon_catalog_vw and user_pokedex_vw
-- Description: Provides a unified Pokédex catalog with type metadata and a helper view for merging with user captures.

CREATE OR REPLACE VIEW pokemon_catalog_vw AS
SELECT
    p.id AS pokemon_id,
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
            )
            ORDER BY pt.slot
        ) FILTER (WHERE pt.pokemon_id IS NOT NULL),
        '[]'::jsonb
    ) AS type_details
FROM pokemon p
LEFT JOIN pokemon_types pt ON pt.pokemon_id = p.id
LEFT JOIN types t ON t.id = pt.type_id
GROUP BY
    p.id,
    p.name,
    p.stats,
    p.sprites,
    p.region;

COMMENT ON VIEW pokemon_catalog_vw IS 'Pokédex catalog with sprites and type metadata for all Pokémon.';

CREATE OR REPLACE VIEW user_pokedex_vw AS
SELECT
    cp.user_id,
    pc.pokemon_id,
    pc.pokemon_name,
    pc.stats,
    pc.sprites,
    pc.region,
    pc.type_details,
    cp.variant,
    cp.captured_at,
    TRUE AS is_caught
FROM captured_pokemon cp
INNER JOIN pokemon_catalog_vw pc ON pc.pokemon_id = cp.pokemon_id
UNION ALL
SELECT
    NULL::uuid AS user_id,
    pc.pokemon_id,
    pc.pokemon_name,
    pc.stats,
    pc.sprites,
    pc.region,
    pc.type_details,
    'normal'::variant_enum AS variant,
    NULL AS captured_at,
    FALSE AS is_caught
FROM pokemon_catalog_vw pc;

COMMENT ON VIEW user_pokedex_vw IS 'Union view with user captures and uncaught placeholders (user_id NULL).';

