-- Fix admin_users table to work with Supabase Auth
-- Add auth_user_id column to admin_users table if it doesn't exist

ALTER TABLE public.admin_users 
ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Make email unique if it isn't already
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'admin_users_email_unique'
    ) THEN
        ALTER TABLE public.admin_users 
        ADD CONSTRAINT admin_users_email_unique UNIQUE (email);
    END IF;
END $$;

-- Enable RLS on admin_users table
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for admin_users
-- Admins can view their own record
CREATE POLICY "Admins can view own record" ON public.admin_users
    FOR SELECT USING (auth_user_id = auth.uid());

-- Admins can update their own record
CREATE POLICY "Admins can update own record" ON public.admin_users
    FOR UPDATE USING (auth_user_id = auth.uid());

-- Allow service account access to admin_users for auth checks
CREATE POLICY "Allow auth access to admin_users" ON public.admin_users
    FOR SELECT USING (true);

-- Verify the setup
SELECT 'Admin auth setup complete!' as status;
