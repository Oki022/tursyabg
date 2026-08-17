import { createCheckoutSession } from "@/utils/payments.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { StripeCheckoutSurface } from "./stripe-checkout";
import type { CheckoutStart, PaymentProviderAdapter } from "./types";

export const stripeProvider: PaymentProviderAdapter = {
  id: "stripe",
  label: "Карта (Visa / Mastercard)",
  available: true,
  CheckoutSurface: StripeCheckoutSurface,
  async startCheckout(packageId: string, returnUrl: string): Promise<CheckoutStart> {
    const result = await createCheckoutSession({
      data: { packageId, returnUrl, environment: getStripeEnvironment() },
    });
    if ("error" in result) throw new Error(result.error);
    if (!result.clientSecret) throw new Error("Плащането не може да стартира. Опитай отново.");
    return { kind: "embedded", clientSecret: result.clientSecret };
  },
};