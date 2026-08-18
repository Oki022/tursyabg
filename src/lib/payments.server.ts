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
 * The price is ALWAYS read from the database, never from the client.
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
            name: `${pkg.name}, ${pkg.credits} кредита`,
          },
        },
      },
    ],
    payment_intent_data: { description: `${pkg.name}, ${pkg.credits} кредита` },
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

export type PromotionCheckoutInput = {
  promoProductId: string;
  taskId: string;
  environment: StripeEnv;
  returnUrl: string;
  userId: string;
  email?: string;
};

/**
 * Creates a Stripe checkout session for a task promotion.
 * Ownership, availability and the price are ALWAYS verified server-side.
 */
export async function createPromotionStripeCheckout(
  input: PromotionCheckoutInput,
): Promise<{ clientSecret: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: task, error: taskError } = await supabaseAdmin
    .from("tasks")
    .select("id, user_id, title, status")
    .eq("id", input.taskId)
    .maybeSingle();
  if (taskError) throw new Error(taskError.message);
  if (!task) throw new Error("Задачата не е намерена.");
  if (task.user_id !== input.userId) throw new Error("Можеш да промотираш само своя задача.");

  const { data: promo, error } = await supabaseAdmin
    .from("promo_products")
    .select("id, code, name_bg, type, duration_days, price_eur, is_active")
    .eq("id", input.promoProductId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!promo || !promo.is_active) throw new Error("Промоцията не е налична.");

  if (promo.type === "bump") {
    const { data: allowed, error: bumpError } = await supabaseAdmin.rpc("can_bump_task", {
      _task_id: input.taskId,
    });
    if (bumpError) throw new Error(bumpError.message);
    if (!allowed) throw new Error("Можеш да обновяваш тази задача веднъж на 24 часа.");
  }

  const amountInCents = Math.round(Number(promo.price_eur) * 100);
  if (!Number.isFinite(amountInCents) || amountInCents < 50) throw new Error("Невалидна цена на промоцията.");

  const stripe = createStripeClient(input.environment);
  const customerId = await resolveOrCreateCustomer(stripe, { email: input.email, userId: input.userId });
  const label = `${promo.name_bg}, ${task.title}`.slice(0, 250);

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
          product_data: { name: label },
        },
      },
    ],
    payment_intent_data: { description: label },
    metadata: {
      userId: input.userId,
      taskId: task.id,
      promoProductId: promo.id,
      promoCode: promo.code,
      kind: "promotion",
    },
  });

  const { error: insertError } = await supabaseAdmin.from("payments").insert({
    user_id: input.userId,
    kind: "promotion",
    task_id: task.id,
    promo_product_id: promo.id,
    credits: 0,
    amount_eur: Number(promo.price_eur),
    currency: "EUR",
    provider: "stripe",
    stripe_session_id: session.id,
    status: "pending",
  });
  if (insertError) throw new Error(insertError.message);

  return { clientSecret: session.client_secret ?? "" };
}
