import { createFileRoute } from "@tanstack/react-router";
import { absoluteUrl } from "@/lib/brand";
import { asBudgetRange, formatTaskBudget } from "@/lib/budget-range";
import { emailLayout, escapeHtml } from "@/lib/email-layout";
import { getCategory } from "@/lib/mock-data";
import { municipalityLabel } from "@/lib/locations";

/**
 * Известия за нови задачи по запазените търсения.
 * Извиква се на всеки 30 минути от планираната задача в базата
 * (public.call_task_alerts) с таен ключ в заглавната част. Работи само между
 * 07:00 и 22:00 българско време. При всяко пускане: известие в приложението
 * за новите съвпадения; имейл най-много веднъж на 3 часа на потребител.
 * Не връща лични данни.
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

/** Where "see all" leads: the page that lists exactly the user's matched tasks. */
const ALERTS_PATH = "/alerts";

/** 07:00-22:00 in Sofia (handles summer and winter time). */
function withinSendingHours(now: Date): boolean {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Sofia",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0") % 24;
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  // The 22:00 run still counts; a few minutes of slack for a late cron start.
  return (hour >= 7 && hour < 22) || (hour === 22 && minute < 10);
}

function plural(count: number): string {
  return count === 1 ? "1 нова задача" : `${count} нови задачи`;
}

function taskCard(t: DigestTask): string {
  const url = absoluteUrl(`/task/${t.id}`);
  const place = t.city ? municipalityLabel(t.city) : "България";
  const budget = formatTaskBudget(Number(t.budget), asBudgetRange(t.budget_range));
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 12px;border:1px solid #e2e8f0;border-radius:12px">
      <tr><td style="padding:16px 18px">
        <span style="display:inline-block;padding:3px 10px;border-radius:999px;background:#FFF1E8;color:#C2410C;font-size:12px;font-weight:bold">${escapeHtml(getCategory(t.category).name)}</span>
        <div style="margin:10px 0 6px">
          <a href="${url}" style="color:#0f172a;font-size:17px;font-weight:bold;line-height:1.35;text-decoration:none">${escapeHtml(t.title)}</a>
        </div>
        <div style="color:#475569;font-size:14px;line-height:1.5">📍 ${escapeHtml(place)} &nbsp;·&nbsp; 💶 ${escapeHtml(budget)}</div>
        <div style="margin-top:10px"><a href="${url}" style="color:#EC305A;font-size:14px;font-weight:bold;text-decoration:none">Виж задачата →</a></div>
      </td></tr>
    </table>`;
}

function digestEmail(name: string | null, count: number, tasks: DigestTask[]): string {
  const first = name?.trim().split(/\s+/)[0];
  const hello = first ? `Здравей, ${escapeHtml(first)}!` : "Здравей!";
  const listed = tasks.slice(0, MAX_LISTED);
  const more =
    count > MAX_LISTED
      ? `<p style="margin:4px 0 0;color:#475569;font-size:14px">…и още ${count - MAX_LISTED} в сайта.</p>`
      : "";

  return emailLayout({
    preheader: listed
      .slice(0, 2)
      .map((t) => t.title)
      .join(" · "),
    title: `${plural(count)} за теб`,
    introHtml: `
      <p style="margin:0 0 10px">${hello}</p>
      <p style="margin:0">${count === 1 ? "Появи се нова задача" : `Появиха се ${count} нови задачи`} по известията, които си включил.
      Контактът на всеки клиент могат да отключат най-много 5 изпълнители, затова е добре да се свържеш навреме.</p>`,
    bodyHtml: listed.map(taskCard).join("") + more,
    cta:
      count === 1 && listed[0]
        ? { label: "Отвори задачата", href: absoluteUrl(`/task/${listed[0].id}`) }
        : { label: "Виж всички нови задачи", href: absoluteUrl(ALERTS_PATH) },
    footerHtml: `
      Получаваш този имейл, защото си включил известия за нови задачи в ТърсяБГ.
      Изпращаме имейл най-много веднъж на 3 часа и само ако има нещо ново.<br>
      <a href="${absoluteUrl(ALERTS_PATH)}" style="color:#64748b">Всички задачи за теб</a>
      &nbsp;·&nbsp; <a href="${absoluteUrl("/settings/notifications")}" style="color:#64748b">Управлявай известията</a>
      &nbsp;·&nbsp; <a href="${absoluteUrl("/faq")}" style="color:#64748b">Помощ</a>`,
  });
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

        if (!withinSendingHours(new Date())) {
          return Response.json({ ok: true, skipped: "outside 07:00-22:00 Sofia" });
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
          // 1) In-app notifications for everything new (all in the database).
          const { data: notified, error: inAppError } = await supabaseAdmin.rpc("task_alert_push_inapp");
          if (inAppError) throw new Error(inAppError.message);
          users = notified ?? 0;

          // 2) E-mails: only users without an e-mail in the last 3 hours.
          if (apiKey) {
            const { data: batch, error } = await supabaseAdmin.rpc("task_alert_email_batch", { _limit: 200 });
            if (error) throw new Error(error.message);

            for (const row of batch ?? []) {
              const tasks = (Array.isArray(row.tasks) ? row.tasks : []) as unknown as DigestTask[];
              const count = row.task_count;
              if (!row.email || count < 1) continue;
              try {
                const res = await fetch("https://api.resend.com/emails", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
                  body: JSON.stringify({
                    from: FROM,
                    to: [row.email],
                    subject: `${plural(count)} за теб в ТърсяБГ`,
                    html: digestEmail(row.full_name, count, tasks),
                    headers: { "List-Unsubscribe": `<${absoluteUrl("/settings/notifications")}>` },
                  }),
                });
                // Only a delivered e-mail is marked, so a failed one is retried next run.
                if (res.ok) {
                  await supabaseAdmin.rpc("task_alert_mark_emailed", {
                    _user_id: row.user_id,
                    _until: row.until_at,
                  });
                  emails += 1;
                }
              } catch {
                // Retried on the next run.
              }
            }
          }
        } catch (e) {
          failure = e instanceof Error ? e.message : String(e);
          const { reportServerIssue } = await import("@/lib/monitoring/sentry.server");
          reportServerIssue({ area: "cron", action: "send task alerts", error: e });
        }

        if (runRow?.id) {
          await supabaseAdmin
            .from("cron_runs")
            .update({
              finished_at: new Date().toISOString(),
              rows_processed: users + emails,
              error: failure,
            })
            .eq("id", runRow.id);
        }

        return Response.json({ ok: failure === null, users, emails });
      },
    },
  },
});
