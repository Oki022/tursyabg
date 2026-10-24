import { createFileRoute } from "@tanstack/react-router";

/**
 * RevenueCat webhook: purchases and refunds made in the mobile app through
 * Google Play (and later the App Store). RevenueCat has already verified the
 * purchase with the store. Points are added (or a promotion is recorded as
 * paid) in the database, idempotently per store transaction.
 *
 * Security: RevenueCat sends the Authorization header configured in its
 * dashboard; it must equal the server variable REVENUECAT_WEBHOOK_AUTH.
 * Returns no personal data.
 */

type RcEvent = {
  type?: string;
  id?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  aliases?: string[];
  product_id?: string;
  transaction_id?: string;
  store?: string;
  environment?: string;
  price_in_purchased_currency?: number | null;
  currency?: string | null;
  commission_percentage?: number | null;
  purchased_at_ms?: number | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PROVIDERS: Record<string, "google_play" | "app_store"> = {
  PLAY_STORE: "google_play",
  APP_STORE: "app_store",
};

/** Constant-time comparison, so the secret cannot be guessed from timing. */
function sameSecret(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/** Our user id: the app logs in to RevenueCat with the Supabase user id. */
function userIdOf(e: RcEvent): string | null {
  const candidates = [e.app_user_id, e.original_app_user_id, ...(e.aliases ?? [])];
  return candidates.find((c): c is string => typeof c === "string" && UUID.test(c)) ?? null;
}

export const Route = createFileRoute("/api/public/payments/revenuecat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["REVENUECAT_WEBHOOK_AUTH"] ?? "";
        if (!expected) return new Response("Not configured", { status: 503 });
        const provided = request.headers.get("authorization") ?? "";
        if (!sameSecret(provided, expected)) return new Response("Unauthorized", { status: 401 });

        let event: RcEvent | null = null;
        try {
          const body = (await request.json()) as { event?: RcEvent };
          event = body.event ?? null;
        } catch {
          return Response.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
        }
        if (!event?.type) return Response.json({ ok: false, error: "NO_EVENT" }, { status: 400 });

        // Dashboard "Send test event" and subscription events: nothing to do.
        if (event.type !== "NON_RENEWING_PURCHASE" && event.type !== "CANCELLATION") {
          return Response.json({ ok: true, ignored: event.type });
        }

        const provider = PROVIDERS[event.store ?? ""];
        if (!provider || !event.transaction_id) {
          return Response.json({ ok: true, ignored: "store" });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { reportServerIssue } = await import("@/lib/monitoring/sentry.server");

        try {
          if (event.type === "NON_RENEWING_PURCHASE") {
            const userId = userIdOf(event);
            if (!userId || !event.product_id) {
              reportServerIssue({
                area: "payments.webhook",
                action: "store purchase without user or product",
                error: new Error(`RevenueCat event ${event.id ?? "?"} without our user id or product`),
                route: "/api/public/payments/revenuecat",
              });
              return Response.json({ ok: false, error: "NO_USER" });
            }
            const { data, error } = await supabaseAdmin.rpc("complete_store_purchase", {
              _provider: provider,
              _transaction_id: event.transaction_id,
              _user_id: userId,
              _product_id: event.product_id,
              _price: event.price_in_purchased_currency ?? null,
              _currency: event.currency ?? null,
              _commission_pct: event.commission_percentage ?? null,
              _purchased_at: event.purchased_at_ms ? new Date(event.purchased_at_ms).toISOString() : null,
              _test_mode: event.environment === "SANDBOX",
            });
            if (error) throw new Error(error.message);
            const result = (data ?? {}) as { ok?: boolean; error?: string };
            if (!result.ok) {
              // The money was taken but nothing was granted: highest priority.
              reportServerIssue({
                area: "payments.webhook",
                action: "complete store purchase",
                error: new Error(`complete_store_purchase: ${result.error ?? "failed"} (${event.product_id})`),
                route: "/api/public/payments/revenuecat",
              });
            }
            return Response.json({ ok: !!result.ok });
          }

          // CANCELLATION of a one-time purchase means it was refunded.
          const { data, error } = await supabaseAdmin.rpc("refund_store_purchase", {
            _provider: provider,
            _transaction_id: event.transaction_id,
            _status: "refunded",
          });
          if (error) throw new Error(error.message);
          return Response.json({ ok: !!(data as { ok?: boolean } | null)?.ok });
        } catch (e) {
          reportServerIssue({
            area: "payments.webhook",
            action: `revenuecat ${event.type}`,
            error: e,
            route: "/api/public/payments/revenuecat",
          });
          // 500 makes RevenueCat retry later.
          return Response.json({ ok: false }, { status: 500 });
        }
      },
    },
  },
});
