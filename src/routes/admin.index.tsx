import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AdminCard, AdminPage } from "@/components/admin/admin-page";
import {
  getDailySeries,
  getDashboardStats,
  getPendingReports,
  getCronHealth,
  CRON_JOB_BG,
  REPORT_REASON_BG,
  formatDateBg,
} from "@/services/admin";
import { formatEur } from "@/services/credits";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Админ табло | Задачи" },
      { name: "description", content: "Ключови метрики за платформата: потребители, задачи, приходи и заявки." },
      { property: "og:title", content: "Админ табло" },
      { property: "og:description", content: "Ключови метрики за платформата." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminDashboard,
});

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <AdminCard className="p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</div>
      {hint ? <div className="mt-0.5 text-xs text-slate-500">{hint}</div> : null}
    </AdminCard>
  );
}

function AdminDashboard() {
  const stats = useQuery({ queryKey: ["admin", "stats"], queryFn: getDashboardStats });
  const series = useQuery({ queryKey: ["admin", "series"], queryFn: getDailySeries });
  const reports = useQuery({ queryKey: ["admin", "reports"], queryFn: getPendingReports });
  const cron = useQuery({ queryKey: ["admin", "cron"], queryFn: getCronHealth, refetchInterval: 60_000 });
  const staleJobs = (cron.data ?? []).filter((j) => j.stale);

  const s = stats.data;

  return (
    <AdminPage title="Табло" description="Обобщение за последните 30 дни.">
      {(s?.pending_refunds ?? 0) > 0 ||
      (s?.pending_reports ?? 0) > 0 ||
      (s?.moderation_pending ?? 0) > 0 ||
      (s?.tasks_pending ?? 0) > 0 ||
      (s?.contact_new ?? 0) > 0 ? (
        <div className="flex flex-wrap gap-2">
          {(s?.tasks_pending ?? 0) > 0 && (
            <Link
              to="/admin/moderation"
              className="rounded-md border border-orange-300 bg-orange-50 px-3 py-2 text-sm font-medium text-orange-900"
            >
              {s?.tasks_pending} задачи чакат одобрение преди публикуване
              {s?.tasks_pending_oldest ? ` · най-старата от ${formatDateBg(s.tasks_pending_oldest)}` : ""} →
            </Link>
          )}
          {(s?.contact_new ?? 0) > 0 && (
            <Link
              to="/admin/contact"
              className="rounded-md border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-900"
            >
              {s?.contact_new} нови съобщения от контактната форма →
            </Link>
          )}
          {(s?.moderation_pending ?? 0) > 0 && (
            <Link
              to="/admin/moderation"
              className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-900"
            >
              {s?.moderation_pending} чакащи в опашката за модерация
              {s?.moderation_oldest ? ` · най-старото от ${formatDateBg(s.moderation_oldest)}` : ""} →
            </Link>
          )}
          {(s?.pending_refunds ?? 0) > 0 && (
            <Link
              to="/admin/refunds"
              className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900"
            >
              {s?.pending_refunds} чакащи заявки за възстановяване →
            </Link>
          )}
          {(s?.pending_reports ?? 0) > 0 && (
            <Link
              to="/admin/tasks"
              className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-900"
            >
              {s?.pending_reports} чакащи доклада за задачи →
            </Link>
          )}
        </div>
      ) : null}

      {staleJobs.length > 0 && (
        <div className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-900">
          Внимание: {staleJobs.length === 1 ? "фонова задача не е изпълнявана" : "фонови задачи не са изпълнявани"} успешно
          повече от 2 часа.
        </div>
      )}

      {(s?.rule_engine_errors_7d ?? 0) > 0 && (
        <div className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-900">
          Автоматичната оценка на възстановявания е дала грешка {s?.rule_engine_errors_7d} пъти през последните 7 дни.
          Заявките са изпратени за ръчен преглед.
        </div>
      )}

      {(s?.credit_mismatches ?? 0) > 0 && (
        <div className="rounded-md border border-red-400 bg-red-50 px-3 py-2 text-sm font-medium text-red-900">
          Несъответствие в кредитите при {s?.credit_mismatches}{" "}
          {s?.credit_mismatches === 1 ? "потребител" : "потребители"}: балансът не отговаря на историята на трансакциите.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        <Stat label="Потребители" value={String(s?.total_users ?? "няма")} hint={`+${s?.new_users_7d ?? 0} за 7 дни · +${s?.new_users_30d ?? 0} за 30 дни`} />
        <Stat label="Задачи" value={String(s?.total_tasks ?? "няма")} hint={`${s?.active_tasks ?? 0} активни`} />
        <Stat label="Нови задачи" value={String(s?.tasks_7d ?? "няма")} hint={`за 7 дни · ${s?.tasks_30d ?? 0} за 30 дни`} />
        <Stat label="Отключвания" value={String(s?.unlocks_total ?? "няма")} />
        <Stat label="Продадени кредити" value={String(s?.credits_sold ?? "няма")} />
        <Stat label="Приходи (общо)" value={s ? formatEur(Number(s.revenue_total)) : "няма"} />
        <Stat label="Приходи 7 дни" value={s ? formatEur(Number(s.revenue_7d)) : "няма"} />
        <Stat label="Приходи 30 дни" value={s ? formatEur(Number(s.revenue_30d)) : "няма"} />
        <Stat
          label="Възстановявания 30 дни"
          value={String((s?.auto_refunds_30d ?? 0) + (s?.manual_refunds_30d ?? 0))}
          hint={`${s?.auto_refunds_30d ?? 0} автоматични · ${s?.manual_refunds_30d ?? 0} ръчни`}
        />
        <Stat
          label="Маркирани профили"
          value={String(s?.flagged_users ?? 0)}
          hint="Висок дял заявки за връщане"
        />
        <Stat
          label="Опашка за модерация"
          value={String(s?.moderation_pending ?? 0)}
          hint={s?.moderation_oldest ? `най-старото от ${formatDateBg(s.moderation_oldest)}` : "няма изчакващи"}
        />
        <Stat
          label="Задачи за одобрение"
          value={String(s?.tasks_pending ?? 0)}
          hint={s?.tasks_pending_oldest ? `най-старата от ${formatDateBg(s.tasks_pending_oldest)}` : "няма изчакващи"}
        />
        <Stat
          label="Нови съобщения"
          value={String(s?.contact_new ?? 0)}
          hint="Контактна форма"
        />
        <Stat
          label="Нарушения 30 дни"
          value={String(s?.violations_30d ?? 0)}
          hint="Автоматични и ръчни санкции"
        />
      </div>

      <AdminCard className="p-4">
        <div className="text-sm font-semibold text-slate-900">Регистрации и задачи (30 дни)</div>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series.data ?? []} margin={{ left: -20, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 11, fill: "#64748b" }}
                tickFormatter={(v: string) => v.slice(5)}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} />
              <Tooltip labelFormatter={(v) => String(v)} />
              <Line type="monotone" dataKey="signups" name="Регистрации" stroke="#0f172a" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="tasks" name="Задачи" stroke="#f97316" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </AdminCard>

      <AdminCard>
        <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">
          Планировчик (фонови задачи)
        </div>
        <ul className="divide-y divide-slate-200">
          {(cron.data ?? []).map((j) => (
            <li key={j.job_name} className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm">
              <span className="font-medium text-slate-900">{CRON_JOB_BG[j.job_name] ?? j.job_name}</span>
              {j.stale ? (
                <Badge className="rounded bg-rose-100 text-rose-900 hover:bg-rose-100">Не е изпълнявана &gt; 2 ч.</Badge>
              ) : (
                <Badge className="rounded bg-emerald-100 text-emerald-900 hover:bg-emerald-100">Нормално</Badge>
              )}
              {j.last_error ? <span className="text-xs text-rose-700">Грешка: {j.last_error}</span> : null}
              <span className="ml-auto text-xs text-slate-500">
                {j.last_success
                  ? `Последно успешно: ${formatDateBg(j.last_success)} · ${j.rows_processed ?? 0} обработени`
                  : "Няма успешно изпълнение"}
              </span>
            </li>
          ))}
          {(cron.data ?? []).length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-slate-500">Няма данни за фонови задачи.</li>
          )}
        </ul>
      </AdminCard>

      <AdminCard>
        <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">
          Последни доклади
        </div>
        {(reports.data ?? []).length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-slate-500">Няма чакащи доклади.</div>
        ) : (
          <ul className="divide-y divide-slate-200">
            {(reports.data ?? []).slice(0, 6).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm">
                <Badge variant="secondary" className="rounded">{REPORT_REASON_BG[r.reason] ?? r.reason}</Badge>
                <Link to="/task/$id" params={{ id: r.taskId }} className="font-medium text-slate-900 underline-offset-2 hover:underline">
                  {r.taskTitle}
                </Link>
                <span className="text-slate-500">от {r.reporterName}</span>
                <span className="ml-auto text-xs text-slate-400">{formatDateBg(r.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </AdminCard>
    </AdminPage>
  );
}
