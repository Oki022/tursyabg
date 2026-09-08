import { AdminUserLink } from "@/components/admin/user-link";
import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { toastError } from "@/lib/toast-error";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { AdminCard, AdminPage, EmptyState } from "@/components/admin/admin-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { categories, cities, getCategory } from "@/lib/mock-data";
import {
  activateTask,
  deactivateTask,
  deleteTask,
  formatDateBg,
  getAdminTasks,
  getPendingReports,
  getTaskDeletePreview,
  REPORT_REASON_BG,
  setReportStatus,
  updateTaskCategory,
  type AdminTask,
} from "@/services/admin";

export const Route = createFileRoute("/admin/tasks")({
  head: () => ({
    meta: [
      { title: "Модерация на задачи | Админ" },
      { name: "description", content: "Преглед, деактивиране и изтриване на задачи, докладвани от потребители." },
      { property: "og:title", content: "Модерация на задачи" },
      { property: "og:description", content: "Опашка за модерация на задачи." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminTasks,
});

const STATUS_BG: Record<string, string> = {
  active: "Активна",
  pending: "Изчакваща",
  pending_payment: "Чака плащане",
  inactive: "Неактивна",
};

const PAGE_SIZE = 10;

/** Deletion always requires an explicit reason; only `fraud` triggers automatic refunds. */
const DELETE_REASONS: { key: string; label: string; fraudulent: boolean }[] = [
  { key: "fraud", label: "Измамна задача (кредитите се връщат)", fraudulent: true },
  { key: "spam", label: "Спам", fraudulent: false },
  { key: "inappropriate", label: "Неподходящо съдържание", fraudulent: false },
  { key: "duplicate", label: "Дублирана задача", fraudulent: false },
  { key: "owner_request", label: "По искане на възложителя", fraudulent: false },
  { key: "other", label: "Друга причина", fraudulent: false },
];

function AdminTasks() {
  const qc = useQueryClient();
  const [filters, setFilters] = useState({ status: "all", category: "all", city: "all", days: "all", reportedOnly: false });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [deactivateTarget, setDeactivateTarget] = useState<AdminTask | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminTask | null>(null);
  const [reason, setReason] = useState("");
  const [deleteReasonKey, setDeleteReasonKey] = useState("");
  const [deleteNote, setDeleteNote] = useState("");

  const deleteReason = DELETE_REASONS.find((r) => r.key === deleteReasonKey);
  const fraudulent = deleteReason?.fraudulent ?? false;

  const preview = useQuery({
    queryKey: ["admin", "delete-preview", deleteTarget?.id],
    queryFn: () => getTaskDeletePreview(deleteTarget!.id),
    enabled: Boolean(deleteTarget),
  });

  const list = useQuery({ queryKey: ["admin", "tasks", filters], queryFn: () => getAdminTasks(filters) });
  const reports = useQuery({ queryKey: ["admin", "reports"], queryFn: getPendingReports });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = list.data ?? [];
    return q ? rows.filter((t) => t.title.toLowerCase().includes(q) || t.authorName.toLowerCase().includes(q)) : rows;
  }, [list.data, search]);

  const pageRows = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const invalidate = () => void qc.invalidateQueries({ queryKey: ["admin"] });

  const mDeactivate = useMutation({
    mutationFn: () => deactivateTask(deactivateTarget!.id, reason),
    onSuccess: () => {
      toast.success("Задачата е деактивирана.");
      setDeactivateTarget(null);
      setReason("");
      invalidate();
    },
    onError: (e: unknown) => toastError(e, { title: "Действието не беше изпълнено" }),
  });

  const mDelete = useMutation({
    mutationFn: () =>
      deleteTask(
        deleteTarget!.id,
        [deleteReason?.label ?? "", deleteNote.trim()].filter(Boolean).join(", "),
        fraudulent,
      ),
    onSuccess: (res) => {
      toast.success(
        res.refundedUsers > 0
          ? `Задачата е изтрита. Върнати са ${res.refundedCredits} кредита на ${res.refundedUsers} потребители.`
          : "Задачата е изтрита.",
      );
      setDeleteTarget(null);
      setDeleteReasonKey("");
      setDeleteNote("");
      invalidate();
    },
    onError: (e: unknown) => toastError(e, { title: "Изтриването не беше изпълнено" }),
  });

  const mActivate = useMutation({
    mutationFn: (id: string) => activateTask(id),
    onSuccess: () => { toast.success("Задачата е активирана."); invalidate(); },
    onError: (e: unknown) => toastError(e, { title: "Действието не беше изпълнено" }),
  });

  const mCategory = useMutation({
    mutationFn: (v: { id: string; category: string }) => updateTaskCategory(v.id, v.category),
    onSuccess: () => { toast.success("Категорията е обновена."); invalidate(); },
    onError: (e: unknown) => toastError(e, { title: "Действието не беше изпълнено" }),
  });

  const mReport = useMutation({
    mutationFn: (v: { id: string; status: "reviewed" | "dismissed" }) => setReportStatus(v.id, v.status),
    onSuccess: () => invalidate(),
  });

  return (
    <AdminPage title="Модерация на задачи" description="Филтрирай, прегледай и модерирай публикуваните задачи.">
      {(reports.data ?? []).length > 0 && (
        <AdminCard className="border-rose-200">
          <div className="flex items-center gap-2 border-b border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-900">
            <AlertTriangle className="h-4 w-4" /> Чакащи доклади ({reports.data?.length})
          </div>
          <ul className="divide-y divide-slate-200">
            {(reports.data ?? []).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm">
                <Badge variant="secondary" className="rounded">{REPORT_REASON_BG[r.reason] ?? r.reason}</Badge>
                <Link to="/task/$id" params={{ id: r.taskId }} className="font-medium text-slate-900 hover:underline">
                  {r.taskTitle}
                </Link>
                {r.details ? <span className="text-slate-500"> {r.details}</span> : null}
                <span className="text-xs text-slate-400">от {r.reporterName} · {formatDateBg(r.createdAt)}</span>
                <div className="ml-auto flex gap-2">
                  <Button size="sm" variant="outline" className="rounded-md" onClick={() => mReport.mutate({ id: r.id, status: "reviewed" })}>
                    Прегледан
                  </Button>
                  <Button size="sm" variant="ghost" className="rounded-md" onClick={() => mReport.mutate({ id: r.id, status: "dismissed" })}>
                    Отхвърли
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </AdminCard>
      )}

      <AdminCard className="flex flex-wrap items-center gap-2 p-3">
        <Input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          placeholder="Търси по заглавие или автор"
          className="h-9 w-56 rounded-md"
        />
        <Select value={filters.status} onValueChange={(v) => { setFilters((f) => ({ ...f, status: v })); setPage(0); }}>
          <SelectTrigger className="h-9 w-40 rounded-md"><SelectValue placeholder="Статус" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Всички статуси</SelectItem>
            {Object.entries(STATUS_BG).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.category} onValueChange={(v) => { setFilters((f) => ({ ...f, category: v })); setPage(0); }}>
          <SelectTrigger className="h-9 w-44 rounded-md"><SelectValue placeholder="Категория" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Всички категории</SelectItem>
            {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.city} onValueChange={(v) => { setFilters((f) => ({ ...f, city: v })); setPage(0); }}>
          <SelectTrigger className="h-9 w-36 rounded-md"><SelectValue placeholder="Град" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Всички градове</SelectItem>
            {cities.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.days} onValueChange={(v) => { setFilters((f) => ({ ...f, days: v })); setPage(0); }}>
          <SelectTrigger className="h-9 w-36 rounded-md"><SelectValue placeholder="Период" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Всички дати</SelectItem>
            <SelectItem value="1">Последните 24 ч.</SelectItem>
            <SelectItem value="7">Последните 7 дни</SelectItem>
            <SelectItem value="30">Последните 30 дни</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant={filters.reportedOnly ? "default" : "outline"}
          size="sm"
          className="h-9 rounded-md"
          onClick={() => { setFilters((f) => ({ ...f, reportedOnly: !f.reportedOnly })); setPage(0); }}
        >
          Само докладвани
        </Button>
      </AdminCard>

      {list.isLoading ? (
        <AdminCard><EmptyState text="Зареждане…" /></AdminCard>
      ) : pageRows.length === 0 ? (
        <AdminCard><EmptyState text="Няма задачи по тези филтри." /></AdminCard>
      ) : (
        <div className="space-y-3">
          {pageRows.map((t) => (
            <AdminCard key={t.id} className="p-4">
              <div className="flex flex-wrap items-start gap-4">
                {t.images[0] ? (
                  <img src={t.images[0]} alt={t.title} className="h-24 w-32 rounded-md object-cover" loading="lazy" />
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900">{t.title}</span>
                    <Badge variant="outline" className="rounded">{STATUS_BG[t.status] ?? t.status}</Badge>
                    <Badge variant="secondary" className="rounded">{getCategory(t.category).name}</Badge>
                    {t.reportCount > 0 && (
                      <Badge className="rounded bg-rose-600">{t.reportCount} доклада</Badge>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    <AdminUserLink id={t.userId} name={t.authorName} /> · {t.budget} € · {[t.city, t.neighborhood].filter(Boolean).join(", ") || "няма"} · {formatDateBg(t.createdAt)}
                  </div>
                  <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{t.description}</p>
                  {t.images.length > 1 && (
                    <div className="mt-2 flex gap-2 overflow-x-auto">
                      {t.images.slice(1).map((src) => (
                        <img key={src} src={src} alt="" className="h-16 w-20 rounded object-cover" loading="lazy" />
                      ))}
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button asChild size="sm" variant="outline" className="h-8 gap-1 rounded-md">
                      <Link to="/task/$id" params={{ id: t.id }}>
                        <ExternalLink className="h-3.5 w-3.5" /> Виж
                      </Link>
                    </Button>
                    {t.status === "active" ? (
                      <Button size="sm" variant="outline" className="h-8 rounded-md" onClick={() => { setDeactivateTarget(t); setReason(""); }}>
                        Деактивирай
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" className="h-8 rounded-md" onClick={() => mActivate.mutate(t.id)}>
                        Активирай
                      </Button>
                    )}
                    <Select value={t.category} onValueChange={(v) => mCategory.mutate({ id: t.id, category: v })}>
                      <SelectTrigger className="h-8 w-44 rounded-md text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button size="sm" variant="ghost" className="h-8 rounded-md text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => { setDeleteTarget(t); setReason(""); }}>
                      Изтрий
                    </Button>
                  </div>
                </div>
              </div>
            </AdminCard>
          ))}

          <div className="flex items-center justify-between text-sm text-slate-600">
            <span>{filtered.length} задачи</span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="rounded-md" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                Назад
              </Button>
              <span>{page + 1} / {pages}</span>
              <Button size="sm" variant="outline" className="rounded-md" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>
                Напред
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={Boolean(deactivateTarget)} onOpenChange={(o) => !o && setDeactivateTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Деактивирай задачата</DialogTitle>
            <DialogDescription>Задачата ще изчезне от публичния списък. Причината се записва в одит лога.</DialogDescription>
          </DialogHeader>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Причина" />
          <DialogFooter>
            <Button variant="outline" className="rounded-md" onClick={() => setDeactivateTarget(null)}>Отказ</Button>
            <Button className="rounded-md" disabled={!reason.trim() || mDeactivate.isPending} onClick={() => mDeactivate.mutate()}>
              Деактивирай
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(o) => {
          if (!o) {
            setDeleteTarget(null);
            setDeleteReasonKey("");
            setDeleteNote("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Изтрий задачата</DialogTitle>
            <DialogDescription>
              Действието е необратимо. Причината се записва в одит лога.
            </DialogDescription>
          </DialogHeader>
          <Select value={deleteReasonKey} onValueChange={setDeleteReasonKey}>
            <SelectTrigger className="rounded-md">
              <SelectValue placeholder="Избери причина за изтриване" />
            </SelectTrigger>
            <SelectContent>
              {DELETE_REASONS.map((r) => (
                <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            value={deleteNote}
            onChange={(e) => setDeleteNote(e.target.value)}
            rows={3}
            placeholder="Вътрешна бележка (по желание)"
          />
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            Контактът е отключен от <strong>{preview.data?.unlockers ?? 0}</strong> потребители
            {" "}(общо <strong>{preview.data?.credits ?? 0}</strong> кредита).
          </div>
          {fraudulent ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Задачата ще бъде премахната като измамна: {preview.data?.credits ?? 0} кредита ще бъдат върнати
              автоматично на {preview.data?.unlockers ?? 0} потребители и те ще получат известие.
            </div>
          ) : (
            <div className="rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-600">
              При тази причина кредити не се връщат. Ако задачата е измамна, избери „Измамна задача“.
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" className="rounded-md" onClick={() => setDeleteTarget(null)}>Отказ</Button>
            <Button
              variant="destructive"
              className="rounded-md"
              disabled={!deleteReasonKey || mDelete.isPending}
              onClick={() => mDelete.mutate()}
            >
              {fraudulent ? "Изтрий и върни кредитите" : "Изтрий"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
}
