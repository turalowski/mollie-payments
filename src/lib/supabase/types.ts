// Hand-written to match supabase/migrations/0001_init.sql.
// If a live Supabase project is available, this can be regenerated with:
//   npx supabase gen types typescript --project-id <id> > src/lib/supabase/types.ts

export type SubscriptionStatus =
  | "pending"
  | "active"
  | "past_due"
  | "canceled"
  | "completed";

export interface Database {
  public: {
    Tables: {
      plans: {
        Row: {
          id: string;
          name: string;
          description: string;
          amount_cents: number;
          currency: string;
          interval: string;
          features: string[];
          is_active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["plans"]["Row"]> &
          Pick<
            Database["public"]["Tables"]["plans"]["Row"],
            "id" | "name" | "amount_cents"
          >;
        Update: Partial<Database["public"]["Tables"]["plans"]["Row"]>;
      };
      customers: {
        Row: {
          id: string;
          user_id: string;
          mollie_customer_id: string | null;
          email: string;
          name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["customers"]["Row"]> &
          Pick<Database["public"]["Tables"]["customers"]["Row"], "user_id" | "email">;
        Update: Partial<Database["public"]["Tables"]["customers"]["Row"]>;
      };
      subscriptions: {
        Row: {
          id: string;
          customer_id: string;
          plan_id: string;
          mollie_subscription_id: string | null;
          mollie_mandate_id: string | null;
          status: SubscriptionStatus;
          amount_cents: number;
          currency: string;
          interval: string;
          current_period_end: string | null;
          canceled_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["subscriptions"]["Row"]> &
          Pick<
            Database["public"]["Tables"]["subscriptions"]["Row"],
            "customer_id" | "plan_id" | "amount_cents" | "interval"
          >;
        Update: Partial<Database["public"]["Tables"]["subscriptions"]["Row"]>;
      };
      payments: {
        Row: {
          id: string;
          customer_id: string;
          subscription_id: string | null;
          mollie_payment_id: string;
          status: string;
          amount_cents: number;
          currency: string;
          description: string | null;
          is_first_payment: boolean;
          metadata: Record<string, unknown>;
          paid_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["payments"]["Row"]> &
          Pick<
            Database["public"]["Tables"]["payments"]["Row"],
            "customer_id" | "mollie_payment_id" | "status" | "amount_cents"
          >;
        Update: Partial<Database["public"]["Tables"]["payments"]["Row"]>;
      };
    };
  };
}

export type Plan = Database["public"]["Tables"]["plans"]["Row"];
export type Customer = Database["public"]["Tables"]["customers"]["Row"];
export type Subscription = Database["public"]["Tables"]["subscriptions"]["Row"];
export type Payment = Database["public"]["Tables"]["payments"]["Row"];
