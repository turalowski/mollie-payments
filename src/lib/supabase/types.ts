// Hand-written to match supabase/migrations/0001_init.sql, in the same
// shape `npx supabase gen types typescript` would generate. If a live
// Supabase project is available, prefer regenerating this file with:
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
        Insert: {
          id: string;
          name: string;
          description?: string;
          amount_cents: number;
          currency?: string;
          interval?: string;
          features?: string[];
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["plans"]["Insert"]>;
        Relationships: [];
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
        Insert: {
          id?: string;
          user_id: string;
          mollie_customer_id?: string | null;
          email: string;
          name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["customers"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "customers_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
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
        Insert: {
          id?: string;
          customer_id: string;
          plan_id: string;
          mollie_subscription_id?: string | null;
          mollie_mandate_id?: string | null;
          status?: SubscriptionStatus;
          amount_cents: number;
          currency?: string;
          interval: string;
          current_period_end?: string | null;
          canceled_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["subscriptions"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "subscriptions_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id"];
          },
        ];
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
        Insert: {
          id?: string;
          customer_id: string;
          subscription_id?: string | null;
          mollie_payment_id: string;
          status: string;
          amount_cents: number;
          currency?: string;
          description?: string | null;
          is_first_payment?: boolean;
          metadata?: Record<string, unknown>;
          paid_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["payments"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "payments_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_subscription_id_fkey";
            columns: ["subscription_id"];
            isOneToOne: false;
            referencedRelation: "subscriptions";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      subscription_status: SubscriptionStatus;
    };
  };
}

export type Plan = Database["public"]["Tables"]["plans"]["Row"];
export type Customer = Database["public"]["Tables"]["customers"]["Row"];
export type Subscription = Database["public"]["Tables"]["subscriptions"]["Row"];
export type Payment = Database["public"]["Tables"]["payments"]["Row"];
