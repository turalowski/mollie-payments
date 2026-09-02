import { SubscribeButton } from "@/components/subscribe-button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatAmount } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const [{ data: plans }, { data: userData }] = await Promise.all([
    supabase.from("plans").select("*").eq("is_active", true).order("sort_order"),
    supabase.auth.getUser(),
  ]);

  return (
    <div className="flex flex-1 flex-col items-center gap-12 px-6 py-20">
      <div className="max-w-xl text-center">
        <h1 className="text-4xl font-semibold tracking-tight">
          Mollie Subscriptions Demo
        </h1>
        <p className="text-muted-foreground mt-3">
          A showcase Next.js + Supabase app demonstrating a real Mollie
          recurring-payment integration — checkout, webhooks, and
          subscription lifecycle handling. Runs entirely in Mollie test
          mode.
        </p>
      </div>

      <div className="grid w-full max-w-3xl gap-6 sm:grid-cols-2">
        {(plans ?? []).map((plan) => (
          <Card key={plan.id} className="flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-baseline justify-between">
                <span>{plan.name}</span>
                <span className="text-2xl font-semibold">
                  {formatAmount(plan.amount_cents, plan.currency)}
                  <span className="text-muted-foreground text-sm font-normal">
                    /{plan.interval}
                  </span>
                </span>
              </CardTitle>
              <CardDescription>{plan.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-2">
              {plan.features.map((feature) => (
                <div key={feature} className="flex items-center gap-2 text-sm">
                  <Badge variant="secondary" className="px-1.5">
                    ✓
                  </Badge>
                  {feature}
                </div>
              ))}
            </CardContent>
            <CardFooter>
              <SubscribeButton planId={plan.id} isSignedIn={Boolean(userData.user)} />
            </CardFooter>
          </Card>
        ))}
      </div>

      {(!plans || plans.length === 0) && (
        <p className="text-muted-foreground text-sm">
          No plans configured yet — run <code>supabase/seed.sql</code> against
          your Supabase project.
        </p>
      )}
    </div>
  );
}
