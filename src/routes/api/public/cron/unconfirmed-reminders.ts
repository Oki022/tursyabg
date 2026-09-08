import { createFileRoute } from "@tanstack/react-router";

/**
 * Напомнящи имейли на 7-ия и 25-ия ден към профили, които още не са
 * потвърдили имейла си. Извиква се от планираната задача в базата, която
 * подава таен ключ в заглавната част. Не връща лични данни.
 */
export const Route = createFileRoute("/api/public/cron/unconfirmed-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const provided = request.headers.get("x-cron-key") ?? "";
        const { data: expected } = await supabaseAdmin
          .from("cron_secrets")
          .select("token")
          .eq("name", "unconfirmed_reminders")
          .maybeSingle();

        if (!expected?.token || provided !== expected.token) {
          return new Response("Unauthorized", { status: 401 });
        }

        const started = new Date().toISOString();
        const { data: runRow } = await supabaseAdmin
          .from("cron_runs")
          .insert({ job_name: "unconfirmed_reminders", started_at: started })
          .select("id")
          .single();

        let sent = 0;
        let failure: string | null = null;
        try {
          const { data: batch, error } = await supabaseAdmin.rpc("unconfirmed_reminder_batch", { _limit: 100 });
          if (error) throw new Error(error.message);

          for (const row of (batch ?? []) as { user_id: string; email: string; stage: number }[]) {
            const { error: mailError } = await supabaseAdmin.auth.resend({
              type: "signup",
              email: row.email,
            });
            if (mailError) continue;
            await supabaseAdmin.rpc("mark_unconfirmed_reminder", {
              _user_id: row.user_id,
              _email: row.email,
              _stage: row.stage,
            });
            sent += 1;
          }
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
