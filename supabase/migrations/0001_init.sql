-- Mollie subscriptions demo — initial schema
--
-- Design notes:
-- * `plans` is display/config data for the pricing page (public read).
-- * `customers` links a Supabase auth user to a Mollie customer id.
-- * `subscriptions` mirrors a Mollie subscription's lifecycle state.
--   `mollie_subscription_id` is nullable because it does not exist yet
--   between "checkout started" and "first payment confirmed by webhook".
-- * `payments` is an append-only log of every Mollie payment webhook we
--   receive (the first/mandate payment plus every recurring charge).
-- * All writes happen through the service-role key (API routes / the
--   webhook handler) which bypasses RLS. RLS below only has to grant
--   read access to the owning user — there are no INSERT/UPDATE/DELETE
--   policies for `authenticated`/`anon`, so those are denied by default.

create extension if not exists "pgcrypto";

-- Reusable trigger to keep updated_at current on any row change.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- plans
-- ---------------------------------------------------------------------------
create table public.plans (
  id text primary key, -- e.g. 'starter', 'pro' — used directly in checkout requests
  name text not null,
  description text not null default '',
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'EUR',
  interval text not null default '1 month', -- Mollie subscription `interval` format
  features jsonb not null default '[]'::jsonb, -- e.g. ["5 projects", "Email support"]
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.plans is 'Pricing tiers shown on the landing page and referenced by checkout.';
comment on column public.plans.interval is 'Mollie subscription interval string, e.g. "1 month".';

create trigger plans_set_updated_at
  before update on public.plans
  for each row execute function public.set_updated_at();

alter table public.plans enable row level security;

create policy "Plans are publicly readable"
  on public.plans for select
  to anon, authenticated
  using (is_active);

-- ---------------------------------------------------------------------------
-- customers
-- ---------------------------------------------------------------------------
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  mollie_customer_id text unique,
  email text not null,
  name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.customers is 'One row per app user who has started a Mollie checkout; holds the Mollie customer id used for recurring mandates.';

create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

create index customers_mollie_customer_id_idx on public.customers (mollie_customer_id);

alter table public.customers enable row level security;

create policy "Users can read their own customer record"
  on public.customers for select
  to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- subscriptions
-- ---------------------------------------------------------------------------
create type public.subscription_status as enum (
  'pending',   -- checkout started, first payment not yet confirmed
  'active',    -- Mollie subscription created and running
  'past_due',  -- most recent recurring payment failed
  'canceled',
  'completed'  -- Mollie subscription reached its end date/count (unused with no fixed `times`, kept for completeness)
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  plan_id text not null references public.plans (id),
  mollie_subscription_id text unique, -- set once Mollie confirms the mandate payment
  mollie_mandate_id text,
  status public.subscription_status not null default 'pending',
  amount_cents integer not null,
  currency text not null default 'EUR',
  interval text not null,
  current_period_end timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.subscriptions is 'Local mirror of a Mollie recurring subscription''s lifecycle state, updated from webhook events.';

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

create index subscriptions_customer_id_idx on public.subscriptions (customer_id);
create index subscriptions_status_idx on public.subscriptions (status);

alter table public.subscriptions enable row level security;

create policy "Users can read their own subscriptions"
  on public.subscriptions for select
  to authenticated
  using (
    customer_id in (
      select id from public.customers where user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- payments
-- ---------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  mollie_payment_id text not null unique,
  status text not null, -- mirrors Mollie payment status: open, paid, failed, expired, canceled, ...
  amount_cents integer not null,
  currency text not null default 'EUR',
  description text,
  is_first_payment boolean not null default false,
  metadata jsonb not null default '{}'::jsonb, -- raw fields worth keeping from the webhook payload
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.payments is 'Append-only log of Mollie payment webhook events (mandate payment + every recurring charge).';

create index payments_customer_id_idx on public.payments (customer_id);
create index payments_subscription_id_idx on public.payments (subscription_id);

alter table public.payments enable row level security;

create policy "Users can read their own payments"
  on public.payments for select
  to authenticated
  using (
    customer_id in (
      select id from public.customers where user_id = auth.uid()
    )
  );
