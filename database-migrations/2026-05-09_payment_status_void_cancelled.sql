-- Widen bookings.payment_status to support 'void' (manual write-off) and
-- 'cancelled' (auto-applied when the appointment is cancelled while still
-- unpaid). Adds metadata columns for voided invoices.
--
-- Apply via Supabase SQL editor, then redeploy the app.

begin;

alter table public.bookings
  drop constraint if exists bookings_payment_status_check;

alter table public.bookings
  add constraint bookings_payment_status_check
  check (payment_status in ('pending', 'paid', 'refunded', 'void', 'cancelled'));

alter table public.bookings
  add column if not exists voided_at timestamptz,
  add column if not exists void_reason text;

commit;
