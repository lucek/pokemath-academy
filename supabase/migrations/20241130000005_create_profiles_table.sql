-- Migration: Create profiles table
-- Description: User profiles linked to auth.users

CREATE TABLE IF NOT EXISTS profiles (
    user_id UUID PRIMARY KEY,
    display_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT fk_profiles_user 
        FOREIGN KEY (user_id) 
        REFERENCES auth.users(id) 
        ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only read/write their own profile
CREATE POLICY profiles_owner 
    ON profiles
    FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Comments
COMMENT ON TABLE profiles IS 'User profiles extending auth.users';
COMMENT ON COLUMN profiles.user_id IS 'References auth.users.id';


