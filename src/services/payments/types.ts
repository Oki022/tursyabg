import type { ComponentType } from "react";

export type PaymentProvider = "stripe" | "sms" | "epay";

export type PaymentStatus = "pending" | "completed" | "refunded" | "disputed" | "failed";

export type Payment = {
  id: string;
  packageId: string | null;
  credits: number;
  amountEur: number;
  provider: PaymentProvider;
  status: PaymentStatus;
  receiptUrl: string | null;
  createdAt: string;
  completedAt: string | null;
  /** Opaque provider reference (Stripe session id, SMS ticket, ePay invoice id…). */
  externalReference: string | null;
};

/** Result of starting a checkout. `clientSecret` mounts an embedded form, `redirectUrl` navigates away. */
export type CheckoutStart =
  | { kind: "embedded"; clientSecret: string }
  | { kind: "redirect"; url: string };

export type CheckoutSurfaceProps = { packageId: string; returnUrl?: string };

export interface PaymentProviderAdapter {
  id: PaymentProvider;
  label: string;
  available: boolean;
  startCheckout(packageId: string, returnUrl: string): Promise<CheckoutStart>;
  /** Optional inline UI for providers that render a payment form in place. */
  CheckoutSurface?: ComponentType<CheckoutSurfaceProps>;
}