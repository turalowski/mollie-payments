import { NextResponse } from "next/server";
import type { MollieClient, Payment as MolliePayment } from "@mollie/api-client";

import { getAppUrl } from "@/lib/app-url";
import { toMollieAmount } from "@/lib/mollie/amount";
import { getMollieClient } from "@/lib/mollie/client";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Payment as PaymentRow, Subscription } from "@/lib/supabase/types";

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

const PAID_LIKE = new Set(["paid"]);
const DEAD_END_STATUSES = new Set(["failed", "expired", "canceled"]);

/**
 * Mollie webhook — called for every status change on every payment,
 * both the one-off "first" payment created by /api/checkout and every
 * recurring charge Mollie generates itself for an active subscription.
 *
 * Mollie webhooks are unauthenticated and carry no signature; the body
 * is only ever `id=<payment id>`. The documented (and only safe) way to
 * trust a webhook is to ignore everything except the id and re-fetch
 * the payment from the API with our own API key — which is what this
 * does before touching any state.
 *
 * https://docs.mollie.com/docs/webhooks
 */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const paymentId = form?.get("id");

  if (typeof paymentId !== "string" || !paymentId) {
    return NextResponse.json({ error: "Missing payment id" }, { status: 400 });
  }

  const mollie = getMollieClient();
  const admin = createAdminClient();

  let payment: MolliePayment;
  try {
    payment = await mollie.payments.get(paymentId);
  } catch (error) {
    console.error(`webhook: failed to fetch payment ${paymentId} from Mollie`, error);
    // Likely transient (Mollie/network hiccup) — ask Mollie to retry.
    return NextResponse.json({ error: "Failed to fetch payment" }, { status: 502 });
  }

  try {
    const paymentRow = await upsertPaymentRow(admin, payment);
    if (!paymentRow) {
      // A recurring payment for a subscription we have no local record
      // of — a data integrity problem, not a transient one. Returning
      // 200 stops Mollie from retrying forever; the error is logged for
      // investigation.
      return NextResponse.json({ received: true });
    }

    if (PAID_LIKE.has(payment.status)) {
      await handlePaid(admin, mollie, payment, paymentRow);
    } else if (DEAD_END_STATUSES.has(payment.status)) {
      await handleDeadEnd(admin, payment, paymentRow);
    }
    // Other statuses (open, pending, authorized) need no subscription
    // state change — the payment row update above already reflects them.

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(`webhook: failed to process payment ${payment.id}`, error);
    return NextResponse.json({ error: "Failed to process webhook" }, { status: 500 });
  }
}

/**
 * Inserts or updates the local `payments` row for this Mollie payment.
 * Returns null when this is a recurring payment for a subscription we
 * can't locate locally (nothing sensible to attach it to).
 */
async function upsertPaymentRow(
  admin: SupabaseAdmin,
  payment: MolliePayment
): Promise<PaymentRow | null> {
  const { data: existing } = await admin
    .from("payments")
    .select("*")
    .eq("mollie_payment_id", payment.id)
    .maybeSingle();

  const patch = {
    status: payment.status,
    paid_at: payment.paidAt ?? null,
    metadata: {
      method: payment.method ?? null,
      sequenceType: payment.sequenceType,
    },
  };

  if (existing) {
    const { data: updated, error } = await admin
      .from("payments")
      .update(patch)
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw error;
    return updated;
  }

  // Not a payment we created — must be a recurring charge Mollie
  // generated itself for a subscription. Find the local subscription it
  // belongs to so we know which customer to attribute it to.
  if (!payment.subscriptionId) {
    console.error(
      `webhook: unknown payment ${payment.id} with no subscriptionId — nothing to attach it to`
    );
    return null;
  }

  const { data: subscription } = await admin
    .from("subscriptions")
    .select("*")
    .eq("mollie_subscription_id", payment.subscriptionId)
    .maybeSingle();

  if (!subscription) {
    console.error(
      `webhook: payment ${payment.id} references unknown local subscription ${payment.subscriptionId}`
    );
    return null;
  }

  const { data: inserted, error } = await admin
    .from("payments")
    .insert({
      customer_id: subscription.customer_id,
      subscription_id: subscription.id,
      mollie_payment_id: payment.id,
      description: payment.description,
      is_first_payment: false,
      amount_cents: Math.round(Number(payment.amount.value) * 100),
      currency: payment.amount.currency,
      ...patch,
    })
    .select()
    .single();
  if (error) throw error;
  return inserted;
}

async function handlePaid(
  admin: SupabaseAdmin,
  mollie: MollieClient,
  payment: MolliePayment,
  paymentRow: PaymentRow
) {
  if (!paymentRow.is_first_payment) {
    // A recurring charge succeeded — clear any past_due state and, best
    // effort, refresh the next billing date from Mollie.
    if (!paymentRow.subscription_id) return;
    const nextPeriodEnd = await fetchNextPeriodEnd(mollie, payment);
    await admin
      .from("subscriptions")
      .update({ status: "active", current_period_end: nextPeriodEnd })
      .eq("id", paymentRow.subscription_id);
    return;
  }

  // The mandate payment succeeded. Create the actual Mollie subscription
  // now that a mandate exists to charge against.
  if (!paymentRow.subscription_id) return;

  const { data: subscription } = await admin
    .from("subscriptions")
    .select("*")
    .eq("id", paymentRow.subscription_id)
    .maybeSingle();
  if (!subscription) return;

  // Idempotency: webhooks can be (and are, by design) delivered more
  // than once for the same status. Don't create a second Mollie
  // subscription if we already have one.
  if (subscription.mollie_subscription_id) return;

  if (!payment.customerId || !payment.mandateId) {
    console.error(
      `webhook: paid first payment ${payment.id} is missing customerId/mandateId, cannot start subscription`
    );
    return;
  }

  const { data: plan } = await admin
    .from("plans")
    .select("name")
    .eq("id", subscription.plan_id)
    .maybeSingle();

  const mollieSubscription = await mollie.customerSubscriptions.create({
    customerId: payment.customerId,
    amount: toMollieAmount(subscription.amount_cents, subscription.currency),
    interval: subscription.interval,
    description: `${plan?.name ?? "Subscription"} — ${subscription.id}`,
    mandateId: payment.mandateId,
    webhookUrl: `${getAppUrl()}/api/webhooks/mollie`,
    metadata: { subscriptionId: subscription.id },
  });

  await admin
    .from("subscriptions")
    .update({
      mollie_subscription_id: mollieSubscription.id,
      mollie_mandate_id: payment.mandateId,
      status: "active",
      current_period_end: toTimestamp(mollieSubscription.nextPaymentDate),
    })
    .eq("id", subscription.id);
}

async function handleDeadEnd(
  admin: SupabaseAdmin,
  payment: MolliePayment,
  paymentRow: PaymentRow
) {
  if (!paymentRow.subscription_id) return;

  const nextStatus: Subscription["status"] = paymentRow.is_first_payment
    ? "canceled" // the mandate never got established — nothing to run
    : "past_due"; // a recurring charge failed; Mollie retries this on its own schedule

  const patch: Partial<Subscription> = { status: nextStatus };
  if (nextStatus === "canceled") {
    patch.canceled_at = new Date().toISOString();
  }

  await admin.from("subscriptions").update(patch).eq("id", paymentRow.subscription_id);
}

/** Best-effort refresh of the subscription's next billing date. */
async function fetchNextPeriodEnd(
  mollie: MollieClient,
  payment: MolliePayment
): Promise<string | null> {
  if (!payment.subscriptionId || !payment.customerId) return null;
  try {
    const subscription = await mollie.customerSubscriptions.get(payment.subscriptionId, {
      customerId: payment.customerId,
    });
    return toTimestamp(subscription.nextPaymentDate);
  } catch (error) {
    console.error(
      `webhook: failed to refresh next payment date for subscription ${payment.subscriptionId}`,
      error
    );
    return null;
  }
}

function toTimestamp(dateOnly: string | undefined): string | null {
  return dateOnly ? new Date(`${dateOnly}T00:00:00Z`).toISOString() : null;
}
