-- Add notification preference to customers table
-- Values: 'text' (SMS only), 'email' (email only), 'both' (text and email)
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS notification_preference TEXT DEFAULT 'both'
CHECK (notification_preference IN ('text', 'email', 'both'));
