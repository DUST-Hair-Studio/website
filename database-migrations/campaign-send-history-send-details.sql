-- Add send_details column to store per-recipient results (success/failure + error messages)
-- Run this after campaign-send-history.sql
-- Usage: psql -d your_database -f database-migrations/campaign-send-history-send-details.sql

ALTER TABLE campaign_send_history
ADD COLUMN IF NOT EXISTS send_details JSONB;

COMMENT ON COLUMN campaign_send_history.send_details IS 'Array of {email, success, error?} for each recipient';
