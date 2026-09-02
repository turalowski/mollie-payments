# Mollie Subscriptions Demo

A small, focused showcase of a **Mollie recurring-payments integration** —
built with Next.js 15, TypeScript, Tailwind, shadcn/ui, and Supabase.

It intentionally does *not* try to be a full SaaS starter. There's no
onboarding flow, no billing portal, no admin panel. The scope is narrow
on purpose: pricing page → checkout → mandate → recurring subscription
→ webhooks → cancellation, done properly, with the edge cases a real
production integration has to handle.

## What this demonstrates

- **Mollie subscription billing end to end**: a `sequenceType: "first"`
  payment used to both charge once *and* establish a reusable mandate,
  followed by creating the actual `subscription` resource once that
  mandate is confirmed — subscriptions can't be created before a
  mandate exists, so this is the order Mollie actually requires, not a
  simplification.
- **Reliable webhook handling**: Mollie webhooks carry no signature —
  just a payment id. The handler re-fetches the payment from the API
  before trusting anything, is idempotent (Mollie delivers webhooks
  more than once by design), and distinguishes the one-off mandate
  payment from Mollie-initiated recurring charges, which arrive at the
  same endpoint but need different handling.
- **Subscription lifecycle state**, not just "paid or not": pending →
  active → past_due (a recurring charge failed; Mollie owns dunning) →
  canceled, mirrored locally and updated only from verified webhook
  events.
- **Supabase with real RLS**: every table has row-level security
  scoped to the owning user; all writes go through a service-role
  client from trusted server code (API routes, the webhook), never
  from the browser.
- **Next.js 15 App Router** end to end: Server Components for data
  fetching, Route Handlers for the Mollie-facing endpoints, Server
  Actions for the auth forms, middleware for session refresh.

## Tech stack

Next.js 15 (App Router, TypeScript strict) · Tailwind CSS · shadcn/ui ·
Supabase (Postgres, Auth, RLS) · `@mollie/api-client` · Zod

## How the subscription flow works

```
 Landing page (/)
   │  visitor clicks "Subscribe" on a plan
   ▼
 POST /api/checkout
   │  1. find/create the user's Mollie customer
   │  2. create a local `subscriptions` row, status = pending
   │  3. create a Mollie payment: sequenceType "first"
   │     (charges once now, AND establishes a mandate)
   ▼
 Mollie-hosted checkout (test mode)
   │  customer pays with a Mollie test payment method
   ▼
 POST /api/webhooks/mollie   ◄── Mollie calls this with { id: <payment id> }
   │  1. re-fetch the payment from Mollie (never trust the webhook body)
   │  2. status = paid, first payment ->
   │       create the Mollie subscription using the mandate from step 1
   │       (this could not happen any earlier — no mandate, no subscription)
   │       -> local subscription: status = active
   │  3. later, Mollie auto-charges the mandate every interval and calls
   │     this same webhook for each recurring payment ->
   │       paid   -> stays active, refresh next billing date
   │       failed -> status = past_due
   ▼
 /dashboard
   shows plan, status, next payment date, payment history,
   and a "Cancel subscription" button
   │
   ▼
 POST /api/subscription/cancel
   cancels on Mollie, then marks the local row canceled
```

## Project structure

```
src/app/
  (pages)/                        Route group — organizes pages, invisible in the URL
    page.tsx                        Pricing landing page (Server Component)
    login/, signup/                 Auth pages
    dashboard/                      Signed-in subscription + payment history
    checkout/return/                Landing spot after Mollie checkout
  actions/auth.ts                 Server Actions: sign up / in / out
  api/auth/confirm/route.ts       Email confirmation link target
  api/checkout/route.ts           Starts a subscription checkout
  api/webhooks/mollie/route.ts    Mollie payment webhook
  api/subscription/cancel/route.ts

src/components/
  ui/                             shadcn/ui primitives
  subscribe-button.tsx, cancel-subscription-button.tsx, site-header.tsx

src/lib/
  supabase/                       browser / server / admin clients + types
  mollie/                         Mollie client + amount helper
  app-url.ts, format.ts

supabase/
  migrations/0001_init.sql        Schema: plans, customers, subscriptions, payments (+RLS)
  seed.sql                        Demo Starter/Pro plans
```

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Supabase project

In the Supabase SQL editor (or via the Supabase CLI), run, in order:

1. `supabase/migrations/0001_init.sql` — creates the schema and RLS policies
2. `supabase/seed.sql` — inserts the demo Starter/Pro plans

Then, under **Authentication → Providers**, make sure Email is enabled
(it is by default). Under **Authentication → URL Configuration**, add
your app's confirmation redirect (see step 4).

### 3. Get a Mollie test API key

Create a free [Mollie](https://www.mollie.com/) account, then grab a
**test mode** API key (starts with `test_`) from
Dashboard → Developers → API keys. No live payment methods or real
money are involved anywhere in this demo.

### 4. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in:

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API (keep secret) |
| `MOLLIE_API_KEY` | Mollie → Developers → API keys (test key) |
| `NEXT_PUBLIC_APP_URL` | see note below |

**`NEXT_PUBLIC_APP_URL` must be reachable from the public internet**,
because Mollie calls your webhook directly — `http://localhost:3000`
will not work. During local development, run a tunnel:

```bash
npx ngrok http 3000
```

and set `NEXT_PUBLIC_APP_URL` to the `https://…ngrok-free.app` URL it
gives you. Also add `<that URL>/api/auth/confirm` as a redirect URL in
Supabase's Auth settings so the sign-up confirmation email link works.

### 5. Run it

```bash
npm run dev
```

## Trying the full flow

1. Sign up on `/signup` and confirm via the email Supabase sends
   (check the Supabase dashboard's Auth logs if you don't have email
   sending configured — the confirmation link is there too).
2. On `/`, click **Subscribe** on a plan — you're redirected to
   Mollie's real hosted checkout, in test mode.
3. Pick the **test payment method** Mollie offers and choose *Paid* on
   the simulated status screen.
4. You're redirected back and, within a few seconds (once the webhook
   lands), `/dashboard` shows the subscription as **active**.
5. Test failure handling by canceling the plan or (if using a webhook
   inspector) resending a payment event as `failed`.
6. Click **Cancel subscription** to see the Mollie-side cancellation
   and local state update together.

Mollie test-mode subscriptions auto-cancel after 10 charges — fine for
a demo; not something you'd rely on in production.

## Deliberately out of scope

This is a payments showcase, not a product. No bookings, multi-tenant
studios, invoicing, email/WhatsApp integrations, or analytics — those
are the parts of a real platform that sit *around* payments, and
including them here would dilute the point.

## License

MIT — do whatever you like with it.
