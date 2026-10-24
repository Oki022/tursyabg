import { createFileRoute } from "@tanstack/react-router";

/**
 * Sends one in-app notification or one chat message as a push to the user's
 * phones. Called by the database right after it is created
 * (notifications_push_after_insert / messages_push_after_insert) with a secret key in the
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
        let messageId = "";
        try {
          const body = (await request.json()) as { notification_id?: unknown; message_id?: unknown };
          notificationId = typeof body.notification_id === "string" ? body.notification_id : "";
          messageId = typeof body.message_id === "string" ? body.message_id : "";
        } catch {
          // handled below
        }
        const uuid = /^[0-9a-f-]{36}$/i;
        if (!uuid.test(notificationId) && !uuid.test(messageId)) {
          return Response.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
        }

        const { readServiceAccount, sendPush } = await import("@/lib/fcm.server");
        const sa = readServiceAccount();
        if (!sa) {
          const why = process.env["FIREBASE_SERVICE_ACCOUNT"] ? "FIREBASE_SERVICE_ACCOUNT invalid JSON" : "FIREBASE_SERVICE_ACCOUNT missing";
          return Response.json({ ok: false, skipped: why });
        }

        // What to send: an in-app notification, or a chat message.
        let target: { userId: string; title: string; body: string; link: string | null } | null = null;
        if (uuid.test(notificationId)) {
          const { data: n } = await supabaseAdmin
            .from("notifications")
            .select("user_id, title, body, link, read_at")
            .eq("id", notificationId)
            .maybeSingle();
          if (n && !n.read_at) target = { userId: n.user_id, title: n.title, body: n.body, link: n.link };
        } else {
          const { data: m } = await supabaseAdmin
            .from("messages")
            .select("receiver_id, sender_id, content, conversation_id, read_at")
            .eq("id", messageId)
            .maybeSingle();
          if (m && !m.read_at) {
            const { data: sender } = await supabaseAdmin
              .from("profiles")
              .select("full_name")
              .eq("id", m.sender_id)
              .maybeSingle();
            const text = m.content.length > 120 ? `${m.content.slice(0, 117)}...` : m.content;
            target = {
              userId: m.receiver_id,
              title: `Ново съобщение от ${sender?.full_name || "Потребител"}`,
              body: text,
              link: m.conversation_id ? `/messages/${m.conversation_id}` : "/messages",
            };
          }
        }
        if (!target) return Response.json({ ok: true, sent: 0 });

        const { data: devices, error: devicesError } = await supabaseAdmin
          .from("push_devices")
          .select("token")
          .eq("user_id", target.userId)
          .limit(10);
        if (devicesError) {
          const { reportServerIssue } = await import("@/lib/monitoring/sentry.server");
          reportServerIssue({
            area: "api",
            action: "read push devices",
            error: new Error(devicesError.message),
            route: "/api/public/push/send",
          });
          return Response.json({ ok: false, error: "DEVICES_READ_FAILED" }, { status: 500 });
        }

        let sent = 0;
        const invalid: string[] = [];
        let failed = 0;
        for (const d of devices ?? []) {
          try {
            const result = await sendPush(sa, d.token, { title: target.title, body: target.body, link: target.link });
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
