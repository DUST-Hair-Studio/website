-- Migration: Add waitlist last viewed tracking
-- Date: 2025-10-11
-- Description: Adds a setting to track when admin last viewed the waitlist page for notification badge

-- Insert the initial setting (if not exists)
INSERT INTO settings (key, value, description)
VALUES (
  'waitlist_last_viewed_at',
  NULL,
  'Timestamp when admin last viewed the waitlist page - used for unread notification count'
)
ON CONFLICT (key) DO NOTHING;

-- This setting will be automatically updated by the /api/admin/waitlist/mark-viewed endpoint
-- when the admin visits the waitlist page

