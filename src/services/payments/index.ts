import { supabase } from "@/integrations/supabase/client";
import { stripeProvider } from "./stripe-provider";
import type {
  CheckoutStart,
  CheckoutSurfaceProps,
  Payment,
  PaymentProvider,
  PaymentProviderAdapter,
  PaymentStatus,
} from "./types";

export type { CheckoutStart, CheckoutSurfaceProps, Payment, PaymentProvider, PaymentProviderAdapter, PaymentStatus };

/** Column holding the opaque provider reference; kept behind this constant so callers stay provider-agnostic. */
const REFERENCE_COLUMN = "stripe_session_id";
const SELECT_COLUMNS =
  "id, package_id, credits, amount_eur, provider, status, receipt_url, created_at, completed_at, stripe_session_id";

/** Registry — new providers (SMS, ePay/EasyPay) plug in here without touching callers. */
const providers: Record<PaymentProvider, PaymentProviderAdapter | undefined> = {
  stripe: stripeProvider,
  sms: undefined,
  epay: undefined,
};

export function listProviders(): PaymentProviderAdapter[] {
  return Object.values(providers).filter((p): p is PaymentProviderAdapter => Boolean(p?.available));
}

export function getProvider(provider: PaymentProvider = "stripe"): PaymentProviderAdapter | undefined {
  const adapter = providers[provider];
  return adapter?.available ? adapter : undefined;
}

/** Default return URL for redirect/return flows; `{CHECKOUT_SESSION_ID}` is substituted by the provider. */
export function defaultReturnUrl(): string {
  return typeof window !== "undefined"
    ? `${window.location.origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`
    : "/billing/success";
}

/** Single entry point for starting a purchase, regardless of provider. */
export async function createCheckout(
  packageId: string,
  provider: PaymentProvider = "stripe",
  returnUrl?: string,
): Promise<CheckoutStart> {
  const adapter = getProvider(provider);
  if (!adapter) throw new Error("Този метод на плащане още не е наличен.");
  return adapter.startCheckout(packageId, returnUrl ?? defaultReturnUrl());
}

function toPayment(p: Record<string, any>): Payment {
  return {
    id: p["id"],
    packageId: p["package_id"],
    credits: p["credits"],
    amountEur: Number(p["amount_eur"]),
    provider: p["provider"] as PaymentProvider,
    status: p["status"] as PaymentStatus,
    receiptUrl: p["receipt_url"],
    createdAt: p["created_at"],
    completedAt: p["completed_at"],
    externalReference: p[REFERENCE_COLUMN] ?? null,
  };
}

export async function getMyPayments(): Promise<Payment[]> {
  const { data, error } = await supabase
    .from("payments")
    .select(SELECT_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map(toPayment);
}

/** Look up a payment by its opaque provider reference. */
export async function getPaymentByReference(reference: string): Promise<Payment | null> {
  const { data, error } = await supabase
    .from("payments")
    .select(SELECT_COLUMNS)
    .eq(REFERENCE_COLUMN, reference)
    .maybeSingle();
  if (error) throw error;
  return data ? toPayment(data) : null;
}

/** Realtime subscription for a single payment, keyed by its opaque provider reference. */
export function subscribeToPayment(reference: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(`payment-${reference}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "payments", filter: `${REFERENCE_COLUMN}=eq.${reference}` },
      () => onChange(),
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}