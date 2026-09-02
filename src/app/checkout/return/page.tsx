import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Mollie redirects the customer here after they complete (or abandon)
 * the hosted checkout page. This is a courtesy landing spot only — the
 * actual subscription state change happens asynchronously via the
 * webhook, which is usually (but not guaranteedly) done by the time the
 * customer's browser gets redirected back.
 */
export default function CheckoutReturnPage() {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-sm text-center">
        <CardHeader>
          <CardTitle>Thanks!</CardTitle>
          <CardDescription>
            We&apos;re confirming your payment with Mollie now — this usually
            takes just a few seconds.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/dashboard">Go to dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
