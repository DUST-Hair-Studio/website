-- Migration: Add conversion tracking to waitlist_requests table
-- Date: 2025-10-11
-- Description: Adds columns to track when waitlist requests convert to actual bookings

-- Add converted_at and converted_booking_id columns to waitlist_requests table
ALTER TABLE waitlist_requests 
ADD COLUMN IF NOT EXISTS converted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS converted_booking_id UUID REFERENCES bookings(id);

-- Drop the existing check constraint
ALTER TABLE waitlist_requests 
DROP CONSTRAINT IF EXISTS waitlist_requests_status_check;

-- Recreate check constraint with 'converted' status included
ALTER TABLE waitlist_requests 
ADD CONSTRAINT waitlist_requests_status_check 
CHECK (status IN ('pending', 'notified', 'converted', 'expired', 'cancelled'));

-- Add index for better query performance on converted bookings
CREATE INDEX IF NOT EXISTS idx_waitlist_requests_converted_booking_id 
ON waitlist_requests(converted_booking_id);

-- Add index for status filtering
CREATE INDEX IF NOT EXISTS idx_waitlist_requests_status 
ON waitlist_requests(status);

COMMENT ON COLUMN waitlist_requests.converted_at IS 'Timestamp when the waitlist request resulted in a booking';
COMMENT ON COLUMN waitlist_requests.converted_booking_id IS 'Reference to the booking created from this waitlist request';

