-- Adds services.trim_role, used to limit customers to one trim between haircuts.
--   'haircut' = full cut; resets the trim allowance
--   'trim'    = trim; customers may book at most one between haircuts
--   null      = not part of the rule
-- Admin-created bookings are not restricted.
--
-- Apply via Supabase SQL editor BEFORE deploying the app (the admin services
-- form writes this column).

begin;

alter table public.services
  add column if not exists trim_role text;

alter table public.services
  drop constraint if exists services_trim_role_check;

alter table public.services
  add constraint services_trim_role_check
  check (trim_role is null or trim_role in ('haircut', 'trim'));

-- Current services
update public.services set trim_role = 'haircut'
  where id in (
    '67edcccc-0348-4549-ad01-fd01ba1521a7', -- Haircut + Blow Dry
    'd96c8ac2-a4ab-4ac7-b48e-dbb5a44f854a', -- Short Cut
    '8446c16d-9cbd-494d-8320-967d573b0779'  -- New Client Appointment (inactive; past bookings still count as a cut)
  );

update public.services set trim_role = 'trim'
  where id = '0caa7c03-2227-4136-b85e-a9a98369724c'; -- Fringe/Bangs Trim

commit;
