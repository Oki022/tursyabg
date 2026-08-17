import { useCallback, useMemo } from "react";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { getStripe } from "@/lib/stripe";
import { createCheckout } from "./index";
import type { CheckoutSurfaceProps } from "./types";

/** Stripe-specific rendering lives here — callers only use the adapter's CheckoutSurface. */
export function StripeCheckoutSurface({ packageId, returnUrl }: CheckoutSurfaceProps) {
  const fetchClientSecret = useCallback(async () => {
    const start = await createCheckout(packageId, "stripe", returnUrl);
    if (start.kind !== "embedded") throw new Error("Неподдържан метод на плащане.");
    return start.clientSecret;
  }, [packageId, returnUrl]);

  const options = useMemo(() => ({ fetchClientSecret }), [fetchClientSecret]);

  return (
    <EmbeddedCheckoutProvider key={packageId} stripe={getStripe()} options={options}>
      <EmbeddedCheckout />
    </EmbeddedCheckoutProvider>
  );
}
