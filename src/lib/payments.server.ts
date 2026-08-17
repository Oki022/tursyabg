import { type StripeEnv, createStripeClient } from "@/lib/stripe.server";

export type CheckoutInput = {
  packageId: string;
  environment: StripeEnv;
  returnUrl: string;
  userId: string;
  email?: string;
};

async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string; userId: string },
): Promise<string> {
  if (!/^[a-zA-Z0-9_-]+$/.test(options.userId)) throw new Error("Invalid userId");
  const found = await stripe.customers.search({
    query: `metadata['userId']:'${options.userId}'`,
    limit: 1,
  });
  if (found.data.length && found.data[0]) return found.data[0].id;

  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    const customer = existing.data[0];
    if (customer) {
      if (customer.metadata?.["userId"] !== options.userId) {
        await stripe.customers.update(customer.id, {
          metadata: { ...customer.metadata, userId: options.userId },
        });
      }
      return customer.id;
    }
  }

  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    metadata: { userId: options.userId },
  });
  return created.id;
}

/**
 * Creates a Stripe checkout session for a credit package.
 * The price is ALWAYS read from the database — never from the client.
 */
export async function createStripeCheckout(input: CheckoutInput): Promise<{ clientSecret: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: pkg, error } = await supabaseAdmin
    .from("credit_packages")
    .select("id, name, credits, price_eur, is_active")
    .eq("id", input.packageId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!pkg || !pkg.is_active) throw new Error("Пакетът не е наличен.");

  const amountInCents = Math.round(Number(pkg.price_eur) * 100);
  if (!Number.isFinite(amountInCents) || amountInCents < 50) throw new Error("Невалидна цена на пакета.");

  const stripe = createStripeClient(input.environment);
  const customerId = await resolveOrCreateCustomer(stripe, { email: input.email, userId: input.userId });

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    ui_mode: "embedded_page",
    locale: "bg",
    customer: customerId,
    return_url: input.returnUrl,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: amountInCents,
          product_data: {
            name: `${pkg.name} — ${pkg.credits} кредита`,
          },
        },
      },
    ],
    payment_intent_data: { description: `${pkg.name} — ${pkg.credits} кредита` },
    metadata: {
      userId: input.userId,
      packageId: pkg.id,
      credits: String(pkg.credits),
    },
  });

  const { error: insertError } = await supabaseAdmin.from("payments").insert({
    user_id: input.userId,
    package_id: pkg.id,
    credits: pkg.credits,
    amount_eur: Number(pkg.price_eur),
    currency: "EUR",
    provider: "stripe",
    stripe_session_id: session.id,
    status: "pending",
  });
  if (insertError) throw new Error(insertError.message);

  return { clientSecret: session.client_secret ?? "" };
}