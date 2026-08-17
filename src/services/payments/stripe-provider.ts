import { createCheckoutSession, createPromotionCheckoutSession } from "@/utils/payments.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { StripeCheckoutSurface } from "./stripe-checkout";
import type { CheckoutStart, CheckoutTarget, PaymentProviderAdapter } from "./types";

export const stripeProvider: PaymentProviderAdapter = {
  id: "stripe",
  label: "Карта (Visa / Mastercard)",
  available: true,
  CheckoutSurface: StripeCheckoutSurface,
  async startCheckout(target: CheckoutTarget, returnUrl: string): Promise<CheckoutStart> {
    const environment = getStripeEnvironment();
    const result =
      target.kind === "credits"
        ? await createCheckoutSession({ data: { packageId: target.packageId, returnUrl, environment } })
        : await createPromotionCheckoutSession({
            data: { promoProductId: target.promoProductId, taskId: target.taskId, returnUrl, environment },
          });
    if ("error" in result) throw new Error(result.error);
    if (!result.clientSecret) throw new Error("Плащането не може да стартира. Опитай отново.");
    return { kind: "embedded", clientSecret: result.clientSecret };
  },
};