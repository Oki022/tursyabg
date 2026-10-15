import { createFileRoute } from "@tanstack/react-router";

/**
 * Cron watchdog: scans the last hour of scheduled-job runs and forwards
 * failures to Sentry as high-priority alerts. Called hourly by pg_cron
 * (public.call_cron_check) with a secret key in the x-cron-key header, so
 * outsiders cannot trigger it and flood Sentry. Returns no personal data.
 */
export const Route = createFileRoute("/api/public/monitoring/cron-check")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const provided = request.headers.get("x-cron-key") ?? "";
        const { data: expected } = await supabaseAdmin
          .from("cron_secrets")
          .select("token")
          .eq("name", "cron_check")
          .maybeSingle();
        if (!expected?.token || provided !== expected.token) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { reportServerIssue } = await import("@/lib/monitoring/sentry.server");

        const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const { data, error } = await supabaseAdmin
          .from("cron_runs")
          .select("id, job_name, error, started_at, finished_at, rows_processed")
          .gte("started_at", since)
          .not("error", "is", null)
          .order("started_at", { ascending: false })
          .limit(50);

        if (error) {
          reportServerIssue({
            area: "cron",
            action: "read cron run history",
            error: new Error(error.message),
            route: "/api/public/monitoring/cron-check",
          });
          return Response.json({ ok: false }, { status: 500 });
        }

        const failures = data ?? [];
        for (const run of failures) {
          reportServerIssue({
            area: "cron",
            action: `cron job failed: ${run.job_name}`,
            error: new Error(String(run.error ?? "cron failure")),
            route: "/api/public/monitoring/cron-check",
            extra: {
              job_name: run.job_name,
              started_at: run.started_at,
              finished_at: run.finished_at,
              rows_processed: run.rows_processed,
            },
          });
        }

        return Response.json({ ok: true, checked_since: since, failures: failures.length });
      },
    },
  },
});
