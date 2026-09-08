import { AdminUserLink } from "@/components/admin/user-link";
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { toastError } from "@/lib/toast-error";
import { AdminCard, AdminPage, EmptyState } from "@/components/admin/admin-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  formatDateBg,
  getRefundEvidence,
  getRefundRequests,
  REFUND_REASON_BG,
  AUTO_RULE_BG,
  resolveRefund,
  type AdminRefundRequest,
  type RefundStatus,
} from "@/services/admin";

export const Route = createFileRoute("/admin/refunds")({
  head: () => ({
    meta: [
      { title: "Заявки за възстановяване | Админ" },
      { name: "description", content: "Одобрявай или отказвай заявки за възстановяване на кредити." },
      { property: "og:title", content: "Заявки за възстановяване" },
      { property: "og:description", content: "Модерация на заявки за възстановяване на кредити." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminRefunds,
});

const STATUS_BG: Record<string, string> = { pending: "Чакаща", approved: "Одобрена", rejected: "Отказана" };

function EvidenceCell({ requestId }: { requestId: string }) {
  const { data } = useQuery({
    queryKey: ["admin", "refund-evidence", requestId],
    queryFn: () => getRefundEvidence(requestId),
  });
  if (!data?.found) return <span className="text-xs text-slate-400">няма</span>;
  return (
    <div className="space-y-0.5 text-xs text-slate-600">
      <div>Статус на задачата: {data.task_status ?? "няма"}</div>
      <div>
        Съобщения: {data.messages_sent ?? 0} · Отговори: {data.owner_replies ?? 0}
      </div>
      <div>
        Доклади: {data.report_count ?? 0} · Дни от отключване: {data.days_since_unlock ?? 0}
      </div>
      <div>
        Заявки на потребителя: {data.user_refund_requests ?? 0} от {data.user_unlocks ?? 0} отключвания
      </div>
      {data.flagged ? (
        <Badge variant="outline" className="rounded border-rose-300 text-rose-700">
          Съмнително поведение
        </Badge>
      ) : null}
    </div>
  );
}

function AdminRefunds() {
  const [status, setStatus] = useState<RefundStatus | "all">("pending");
  const [view, setView] = useState<"manual" | "auto">("manual");
  const [target, setTarget] = useState<{ req: AdminRefundRequest; approve: boolean } | null>(null);
  const [note, setNote] = useState("");
  const qc = useQueryClient();

  const list = useQuery({ queryKey: ["admin", "refunds", status], queryFn: () => getRefundRequests(status) });

  const resolve = useMutation({
    mutationFn: () => resolveRefund({ requestId: target!.req.id, approve: target!.approve, note }),
    onSuccess: () => {
      toast.success(target?.approve ? "Кредитите са възстановени." : "Заявката е отказана.");
      setTarget(null);
      setNote("");
      void qc.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (e: unknown) => toastError(e, { title: "Действието не беше изпълнено" }),

  });

  const all = list.data ?? [];
  const rows = all.filter((r) => (view === "auto" ? r.resolution === "auto" : r.resolution !== "auto"));
  const autoCount = all.filter((r) => r.resolution === "auto").length;

  return (
    <AdminPage
      title="Заявки за възстановяване"
      description="Ясните случаи се одобряват автоматично от системата. Тук преглеждаш само тези за ръчна проверка."
      actions={
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-slate-200 bg-white p-0.5">
            <button
              type="button"
              onClick={() => setView("manual")}
              className={`rounded px-2.5 py-1 text-xs font-medium ${view === "manual" ? "bg-slate-900 text-white" : "text-slate-600"}`}
            >
              За проверка
            </button>
            <button
              type="button"
              onClick={() => setView("auto")}
              className={`rounded px-2.5 py-1 text-xs font-medium ${view === "auto" ? "bg-slate-900 text-white" : "text-slate-600"}`}
            >
              Автоматични ({autoCount})
            </button>
          </div>
        <Select value={status} onValueChange={(v) => setStatus(v as RefundStatus | "all")}>
          <SelectTrigger className="h-9 w-44 rounded-md bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Чакащи</SelectItem>
            <SelectItem value="approved">Одобрени</SelectItem>
            <SelectItem value="rejected">Отказани</SelectItem>
            <SelectItem value="all">Всички</SelectItem>
          </SelectContent>
        </Select>
        </div>
      }
    >
      <AdminCard>
        {list.isLoading ? (
          <EmptyState text="Зареждане…" />
        ) : rows.length === 0 ? (
          <EmptyState text="Няма заявки с този статус." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Потребител</TableHead>
                  <TableHead>Задача</TableHead>
                  <TableHead>Причина</TableHead>
                  <TableHead>Данни</TableHead>
                  <TableHead className="text-right">Кредити</TableHead>
                  <TableHead>Дата</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} className="align-top">
                    <TableCell className="font-medium text-slate-900"><AdminUserLink id={r.userId} name={r.userName} /></TableCell>
                    <TableCell className="max-w-[220px]">
                      {r.taskId ? (
                        <Link to="/task/$id" params={{ id: r.taskId }} className="text-slate-900 underline-offset-2 hover:underline">
                          {r.taskTitle}
                        </Link>
                      ) : (
                        r.taskTitle
                      )}
                    </TableCell>
                    <TableCell className="max-w-[280px]">
                      <div className="font-medium text-slate-800">{REFUND_REASON_BG[r.reason] ?? r.reason}</div>
                      {r.details ? <div className="mt-0.5 text-xs text-slate-500">{r.details}</div> : null}
                      {r.adminNote ? <div className="mt-1 text-xs italic text-slate-500">Бележка: {r.adminNote}</div> : null}
                      {r.autoRule ? (
                        <div className="mt-1 text-xs font-medium text-emerald-700">
                          Авто правило: {AUTO_RULE_BG[r.autoRule] ?? r.autoRule}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="max-w-[240px]">
                      <EvidenceCell requestId={r.id} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.credits}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-slate-500">{formatDateBg(r.createdAt)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={r.status === "pending" ? "secondary" : r.status === "approved" ? "default" : "outline"}
                        className="rounded"
                      >
                        {STATUS_BG[r.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {r.status === "pending" ? (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" className="rounded-md" onClick={() => { setTarget({ req: r, approve: true }); setNote(""); }}>
                            Одобри
                          </Button>
                          <Button size="sm" variant="outline" className="rounded-md" onClick={() => { setTarget({ req: r, approve: false }); setNote(""); }}>
                            Откажи
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">{r.resolvedAt ? formatDateBg(r.resolvedAt) : "няма"}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </AdminCard>

      <Dialog open={Boolean(target)} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{target?.approve ? "Одобри възстановяване" : "Откажи заявка"}</DialogTitle>
            <DialogDescription>
              {target?.approve
                ? `${target?.req.credits} кредита ще бъдат върнати на ${target?.req.userName}.`
                : "Задължителна вътрешна бележка защо заявката се отказва."}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            placeholder={target?.approve ? "Бележка (по избор)" : "Причина за отказа (вижда се само от екипа)"}
          />
          <DialogFooter>
            <Button variant="outline" className="rounded-md" onClick={() => setTarget(null)}>
              Отказ
            </Button>
            <Button
              className="rounded-md"
              disabled={resolve.isPending || (!target?.approve && note.trim().length === 0)}
              onClick={() => resolve.mutate()}
            >
              {target?.approve ? "Одобри и върни кредити" : "Откажи заявката"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
}
