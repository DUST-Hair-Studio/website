-- Create admin user in Supabase Auth
-- Run this in your Supabase SQL editor

-- Create the user in auth.users table
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'dusthairstudio@gmail.com',
    crypt('your_secure_password_here', gen_salt('bf')), -- Replace with actual password
    NOW(),
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
);

-- Get the user ID that was just created
-- Then update your admin_users table with this auth user ID
-- You'll need to replace the user_id below with the actual UUID from above

-- Example (replace the UUID with the actual one from the insert above):
-- UPDATE admin_users 
-- SET auth_user_id = 'the-uuid-from-insert-above'
-- WHERE email = 'dusthairstudio@gmail.com';
