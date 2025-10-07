-- Add missing columns to customers table
-- Run this in your Supabase SQL editor

-- Add marketing emails opt-in column
ALTER TABLE customers 
ADD COLUMN allow_marketing_emails BOOLEAN DEFAULT false;

-- Add birth date columns
ALTER TABLE customers 
ADD COLUMN birth_month VARCHAR(2),
ADD COLUMN birth_day VARCHAR(2);

-- Add comments for documentation
COMMENT ON COLUMN customers.allow_marketing_emails IS 'Customer consent for marketing emails';
COMMENT ON COLUMN customers.birth_month IS 'Birth month (01-12)';
COMMENT ON COLUMN customers.birth_day IS 'Birth day (01-31)';
