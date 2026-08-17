import { supabase } from "@/integrations/supabase/client";
import { stripeProvider } from "./stripe-provider";
import type { CheckoutStart, Payment, PaymentProvider, PaymentProviderAdapter, PaymentStatus } from "./types";

export type { CheckoutStart, Payment, PaymentProvider, PaymentStatus };

/** Registry — new providers (SMS, ePay/EasyPay) plug in here without touching callers. */
const providers: Record<PaymentProvider, PaymentProviderAdapter | undefined> = {
  stripe: stripeProvider,
  sms: undefined,
  epay: undefined,
};

export function listProviders(): PaymentProviderAdapter[] {
  return Object.values(providers).filter((p): p is PaymentProviderAdapter => Boolean(p?.available));
}

/** Single entry point for starting a purchase, regardless of provider. */
export async function createCheckout(
  packageId: string,
  provider: PaymentProvider = "stripe",
  returnUrl?: string,
): Promise<CheckoutStart> {
  const adapter = providers[provider];
  if (!adapter?.available) throw new Error("Този метод на плащане още не е наличен.");
  const url =
    returnUrl ??
    (typeof window !== "undefined"
      ? `${window.location.origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`
      : "/billing/success");
  return adapter.startCheckout(packageId, url);
}

export async function getMyPayments(): Promise<Payment[]> {
  const { data, error } = await supabase
    .from("payments")
    .select("id, package_id, credits, amount_eur, provider, status, receipt_url, created_at, completed_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map((p) => ({
    id: p.id,
    packageId: p.package_id,
    credits: p.credits,
    amountEur: Number(p.amount_eur),
    provider: p.provider as PaymentProvider,
    status: p.status as PaymentStatus,
    receiptUrl: p.receipt_url,
    createdAt: p.created_at,
    completedAt: p.completed_at,
  }));
}

export async function getPaymentBySession(sessionId: string): Promise<Payment | null> {
  const { data, error } = await supabase
    .from("payments")
    .select("id, package_id, credits, amount_eur, provider, status, receipt_url, created_at, completed_at")
    .eq("stripe_session_id", sessionId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    packageId: data.package_id,
    credits: data.credits,
    amountEur: Number(data.amount_eur),
    provider: data.provider as PaymentProvider,
    status: data.status as PaymentStatus,
    receiptUrl: data.receipt_url,
    createdAt: data.created_at,
    completedAt: data.completed_at,
  };
}