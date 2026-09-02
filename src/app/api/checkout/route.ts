import { NextResponse } from "next/server";
import { SequenceType } from "@mollie/api-client";
import { z } from "zod";

import { getAppUrl } from "@/lib/app-url";
import { toMollieAmount } from "@/lib/mollie/amount";
import { getMollieClient } from "@/lib/mollie/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

const requestSchema = z.object({
  planId: z.string().min(1),
});

/**
 * Starts a subscription checkout:
 * 1. Ensure the signed-in user has a Mollie customer.
 * 2. Create a local `subscriptions` row in "pending" state.
 * 3. Create a Mollie `first` payment for that plan's amount — this both
 *    charges the customer once and establishes the mandate Mollie needs
 *    for the recurring charges the webhook creates once this is paid.
 *
 * The actual Mollie `subscription` object is only created once the
 * webhook confirms this first payment succeeded (see
 * /api/webhooks/mollie) — creating it here, before the mandate exists,
 * would fail.
 */
export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { planId } = parsed.data;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: plan, error: planError } = await supabase
    .from("plans")
    .select("*")
    .eq("id", planId)
    .eq("is_active", true)
    .maybeSingle();

  if (planError) {
    console.error("checkout: failed to load plan", planError);
    return NextResponse.json({ error: "Failed to load plan" }, { status: 500 });
  }
  if (!plan) {
    return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
  }

  const admin = createAdminClient();
  const mollie = getMollieClient();
  const appUrl = getAppUrl();

  try {
    // 1. Find or create the local customer + matching Mollie customer.
    let { data: customer } = await admin
      .from("customers")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!customer) {
      const { data: inserted, error: insertError } = await admin
        .from("customers")
        .insert({
          user_id: user.id,
          email: user.email,
          name: typeof user.user_metadata?.full_name === "string"
            ? user.user_metadata.full_name
            : null,
        })
        .select()
        .single();

      if (insertError || !inserted) {
        throw insertError ?? new Error("Failed to create customer");
      }
      customer = inserted;
    }

    let mollieCustomerId = customer.mollie_customer_id;
    if (!mollieCustomerId) {
      const mollieCustomer = await mollie.customers.create({
        name: customer.name ?? undefined,
        email: customer.email,
        metadata: { supabaseUserId: user.id },
      });
      mollieCustomerId = mollieCustomer.id;

      const { error: updateError } = await admin
        .from("customers")
        .update({ mollie_customer_id: mollieCustomerId })
        .eq("id", customer.id);
      if (updateError) throw updateError;
    }

    // 2. Create the local subscription row, still "pending".
    const { data: subscription, error: subscriptionError } = await admin
      .from("subscriptions")
      .insert({
        customer_id: customer.id,
        plan_id: plan.id,
        amount_cents: plan.amount_cents,
        currency: plan.currency,
        interval: plan.interval,
        status: "pending",
      })
      .select()
      .single();

    if (subscriptionError || !subscription) {
      throw subscriptionError ?? new Error("Failed to create subscription");
    }

    // 3. Create the Mollie first payment. `sequenceType: first` is what
    // tells Mollie to store a reusable mandate from this payment.
    const payment = await mollie.payments.create({
      amount: toMollieAmount(plan.amount_cents, plan.currency),
      customerId: mollieCustomerId,
      sequenceType: SequenceType.first,
      description: `${plan.name} subscription — first payment`,
      redirectUrl: `${appUrl}/checkout/return?subscription_id=${subscription.id}`,
      webhookUrl: `${appUrl}/api/webhooks/mollie`,
      metadata: {
        subscriptionId: subscription.id,
        planId: plan.id,
        kind: "first_payment",
      },
    });

    const { error: paymentInsertError } = await admin.from("payments").insert({
      customer_id: customer.id,
      subscription_id: subscription.id,
      mollie_payment_id: payment.id,
      status: payment.status,
      amount_cents: plan.amount_cents,
      currency: plan.currency,
      description: payment.description,
      is_first_payment: true,
    });
    if (paymentInsertError) throw paymentInsertError;

    const checkoutUrl = payment.getCheckoutUrl();
    if (!checkoutUrl) {
      throw new Error("Mollie did not return a checkout URL");
    }

    return NextResponse.json({ checkoutUrl });
  } catch (error) {
    console.error("checkout: failed to start subscription checkout", error);
    return NextResponse.json(
      { error: "Failed to start checkout" },
      { status: 500 }
    );
  }
}
