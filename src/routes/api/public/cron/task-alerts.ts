import { createFileRoute } from "@tanstack/react-router";
import { absoluteUrl } from "@/lib/brand";
import { asBudgetRange, formatTaskBudget } from "@/lib/budget-range";
import { getCategory } from "@/lib/mock-data";
import { municipalityLabel } from "@/lib/locations";

/**
 * Сутрешно известие за нови задачи по запазените търсения.
 * Извиква се от планираната задача в базата (public.call_task_alerts) с таен
 * ключ в заглавната част. За всеки потребител с нови съвпадения: едно
 * известие в приложението и един имейл. Не връща лични данни.
 */

const FROM = "ТърсяБГ <noreply@tursya.bg>";
const MAX_LISTED = 8;

type DigestTask = {
  id: string;
  title: string;
  category: string;
  city: string | null;
  budget: number;
  budget_range: string | null;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function subjectFor(count: number): string {
  return count === 1 ? "1 нова задача за теб в ТърсяБГ" : `${count} нови задачи за теб в ТърсяБГ`;
}

function digestHtml(name: string | null, count: number, tasks: DigestTask[]): string {
  const hello = name ? `Здравей, ${escapeHtml(name.split(" ")[0] ?? name)}!` : "Здравей!";
  const rows = tasks
    .slice(0, MAX_LISTED)
    .map((t) => {
      const meta = [
        getCategory(t.category).name,
        t.city ? municipalityLabel(t.city) : null,
        formatTaskBudget(Number(t.budget), asBudgetRange(t.budget_range)),
      ]
        .filter(Boolean)
        .join(" · ");
      return `
        <tr><td style="padding:12px 0;border-bottom:1px solid #e2e8f0">
          <a href="${absoluteUrl(`/task/${t.id}`)}" style="color:#0f172a;font-weight:600;text-decoration:none;font-size:15px">${escapeHtml(t.title)}</a>
          <div style="color:#64748b;font-size:13px;margin-top:4px">${escapeHtml(meta)}</div>
        </td></tr>`;
    })
    .join("");
  const more =
    count > MAX_LISTED
      ? `<p style="margin:16px 0 0;color:#475569">…и още ${count - MAX_LISTED}.</p>`
      : "";

  return `
  <div style="font-family:Arial,sans-serif;font-size:14px;color:#0f172a;max-width:560px;margin:0 auto">
    <p style="margin:0 0 8px">${hello}</p>
    <p style="margin:0 0 16px">${count === 1 ? "Има нова задача" : `Има ${count} нови задачи`} по търсенията, за които си включил известия.</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${rows}</table>
    ${more}
    <p style="margin:24px 0">
      <a href="${absoluteUrl("/tasks")}" style="background:#F94144;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:600">Виж всички задачи</a>
    </p>
    <p style="margin:24px 0 0;color:#94a3b8;font-size:12px">
      Получаваш този имейл, защото си включил известия за нови задачи в ТърсяБГ.
      Можеш да ги изключиш от <a href="${absoluteUrl("/settings/notifications")}" style="color:#94a3b8">Настройки → Нотификации</a>.
    </p>
  </div>`;
}

export const Route = createFileRoute("/api/public/cron/task-alerts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const provided = request.headers.get("x-cron-key") ?? "";
        const { data: expected } = await supabaseAdmin
          .from("cron_secrets")
          .select("token")
          .eq("name", "task_alerts")
          .maybeSingle();

        if (!expected?.token || provided !== expected.token) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { data: runRow } = await supabaseAdmin
          .from("cron_runs")
          .insert({ job_name: "task_alerts", started_at: new Date().toISOString() })
          .select("id")
          .single();

        const apiKey = process.env["RESEND_API_KEY"];
        let users = 0;
        let emails = 0;
        let failure: string | null = null;

        try {
          const { data: batch, error } = await supabaseAdmin.rpc("task_alert_digest_batch", { _limit: 200 });
          if (error) throw new Error(error.message);

          for (const row of batch ?? []) {
            const tasks = (Array.isArray(row.tasks) ? row.tasks : []) as unknown as DigestTask[];
            const count = row.task_count;

            if (apiKey && row.email) {
              try {
                const res = await fetch("https://api.resend.com/emails", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
                  body: JSON.stringify({
                    from: FROM,
                    to: [row.email],
                    subject: subjectFor(count),
                    html: digestHtml(row.full_name, count, tasks),
                    headers: { "List-Unsubscribe": `<${absoluteUrl("/settings/notifications")}>` },
                  }),
                });
                if (res.ok) emails += 1;
              } catch {
                // The in-app notification below still goes out.
              }
            }

            // Marks the hits as sent (so nobody gets the same task twice) and
            // adds the in-app notification.
            await supabaseAdmin.rpc("task_alert_finish", { _user_id: row.user_id, _count: count });
            users += 1;
          }
        } catch (e) {
          failure = e instanceof Error ? e.message : String(e);
          const { reportServerIssue } = await import("@/lib/monitoring/sentry.server");
          reportServerIssue({ area: "cron", action: "send task alert digests", error: e });
        }

        if (runRow?.id) {
          await supabaseAdmin
            .from("cron_runs")
            .update({
              finished_at: new Date().toISOString(),
              rows_processed: users,
              error: failure,
            })
            .eq("id", runRow.id);
        }

        return Response.json({ ok: failure === null, users, emails });
      },
    },
  },
});
