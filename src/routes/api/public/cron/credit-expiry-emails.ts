import { createFileRoute } from "@tanstack/react-router";
import type { Notice } from "@/lib/credit-expiry-email.server";

/**
 * Warning e-mails 7 days before points expire ("Точките ти изтичат").
 * Called by the nightly database job run_credit_expiry() right after it has
 * expired old points and created the warnings (bell + phone). Protected by the
 * x-cron-key header. Returns no personal data.
 */

export const Route = createFileRoute("/api/public/cron/credit-expiry-emails")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const provided = request.headers.get("x-cron-key") ?? "";
        const { data: expected } = await supabaseAdmin
          .from("cron_secrets")
          .select("token")
          .eq("name", "credit_expiry")
          .maybeSingle();
        if (!expected?.token || provided !== expected.token) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { data: runRow } = await supabaseAdmin
          .from("cron_runs")
          .insert({ job_name: "credit_expiry_emails", started_at: new Date().toISOString() })
          .select("id")
          .single();

        let sent = 0;
        let failure: string | null = null;
        try {
          const { creditExpiryEmail } = await import("@/lib/credit-expiry-email.server");
          const apiKey = process.env["RESEND_API_KEY"];
          if (!apiKey) throw new Error("RESEND_API_KEY missing");

          const { data: batch, error } = await supabaseAdmin.rpc("credit_expiry_email_batch", { _limit: 200 });
          if (error) throw new Error(error.message);

          const done: string[] = [];
          for (const n of (batch ?? []) as Notice[]) {
            const { subject, html } = creditExpiryEmail(n);
            const res = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
              body: JSON.stringify({ from: "ТърсяБГ <noreply@tursya.bg>", to: [n.email], subject, html }),
            });
            // Failed ones stay in the batch and are tried again on the next nights.
            if (res.ok) done.push(n.notice_id);
          }
          if (done.length > 0) {
            const { error: markError } = await supabaseAdmin.rpc("mark_credit_expiry_emailed", { _ids: done });
            if (markError) throw new Error(markError.message);
          }
          sent = done.length;
        } catch (e) {
          failure = e instanceof Error ? e.message : String(e);
        }

        if (runRow?.id) {
          await supabaseAdmin
            .from("cron_runs")
            .update({ finished_at: new Date().toISOString(), rows_processed: sent, error: failure })
            .eq("id", runRow.id);
        }

        return Response.json({ ok: failure === null, sent });
      },
    },
  },
});
