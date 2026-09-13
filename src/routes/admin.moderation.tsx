import { AdminUserLink } from "@/components/admin/user-link";
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Flag, ImageIcon, MessageSquareWarning, ShieldAlert, X } from "lucide-react";
import { toast } from "sonner";
import { toastError } from "@/lib/toast-error";
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
import { categoryBg } from "@/lib/moderation-messages";
import {
  getModerationQueue,
  resolveModerationItem,
  type ModerationItem,
  type ModerationStatus,
} from "@/services/moderation-admin";

export const Route = createFileRoute("/admin/moderation")({
  head: () => ({
    meta: [
      { title: "Модерация | Админ" },
      { name: "description", content: "Опашка за модерация: задържани снимки, маркиран текст и доклади." },
      { property: "og:title", content: "Модерация | Админ" },
      { property: "og:description", content: "Одобри или отхвърли задържано съдържание с една стъпка." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminModerationPage,
});

const STATUS_FILTERS: { value: ModerationStatus | "all"; label: string }[] = [
  { value: "pending", label: "Чакащи" },
  { value: "approved", label: "Одобрени" },
  { value: "rejected", label: "Отхвърлени" },
  { value: "all", label: "Всички" },
];

const KIND_BG: Record<string, string> = {
  image: "Снимка",
  text: "Текст",
  report: "Доклад",
};

const CONTENT_BG: Record<string, string> = {
  task: "задача",
  task_image: "снимка към задача",
  message: "съобщение",
  review: "отзив",
  profile: "профил",
};

const SEVERITY_BG: Record<string, { label: string; className: string }> = {
  high: { label: "Висок риск", className: "bg-red-100 text-red-700" },
  medium: { label: "Среден риск", className: "bg-amber-100 text-amber-700" },
  low: { label: "Нисък риск", className: "bg-muted text-muted-foreground" },
};

function ageBg(iso: string) {
  const hours = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);
  if (hours < 1) return "под 1 ч.";
  if (hours < 24) return `${hours} ч.`;
  return `${Math.floor(hours / 24)} дни`;
}

function QueueRow({ item, onResolve }: { item: ModerationItem; onResolve: (approve: boolean) => void }) {
  const sev = SEVERITY_BG[item.severity] ?? SEVERITY_BG["low"]!;
  const Icon = item.kind === "image" ? ImageIcon : item.kind === "report" ? Flag : MessageSquareWarning;

  return (
    <div className="flex flex-col gap-3 border-b border-border p-4 last:border-0 sm:flex-row">
      {item.imageUrl ? (
        <img
          src={item.imageUrl}
          alt="Задържана снимка"
          className="h-28 w-28 shrink-0 rounded-md border border-border object-cover"
        />
      ) : (
        <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-md border border-dashed border-border bg-muted/60">
          <Icon className="h-6 w-6 text-muted-foreground" />
        </div>
      )}

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge className={`${sev.className} border-0`}>{sev.label}</Badge>
          <Badge variant="outline">{KIND_BG[item.kind] ?? item.kind}</Badge>
          <Badge variant="outline">{CONTENT_BG[item.contentType] ?? item.contentType}</Badge>
          {item.category ? <Badge variant="outline">{categoryBg(item.category)}</Badge> : null}
          <span className="text-xs text-muted-foreground">преди {ageBg(item.createdAt)}</span>
        </div>

        <p className="text-sm font-medium text-foreground">{item.reason}</p>

        {item.excerpt ? (
          <p className="rounded-md bg-muted/60 p-2 text-sm text-foreground">
            {item.matchedPattern ? (
              <span className="mr-1 rounded bg-amber-200/70 px-1 font-mono text-[11px] text-amber-900">
                {item.matchedPattern.slice(0, 60)}
              </span>
            ) : null}
            {item.excerpt}
          </p>
        ) : null}

        {item.kind === "image" && item.score !== null ? (
          <p className="text-xs text-muted-foreground">
            Оценка: {(item.score * 100).toFixed(0)}%{" "}
            {Object.entries(item.labels)
              .filter(([, v]) => typeof v === "number" && v > 0.05)
              .map(([k, v]) => `${categoryBg(k)} ${(Number(v) * 100).toFixed(0)}%`)
              .join(" · ")}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>
            Подател:{" "}
            {item.userId ? <AdminUserLink id={item.userId} name={item.userName} /> : "няма"}
          </span>
          <span>Профил на {item.accountAgeDays} дни</span>
          <span>Доверие: {item.trustLevel}</span>
          <span className={item.priorViolations > 0 ? "font-medium text-red-600" : ""}>
            Нарушения: {item.priorViolations}
          </span>
          {item.reporterName ? <span>Докладвал: {item.reporterName}</span> : null}
          {item.taskId ? (
            <Link to="/task/$id" params={{ id: item.taskId }} className="underline">
              Виж задачата
            </Link>
          ) : null}
        </div>
      </div>

      {item.status === "pending" ? (
        <div className="flex shrink-0 gap-2 sm:flex-col">
          <Button size="sm" className="gap-1" onClick={() => onResolve(true)}>
            <Check className="h-4 w-4" /> Одобри
          </Button>
          <Button size="sm" variant="outline" className="gap-1" onClick={() => onResolve(false)}>
            <X className="h-4 w-4" /> Отхвърли
          </Button>
        </div>
      ) : (
        <Badge variant="outline" className="h-fit">
          {item.status === "approved" ? "Одобрено" : "Отхвърлено"}
        </Badge>
      )}
    </div>
  );
}

function AdminModerationPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<ModerationStatus | "all">("pending");
  const [rejectFor, setRejectFor] = useState<ModerationItem | null>(null);
  const [reason, setReason] = useState("");

  const queue = useQuery({
    queryKey: ["admin-moderation", status],
    queryFn: () => getModerationQueue(status),
  });

  const resolve = useMutation({
    mutationFn: (input: { id: string; approve: boolean; reason?: string }) => resolveModerationItem(input),
    onSuccess: (_d, vars) => {
      toast.success(vars.approve ? "Одобрено и публикувано." : "Отхвърлено, потребителят е уведомен.");
      setRejectFor(null);
      setReason("");
      void qc.invalidateQueries({ queryKey: ["admin-moderation"] });
      void qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (e: unknown) => toastError(e, { title: "Действието не беше записано" }),
  });

  const items = queue.data ?? [];
  const pending = items.filter((i) => i.status === "pending").length;

  return (
    <AdminPage
      title="Модерация"
      description="Всичко задържано или маркирано на едно място, снимки, текст и доклади от потребители."
      actions={
        <Select value={status} onValueChange={(v) => setStatus(v as ModerationStatus | "all")}>
          <SelectTrigger className="w-40 bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      {status === "pending" && pending > 0 ? (
        <AdminCard className="flex items-center gap-2 p-3 text-sm text-foreground">
          <ShieldAlert className="h-4 w-4 text-amber-600" />
          {pending} чакащи за преглед · най-старото преди{" "}
          {ageBg(items[items.length - 1]?.createdAt ?? new Date().toISOString())}
        </AdminCard>
      ) : null}

      <AdminCard>
        {queue.isLoading ? (
          <EmptyState text="Зареждане…" />
        ) : items.length === 0 ? (
          <EmptyState text="Няма съдържание за преглед." />
        ) : (
          items.map((item) => (
            <QueueRow
              key={item.id}
              item={item}
              onResolve={(approve) =>
                approve ? resolve.mutate({ id: item.id, approve: true }) : setRejectFor(item)
              }
            />
          ))
        )}
      </AdminCard>

      <Dialog open={Boolean(rejectFor)} onOpenChange={(o) => !o && setRejectFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Отхвърляне на съдържание</DialogTitle>
            <DialogDescription>
              Причината се изпраща на потребителя на български и се записва като нарушение.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Напр.: Снимката съдържа неподходящо съдържание. Качи снимка на самата задача."
            rows={4}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectFor(null)}>
              Отказ
            </Button>
            <Button
              variant="destructive"
              disabled={reason.trim().length < 5 || resolve.isPending}
              onClick={() => resolve.mutate({ id: rejectFor!.id, approve: false, reason: reason.trim() })}
            >
              Отхвърли
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
}
