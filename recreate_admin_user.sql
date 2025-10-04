-- Recreate admin user in admin_users table
-- First, get the auth_user_id from the auth.users table

-- Step 1: Find the auth user ID (run this first to get the UUID)
SELECT id, email, created_at 
FROM auth.users 
WHERE email = 'dusthairstudio@gmail.com';

-- Step 2: Insert the admin user record (without auth_user_id since that column doesn't exist)
INSERT INTO admin_users (
    id,
    email,
    name,
    role,
    is_active,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    'dusthairstudio@gmail.com',
    'Dust Hair Studio Admin',
    'admin',
    true,
    NOW(),
    NOW()
);

-- Verify the admin user was created
SELECT * FROM admin_users WHERE email = 'dusthairstudio@gmail.com';
