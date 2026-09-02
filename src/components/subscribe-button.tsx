"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function SubscribeButton({
  planId,
  isSignedIn,
}: {
  planId: string;
  isSignedIn: boolean;
}) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (!isSignedIn) {
      router.push("/signup");
      return;
    }

    setIsPending(true);
    setError(null);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.checkoutUrl) {
        throw new Error(body?.error ?? "Failed to start checkout");
      }
      window.location.href = body.checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start checkout");
      setIsPending(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <Button onClick={handleClick} disabled={isPending} className="w-full">
        {isPending ? "Redirecting…" : "Subscribe"}
      </Button>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
