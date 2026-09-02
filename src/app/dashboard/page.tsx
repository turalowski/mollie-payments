import Link from "next/link";
import { redirect } from "next/navigation";

import { CancelSubscriptionButton } from "@/components/cancel-subscription-button";
import { Badge, type badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatAmount } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { SubscriptionStatus } from "@/lib/supabase/types";
import type { VariantProps } from "class-variance-authority";

const CANCELABLE_STATUSES: SubscriptionStatus[] = ["pending", "active", "past_due"];

const STATUS_BADGE_VARIANT: Record<
  SubscriptionStatus,
  NonNullable<VariantProps<typeof badgeVariants>["variant"]>
> = {
  pending: "secondary",
  active: "success",
  past_due: "warning",
  canceled: "destructive",
  completed: "outline",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  const [{ data: subscriptions }, { data: payments }, { data: plans }] = await Promise.all([
    customer
      ? supabase
          .from("subscriptions")
          .select("*")
          .eq("customer_id", customer.id)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: null }),
    customer
      ? supabase
          .from("payments")
          .select("*")
          .eq("customer_id", customer.id)
          .order("created_at", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: null }),
    supabase.from("plans").select("id, name"),
  ]);

  const planNameById = new Map((plans ?? []).map((plan) => [plan.id, plan.name]));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Your subscription</h1>
        <p className="text-muted-foreground text-sm">Signed in as {user.email}</p>
      </div>

      {!subscriptions || subscriptions.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No subscription yet</CardTitle>
            <CardDescription>Choose a plan to get started.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/">View pricing</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        subscriptions.map((subscription) => (
          <Card key={subscription.id}>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <CardTitle>{planNameById.get(subscription.plan_id) ?? subscription.plan_id}</CardTitle>
                <Badge variant={STATUS_BADGE_VARIANT[subscription.status]}>
                  {subscription.status.replace("_", " ")}
                </Badge>
              </div>
              <CardDescription>
                {formatAmount(subscription.amount_cents, subscription.currency)} /{" "}
                {subscription.interval}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {subscription.current_period_end && subscription.status === "active" && (
                <p className="text-muted-foreground text-sm">
                  Next payment: {new Date(subscription.current_period_end).toLocaleDateString()}
                </p>
              )}
              {CANCELABLE_STATUSES.includes(subscription.status) && (
                <CancelSubscriptionButton subscriptionId={subscription.id} />
              )}
            </CardContent>
          </Card>
        ))
      )}

      {payments && payments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Payment history</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col">
            {payments.map((payment, index) => (
              <div key={payment.id}>
                {index > 0 && <Separator className="my-3" />}
                <div className="flex items-center justify-between gap-4 text-sm">
                  <div>
                    <p>{payment.description ?? "Payment"}</p>
                    <p className="text-muted-foreground">
                      {new Date(payment.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>{formatAmount(payment.amount_cents, payment.currency)}</span>
                    <Badge variant="outline">{payment.status}</Badge>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
