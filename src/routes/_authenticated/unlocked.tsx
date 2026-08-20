import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { KeyRound, Phone, RotateCcw, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BackLink } from "@/components/back-link";
import { Badge } from "@/components/ui/badge";
import { useUnlockedTasks } from "@/lib/credits-api";
import { creditsLabel } from "@/services/credits";
import { getCategory } from "@/lib/mock-data";
import { RefundRequestDialog } from "@/components/credits/refund-request-dialog";
import { ClaimTaskButton } from "@/components/tasks/claim-task-button";

export const Route = createFileRoute("/_authenticated/unlocked")({
  head: () => ({
    meta: [
      { title: "Отключени задачи | ТърсяБГ" },
      { name: "description", content: "Всички задачи, за които си отключил контакт, с телефон и срок на достъп." },
      { property: "og:title", content: "Отключени задачи | ТърсяБГ" },
      { property: "og:description", content: "Преглед на отключените контакти и заявки за връщане на кредити." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UnlockedPage,
});

function UnlockedPage() {
  const { data, isLoading } = useUnlockedTasks();
  const [refundFor, setRefundFor] = useState<string | null>(null);

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8 md:py-12">
      <BackLink />
      <div className="mb-6 mt-4 flex items-center gap-2">
        <KeyRound className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Отключени задачи</h1>
      </div>

      {isLoading && <div className="h-28 animate-pulse rounded-2xl bg-muted" />}

      {!isLoading && (data?.length ?? 0) === 0 && (
        <div className="rounded-2xl border border-border/60 bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">Още не си отключвал контакти по задачи.</p>
          <Button asChild className="mt-4">
            <Link to="/tasks">Разгледай задачите</Link>
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {(data ?? []).map((u) => {
          const cat = getCategory(u.category);
          return (
            <div key={u.unlockId} className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    to="/task/$id"
                    params={{ id: u.taskId }}
                    className="text-base font-semibold text-foreground hover:underline"
                  >
                    {u.title}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary" className="rounded-full">
                      {cat.name}
                    </Badge>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" /> {u.budget} €
                    </span>
                    <span>
                      Достъп до{" "}
                      {new Date(u.expiresAt).toLocaleDateString("bg-BG", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>
                <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
                  −{creditsLabel(u.creditsSpent)}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-primary-soft/50 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                    {u.ownerName}
                  </p>
                  <p className="truncate text-base font-bold text-foreground">
                    {u.phone ?? "Няма посочен телефон"}
                  </p>
                </div>
                {u.phone && (
                  <Button asChild size="sm" className="gap-2">
                    <a href={`tel:${u.phone.replace(/\s/g, "")}`}>
                      <Phone className="h-4 w-4" /> Обади се
                    </a>
                  </Button>
                )}
              </div>

              <div className="mt-3">
                <ClaimTaskButton taskId={u.taskId} size="sm" />
              </div>

              {u.hasRefundRequest ? (
                <p className="mt-3 text-xs text-muted-foreground">Заявка за връщане е подадена.</p>
              ) : (
                <button
                  type="button"
                  onClick={() => setRefundFor(u.unlockId)}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Заяви връщане
                </button>
              )}
            </div>
          );
        })}
      </div>

      <RefundRequestDialog
        open={Boolean(refundFor)}
        onOpenChange={(v) => !v && setRefundFor(null)}
        unlockId={refundFor}
      />
    </div>
  );
}