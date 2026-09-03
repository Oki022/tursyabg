import { loadStripe, type Stripe } from "@stripe/stripe-js";

type StripeEnv = "sandbox" | "live";

const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

function paymentsEnvironment(): StripeEnv {
  if (publishableKey?.startsWith("pk_test_")) return "sandbox";
  if (publishableKey?.startsWith("pk_live_")) return "live";
  throw new Error(
    "Плащанията не са конфигурирани за тази среда. Задай VITE_STRIPE_PUBLISHABLE_KEY.",
  );
}

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    paymentsEnvironment();
    stripePromise = loadStripe(publishableKey as string);
  }
  return stripePromise;
}

export function getStripeEnvironment(): StripeEnv {
  return paymentsEnvironment();
}
