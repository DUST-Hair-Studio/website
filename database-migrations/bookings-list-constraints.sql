-- Run this in Supabase SQL Editor to see all check constraints on bookings:
SELECT conname AS constraint_name,
       pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.bookings'::regclass
  AND contype = 'c';
