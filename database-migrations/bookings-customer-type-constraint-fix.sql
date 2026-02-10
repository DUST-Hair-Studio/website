-- Fix: constraint allows 'new' and 'existing' but app sends 'loyalty'. Change to allow 'new' and 'loyalty'.

-- 1. Fix existing data
UPDATE bookings SET customer_type_at_booking = 'loyalty' WHERE customer_type_at_booking = 'existing';

-- 2. Drop the old constraint (allows 'new' | 'existing')
ALTER TABLE public.bookings
  DROP CONSTRAINT bookings_customer_type_at_booking_check;

-- 3. Add new constraint (allow 'new' | 'loyalty')
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_customer_type_at_booking_check
  CHECK (customer_type_at_booking IN ('new', 'loyalty'));
