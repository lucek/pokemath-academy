-- Migration: Add trigger to refresh user_capture_stats
-- Description: Automatically refresh materialized view when captured_pokemon changes

-- Create function to refresh stats
CREATE OR REPLACE FUNCTION refresh_user_capture_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Refresh the materialized view concurrently
    REFRESH MATERIALIZED VIEW CONCURRENTLY user_capture_stats;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on captured_pokemon
CREATE TRIGGER trigger_refresh_user_capture_stats
    AFTER INSERT OR UPDATE OR DELETE ON captured_pokemon
    FOR EACH STATEMENT
    EXECUTE FUNCTION refresh_user_capture_stats();

COMMENT ON FUNCTION refresh_user_capture_stats() IS 'Refreshes user_capture_stats materialized view when captured_pokemon changes';
COMMENT ON TRIGGER trigger_refresh_user_capture_stats ON captured_pokemon IS 'Automatically refreshes user_capture_stats after any change';

