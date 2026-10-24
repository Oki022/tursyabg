import { createFileRoute } from "@tanstack/react-router";
import {
  type StripeEnv,
  createStripeClient,
  getStripeEnvironment,
  verifyWebhook,
} from "@/lib/stripe.server";

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Records the event id; returns false when this event was already processed. */
async function markEventProcessed(eventId: string, eventType: string): Promise<boolean> {
  const admin = await getAdmin();
  const { error } = await admin
    .from("payment_events")
    .insert({ provider: "stripe", event_id: eventId, event_type: eventType });
  if (error) {
    if (error.code === "23505") return false;
    throw new Error(error.message);
  }
  return true;
}

async function handleCheckoutCompleted(session: any, env: StripeEnv) {
  if (session.payment_status === "unpaid") return;

  let receiptUrl: string | null = null;
  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;

  if (paymentIntentId) {
    try {
      const stripe = createStripeClient(env);
      const charges = await stripe.charges.list({ payment_intent: paymentIntentId, limit: 1 });
      receiptUrl = charges.data[0]?.receipt_url ?? null;
    } catch (e) {
      console.error("Could not resolve receipt url:", e);
    }
  }

  const admin = await getAdmin();

  // Route to the right fulfilment RPC based on what the payment bought.
  const { data: payment } = await admin
    .from("payments")
    .select("id, kind")
    .eq("stripe_session_id", session.id as string)
    .maybeSingle();

  if (payment?.kind === "promotion") {
    const { data: promoResult, error: promoError } = await admin.rpc("complete_promotion_payment", {
      _session_id: session.id as string,
      _payment_intent: paymentIntentId as unknown as string,
      _receipt_url: receiptUrl as unknown as string,
    });
    if (promoError) throw new Error(promoError.message);
    console.log("complete_promotion_payment:", JSON.stringify(promoResult));
    await confirmByEmail(payment.id, promoResult);
    return;
  }

  const { data, error } = await admin.rpc("complete_payment", {
    _session_id: session.id as string,
    _payment_intent: paymentIntentId as unknown as string,
    _receipt_url: receiptUrl as unknown as string,
  });
  if (error) throw new Error(error.message);
  console.log("complete_payment:", JSON.stringify(data));
  if (payment?.id) await confirmByEmail(payment.id, data);
}

/** Purchase e-mail only when this call completed the payment (not on a Stripe retry). */
async function confirmByEmail(paymentId: string, result: unknown) {
  const r = (result ?? {}) as { ok?: boolean; already?: boolean };
  if (!r.ok || r.already) return;
  const { sendPurchaseEmail } = await import("@/lib/purchase-email.server");
  await sendPurchaseEmail(paymentId);
}

async function handleRefund(charge: any, status: "refunded" | "disputed") {
  const paymentIntentId =
    typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id ?? null;
  if (!paymentIntentId) return;
  const admin = await getAdmin();
  const { data, error } = await admin.rpc("refund_payment", {
    _payment_intent: paymentIntentId,
    _status: status,
  });
  if (error) throw new Error(error.message);
  console.log("refund_payment:", JSON.stringify(data));
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { reportServerIssue } = await import("@/lib/monitoring/sentry.server");
        // Environment is a deployment concern now (STRIPE_ENVIRONMENT); the
        // legacy ?env= query parameter is still honoured if present.
        const rawEnv = new URL(request.url).searchParams.get("env");
        const env: StripeEnv =
          rawEnv === "sandbox" || rawEnv === "live" ? rawEnv : getStripeEnvironment();
        let eventType = "unknown";
        try {
          const event = await verifyWebhook(request, env);
          eventType = event.type;

          const isNew = await markEventProcessed(event.id, event.type);
          if (!isNew) {
            return Response.json({ received: true, duplicate: true });
          }

          switch (event.type) {
            case "checkout.session.completed":
            case "checkout.session.async_payment_succeeded":
              await handleCheckoutCompleted(event.data.object, env);
              break;
            case "charge.refunded":
              await handleRefund(event.data.object, "refunded");
              break;
            case "charge.dispute.created":
              await handleRefund((event.data.object as any).charge
                ? { payment_intent: (event.data.object as any).payment_intent }
                : event.data.object, "disputed");
              break;
            default:
              console.log("Unhandled Stripe event:", event.type);
          }
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          // Payment taken but fulfilment failed: highest alert priority.
          reportServerIssue({
            area: "payments.webhook",
            action: `stripe webhook failed (${eventType})`,
            error: e,
            route: "/api/public/payments/webhook",
            extra: { stripe_env: env, event_type: eventType },
          });
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});