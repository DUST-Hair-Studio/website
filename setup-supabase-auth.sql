-- Set up Supabase Auth with your DUST Hair Studio database schema

-- Create public.users table to extend Supabase auth.users
CREATE TABLE IF NOT EXISTS public.users (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    phone TEXT,
    role TEXT CHECK (role IN ('customer', 'admin')) DEFAULT 'customer',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Update customers table to link to Supabase Auth users
-- Remove password_hash since Supabase Auth handles this
ALTER TABLE public.customers DROP COLUMN IF EXISTS password_hash;

-- Add auth_user_id to link customers to Supabase Auth users
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

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

-- Create a function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert into public.users
    INSERT INTO public.users (id, email, name, role)
    VALUES (
        NEW.id, 
        NEW.email, 
        COALESCE(NEW.raw_user_meta_data->>'name', ''),
        'customer'
    );
    
    -- Insert into public.customers
    INSERT INTO public.customers (
        auth_user_id,
        email,
        name,
        phone,
        is_existing_customer,
        allow_sms_notifications
    )
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', ''),
        COALESCE(NEW.raw_user_meta_data->>'phone', ''),
        false, -- New customers start as "new"
        COALESCE((NEW.raw_user_meta_data->>'allow_sms_notifications')::boolean, false)
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for Supabase Auth

-- Users can view and update their own profile
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- Customers can view and update their own customer record
CREATE POLICY "Customers can view own record" ON public.customers
    FOR SELECT USING (auth_user_id = auth.uid());

CREATE POLICY "Customers can update own record" ON public.customers
    FOR UPDATE USING (auth_user_id = auth.uid());

-- Allow public read access to active services
CREATE POLICY "Allow public read access to active services" ON public.services
    FOR SELECT USING (is_active = true);

-- Allow read access to settings
CREATE POLICY "Allow read access to settings" ON public.settings
    FOR SELECT USING (true);

-- Verify the setup
SELECT 'Setup complete! Supabase Auth is now properly configured.' as status;
