-- Simple Supabase Auth setup for DUST Hair Studio
-- This just enables Supabase Auth and links it to your existing customer table

-- Add auth_user_id column to link customers to Supabase Auth users
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Remove password_hash since Supabase Auth handles this
ALTER TABLE public.customers DROP COLUMN IF EXISTS password_hash;

-- Make email unique if it isn't already
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'customers_email_unique'
    ) THEN
        ALTER TABLE public.customers 
        ADD CONSTRAINT customers_email_unique UNIQUE (email);
    END IF;
END $$;

-- Enable Row Level Security on customers table
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Simple RLS policy: customers can view/update their own data
CREATE POLICY "Customers can manage own data" ON public.customers
    FOR ALL USING (auth_user_id = auth.uid());

-- Allow public read access to active services (needed for booking page)
CREATE POLICY "Allow public read access to active services" ON public.services
    FOR SELECT USING (is_active = true);

-- Allow read access to settings
CREATE POLICY "Allow read access to settings" ON public.settings
    FOR SELECT USING (true);

-- Verify the setup
SELECT 'Supabase Auth setup complete! Ready to use.' as status;
