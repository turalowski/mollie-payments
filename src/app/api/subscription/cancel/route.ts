import { NextResponse } from "next/server";
import { MollieApiError } from "@mollie/api-client";
import { z } from "zod";

import { getMollieClient } from "@/lib/mollie/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

const requestSchema = z.object({
  subscriptionId: z.string().uuid(),
});

const CANCELABLE_STATUSES = new Set(["pending", "active", "past_due"]);

/**
 * Cancels a subscription, both on Mollie and locally.
 *
 * Ownership is checked by reading the subscription through the
 * RLS-scoped server client first — its "owning user" SELECT policy
 * means a row only comes back if it belongs to the caller, so a
 * mismatched/foreign subscriptionId reads as "not found" rather than
 * needing a separate authorization check.
 */
export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { subscriptionId } = parsed.data;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: subscription, error: subscriptionError } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("id", subscriptionId)
    .maybeSingle();

  if (subscriptionError) {
    console.error("cancel: failed to load subscription", subscriptionError);
    return NextResponse.json({ error: "Failed to load subscription" }, { status: 500 });
  }
  if (!subscription) {
    return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
  }
  if (!CANCELABLE_STATUSES.has(subscription.status)) {
    return NextResponse.json(
      { error: `Subscription is already ${subscription.status}` },
      { status: 409 }
    );
  }

  const admin = createAdminClient();

  if (subscription.mollie_subscription_id) {
    const { data: customer, error: customerError } = await admin
      .from("customers")
      .select("mollie_customer_id")
      .eq("id", subscription.customer_id)
      .maybeSingle();

    if (customerError || !customer?.mollie_customer_id) {
      console.error(
        "cancel: subscription has no resolvable Mollie customer",
        customerError
      );
      return NextResponse.json({ error: "Failed to cancel subscription" }, { status: 500 });
    }

    try {
      await getMollieClient().customerSubscriptions.cancel(
        subscription.mollie_subscription_id,
        { customerId: customer.mollie_customer_id }
      );
    } catch (error) {
      // 404 means Mollie already considers it gone (e.g. canceled from
      // the Mollie dashboard, or a retried request) — treat that as
      // success rather than failing the whole request.
      const alreadyGone = error instanceof MollieApiError && error.statusCode === 404;
      if (!alreadyGone) {
        console.error("cancel: Mollie subscription cancellation failed", error);
        return NextResponse.json({ error: "Failed to cancel subscription" }, { status: 502 });
      }
    }
  }

  const { data: updated, error: updateError } = await admin
    .from("subscriptions")
    .update({ status: "canceled", canceled_at: new Date().toISOString() })
    .eq("id", subscription.id)
    .select()
    .single();

  if (updateError || !updated) {
    console.error("cancel: failed to update local subscription", updateError);
    return NextResponse.json({ error: "Failed to cancel subscription" }, { status: 500 });
  }

  return NextResponse.json({ subscription: updated });
}
