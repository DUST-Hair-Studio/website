-- Customers an admin has blocked from booking new appointments online.
-- A row's presence means the customer is blocked; deleting it unblocks them.
-- Kept out of public.customers so the reason never reaches the customer
-- (/api/customer/me returns the full customer row).
-- Blocking is silent: the customer sees no availability (books look full).
-- Admins can still book for them.
--
-- Apply via Supabase SQL editor BEFORE deploying the app.

begin;

create table if not exists public.blocked_customers (
  customer_id uuid primary key references public.customers(id) on delete cascade,
  reason      text,
  blocked_by  text,                                 -- admin email
  blocked_at  timestamptz not null default now()
);

-- Service role only: no policies, so anon/authenticated clients can't read or write it
alter table public.blocked_customers enable row level security;

commit;
