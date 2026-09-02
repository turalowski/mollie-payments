import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-16 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">
        Mollie Subscriptions Demo
      </h1>
      <p className="text-muted-foreground max-w-md">
        Scaffold in progress — pricing, checkout, and subscription dashboard
        land in upcoming commits.
      </p>
      <Button>shadcn/ui is wired up</Button>
    </div>
  );
}
