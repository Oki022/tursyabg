import { createFileRoute } from "@tanstack/react-router";

/**
 * Sends one in-app notification as a push to the user's phones.
 * Called by the database right after a notification is created
 * (public.notifications_push_after_insert) with a secret key in the
 * x-cron-key header, so outsiders cannot send pushes. Returns no personal data.
 */
export const Route = createFileRoute("/api/public/push/send")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const provided = request.headers.get("x-cron-key") ?? "";
        const { data: expected } = await supabaseAdmin
          .from("cron_secrets")
          .select("token")
          .eq("name", "push_send")
          .maybeSingle();
        if (!expected?.token || provided !== expected.token) {
          return new Response("Unauthorized", { status: 401 });
        }

        let notificationId = "";
        try {
          const body = (await request.json()) as { notification_id?: unknown };
          notificationId = typeof body.notification_id === "string" ? body.notification_id : "";
        } catch {
          // handled below
        }
        if (!/^[0-9a-f-]{36}$/i.test(notificationId)) {
          return Response.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
        }

        const { readServiceAccount, sendPush } = await import("@/lib/fcm.server");
        const sa = readServiceAccount();
        if (!sa) return Response.json({ ok: false, skipped: "FIREBASE_SERVICE_ACCOUNT missing" });

        const { data: n } = await supabaseAdmin
          .from("notifications")
          .select("id, user_id, title, body, link, read_at")
          .eq("id", notificationId)
          .maybeSingle();
        if (!n || n.read_at) return Response.json({ ok: true, sent: 0 });

        const { data: devices } = await supabaseAdmin
          .from("push_devices")
          .select("token")
          .eq("user_id", n.user_id)
          .limit(10);

        let sent = 0;
        const invalid: string[] = [];
        let failed = 0;
        for (const d of devices ?? []) {
          try {
            const result = await sendPush(sa, d.token, { title: n.title, body: n.body, link: n.link });
            if (result === "sent") sent += 1;
            else if (result === "invalid_token") invalid.push(d.token);
            else failed += 1;
          } catch {
            failed += 1;
          }
        }

        if (invalid.length) {
          await supabaseAdmin.from("push_devices").delete().in("token", invalid);
        }
        if (failed > 0 && sent === 0) {
          const { reportServerIssue } = await import("@/lib/monitoring/sentry.server");
          reportServerIssue({
            area: "api",
            action: "send push notification",
            error: new Error(`push failed for ${failed} device(s)`),
            route: "/api/public/push/send",
          });
        }

        return Response.json({ ok: true, sent, removed: invalid.length, failed });
      },
    },
  },
});
