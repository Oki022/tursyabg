import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { AdminCard, AdminPage, EmptyState } from "@/components/admin/admin-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Stars } from "@/components/reviews/stars";
import { getAdminReviews, getReviewFlags, hideReview } from "@/services/reviews-admin";
import { formatReviewDate } from "@/services/reviews";

export const Route = createFileRoute("/admin/reviews")({
  head: () => ({
    meta: [
      { title: "Отзиви | Админ" },
      { name: "description", content: "Модерация на отзиви: докладвани, ниски оценки и подозрителни модели." },
      { property: "og:title", content: "Отзиви | Админ" },
      { property: "og:description", content: "Скриване на отзиви с логната причина и сигнали за злоупотреба." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminReviewsPage,
});

const FILTERS = [
  { value: "recent", label: "Последни" },
  { value: "reported", label: "Докладвани" },
  { value: "low", label: "Ниска оценка" },
  { value: "hidden", label: "Скрити" },
];

function AdminReviewsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("recent");
  const [hideFor, setHideFor] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const reviews = useQuery({ queryKey: ["admin-reviews", filter], queryFn: () => getAdminReviews(filter) });
  const flags = useQuery({ queryKey: ["admin-review-flags"], queryFn: getReviewFlags });

  const hide = useMutation({
    mutationFn: () => hideReview(hideFor!, reason),
    onSuccess: () => {
      toast.success("Отзивът е скрит и действието е записано в одит лога.");
      setHideFor(null);
      setReason("");
      void qc.invalidateQueries({ queryKey: ["admin-reviews"] });
    },
    onError: () => toast.error("Скриването не беше изпълнено."),
  });

  const f = flags.data;

  return (
    <AdminPage title="Отзиви" description="Модерация на двустранните отзиви.">
      <AdminCard className="p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Сигнали за злоупотреба</h2>
        {flags.isLoading || !f ? (
          <div className="h-16 animate-pulse rounded-xl bg-muted" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FlagStat
              label="3+ отхвърлени заявки (30 дни)"
              value={f.rejectedClaimUsers.length}
              detail={f.rejectedClaimUsers.map((u) => u.full_name ?? u.user_id).join(", ")}
            />
            <FlagStat
              label="Взаимни отзиви"
              value={f.mutualReviewers.length}
              detail="Двойки, които се оценяват многократно"
            />
            <FlagStat
              label="Нови акаунти с 5 звезди"
              value={f.newAccountFiveStars.length}
              detail={f.newAccountFiveStars.map((u) => u.full_name ?? u.user_id).join(", ")}
            />
            <FlagStat
              label="Работи без отзиви"
              value={f.engagementsWithoutReviews}
              detail="Потвърдени работи с изтекъл срок и нула отзива"
            />
          </div>
        )}
      </AdminCard>

      <AdminCard className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Отзиви</h2>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FILTERS.map((x) => (
                <SelectItem key={x.value} value={x.value}>
                  {x.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {reviews.isLoading ? (
          <div className="h-24 animate-pulse rounded-xl bg-muted" />
        ) : (reviews.data ?? []).length === 0 ? (
          <EmptyState text="Няма отзиви по този филтър." />
        ) : (
          <div className="space-y-3">
            {(reviews.data ?? []).map((r) => (
              <div key={r.id} className="min-w-0 rounded-xl border border-border/60 bg-background p-3">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <Stars value={r.rating} />
                  <span className="truncate text-sm font-medium">
                    {r.reviewerName ?? "Потребител"} → {r.revieweeName ?? "Потребител"}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{formatReviewDate(r.createdAt)}</span>
                  {r.reportCount > 0 && (
                    <Badge variant="destructive" className="rounded-full text-[10px]">
                      {r.reportCount} доклада
                    </Badge>
                  )}
                  {!r.isVisible && (
                    <Badge variant="secondary" className="rounded-full text-[10px]">
                      Още не е видим
                    </Badge>
                  )}
                  {r.hiddenAt && (
                    <Badge variant="outline" className="rounded-full text-[10px]">
                      Скрит
                    </Badge>
                  )}
                </div>
                <p className="mt-2 break-words text-sm text-foreground/90">{r.comment}</p>
                <p className="mt-1 truncate text-[11px] text-muted-foreground">
                  Задача: {r.taskTitle ?? "няма"}
                  {r.hiddenReason ? ` · Причина за скриване: ${r.hiddenReason}` : ""}
                </p>
                {!r.hiddenAt && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2 gap-1.5"
                    onClick={() => setHideFor(r.id)}
                  >
                    <EyeOff className="h-3.5 w-3.5" /> Скрий отзива
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </AdminCard>

      <Dialog open={Boolean(hideFor)} onOpenChange={(v) => !v && setHideFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Скриване на отзив</DialogTitle>
            <DialogDescription>
              Причината се записва в одит лога и рейтингът се преизчислява веднага.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Причина за скриване"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setHideFor(null)}>
              Откажи
            </Button>
            <Button disabled={!reason.trim() || hide.isPending} onClick={() => hide.mutate()}>
              Скрий
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
}

function FlagStat({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-border/60 bg-background p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <AlertTriangle className={`h-3.5 w-3.5 ${value > 0 ? "text-amber-500" : "opacity-40"}`} />
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-1 text-xl font-bold text-foreground">{value}</p>
      {detail && <p className="mt-0.5 line-clamp-2 break-words text-[11px] text-muted-foreground">{detail}</p>}
    </div>
  );
}