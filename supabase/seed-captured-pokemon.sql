-- Insert sample captured Pokemon for testing
-- This script adds captured Pokemon for any authenticated user

DO $$
DECLARE
    test_user_id UUID;
BEGIN
    -- Get the first user from auth.users (or you can specify a specific email)
    SELECT id INTO test_user_id FROM auth.users LIMIT 1;
    
    -- Only proceed if we found a user
    IF test_user_id IS NOT NULL THEN
        -- Insert some captured Pokemon (mix of normal and shiny)
        INSERT INTO captured_pokemon (user_id, pokemon_id, variant, captured_at) 
        VALUES 
            -- Pikachu (normal) - captured 2 hours ago
            (test_user_id, 25, 'normal', NOW() - INTERVAL '2 hours'),
            
            -- Charizard (shiny) - captured 5 hours ago
            (test_user_id, 6, 'shiny', NOW() - INTERVAL '5 hours'),
            
            -- Bulbasaur (normal) - captured 1 day ago
            (test_user_id, 1, 'normal', NOW() - INTERVAL '1 day'),
            
            -- Squirtle (normal) - captured 2 days ago
            (test_user_id, 7, 'normal', NOW() - INTERVAL '2 days'),
            
            -- Mewtwo (shiny) - captured 3 days ago
            (test_user_id, 150, 'shiny', NOW() - INTERVAL '3 days'),
            
            -- Eevee (normal) - captured 4 days ago
            (test_user_id, 133, 'normal', NOW() - INTERVAL '4 days'),
            
            -- Dragonite (normal) - captured 5 days ago
            (test_user_id, 149, 'normal', NOW() - INTERVAL '5 days')
        ON CONFLICT (user_id, pokemon_id, variant) DO NOTHING;
        
        RAISE NOTICE 'Successfully added captured Pokemon for user: %', test_user_id;
    ELSE
        RAISE NOTICE 'No users found in database. Please sign up first.';
    END IF;
END $$;

