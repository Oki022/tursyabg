import { useCallback, useMemo } from "react";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { getStripe } from "@/lib/stripe";
import { createCheckout } from "./index";
import type { CheckoutSurfaceProps } from "./types";

/** Stripe-specific rendering lives here, callers only use the adapter's CheckoutSurface. */
export function StripeCheckoutSurface({ target, returnUrl }: CheckoutSurfaceProps) {
  const targetKey = JSON.stringify(target);
  const fetchClientSecret = useCallback(async () => {
    const start = await createCheckout(JSON.parse(targetKey), "stripe", returnUrl);
    if (start.kind !== "embedded") throw new Error("Неподдържан метод на плащане.");
    return start.clientSecret;
  }, [targetKey, returnUrl]);

  const options = useMemo(() => ({ fetchClientSecret }), [fetchClientSecret]);

  return (
    <EmbeddedCheckoutProvider key={targetKey} stripe={getStripe()} options={options}>
      <EmbeddedCheckout />
    </EmbeddedCheckoutProvider>
  );
}
