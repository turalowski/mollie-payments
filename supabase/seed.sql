-- Demo pricing tiers for the showcase landing page.
-- Amounts are in cents; Mollie test mode payments use these exact values.

insert into public.plans (id, name, description, amount_cents, currency, interval, features, sort_order)
values
  (
    'starter',
    'Starter',
    'For getting started with the basics.',
    900,
    'EUR',
    '1 month',
    '["1 project", "Community support", "Cancel anytime"]'::jsonb,
    1
  ),
  (
    'pro',
    'Pro',
    'For growing teams that need more.',
    2900,
    'EUR',
    '1 month',
    '["Unlimited projects", "Priority email support", "Usage analytics", "Cancel anytime"]'::jsonb,
    2
  )
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  amount_cents = excluded.amount_cents,
  currency = excluded.currency,
  interval = excluded.interval,
  features = excluded.features,
  sort_order = excluded.sort_order;
