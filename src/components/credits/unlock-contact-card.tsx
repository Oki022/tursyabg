import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Lock, Phone, RotateCcw, Coins, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useCreditBalance, useMyUnlock, useUnlockTask } from "@/lib/credits-api";
import { creditsLabel, getUnlockedContact, unlockCostForBudget } from "@/services/credits";
import { RefundRequestDialog } from "@/components/credits/refund-request-dialog";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

export function UnlockContactCard({
  taskId,
  ownerId,
  budget,
  unlockCost,
  unlockCount = 0,
  maxUnlocks = 5,
  taskStatus = "active",
}: {
  taskId: string;
  ownerId?: string;
  budget: number;
  unlockCost?: number;
  unlockCount?: number;
  maxUnlocks?: number;
  taskStatus?: string;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const cost = unlockCost ?? unlockCostForBudget(budget);
  const unlockQuery = useMyUnlock(taskId, user?.id);
  const balanceQuery = useCreditBalance(user?.id);
  const unlock = useUnlockTask();
  const [refundOpen, setRefundOpen] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);

  const isUnlocked = Boolean(unlockQuery.data);
  const balance = balanceQuery.data ?? user?.credits ?? 0;
  const canAfford = balance >= cost;
  const slotsLeft = Math.max(maxUnlocks - unlockCount, 0);
  const slotsFull = slotsLeft === 0;
  const taskClosed = taskStatus !== "active";
  const contactQuery = useQuery({
    queryKey: ["credits", "contact", ownerId, isUnlocked],
    enabled: Boolean(isUnlocked && ownerId),
    queryFn: () => getUnlockedContact(ownerId!),
  });
  const phone = revealed ?? contactQuery.data ?? null;

  const handleUnlock = async () => {
    if (!user) {
      void navigate({ to: "/auth", search: { redirect: `/task/${taskId}` } });
      return;
    }
    if (!canAfford) {
      void navigate({ to: "/settings/billing" });
      return;
    }
    try {
      const res = await unlock.mutateAsync(taskId);
      if (res.ok) {
        setRevealed(res.phone);
        if (!res.already) toast.success(`Контактът е отключен за ${creditsLabel(res.creditsSpent)}.`);
      } else if (res.error === "INSUFFICIENT_CREDITS") {
        void navigate({ to: "/settings/billing" });
      } else if (res.error === "TASK_NOT_ACTIVE") {
        toast.error("Задачата вече не е активна.");
      } else {
        toast.error("Контактът не беше отключен.");
      }
    } catch {
      toast.error("Възникна грешка. Опитай отново.");
    }
  };

  if (isUnlocked) {
    return (
      <div className="rounded-2xl border border-primary/30 bg-primary-soft/50 p-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
          <Phone className="h-3.5 w-3.5" /> Контакт
        </div>
        <div className="mt-2 text-lg font-bold tracking-tight text-slate-900">
          {contactQuery.isLoading && !phone ? "Зареждане..." : (phone ?? "Няма посочен телефон")}
        </div>
        {phone && (
          <Button asChild size="sm" className="mt-3 w-full gap-2">
            <a href={`tel:${phone.replace(/\s/g, "")}`}>
              <Phone className="h-4 w-4" /> Обади се
            </a>
          </Button>
        )}
        <button
          type="button"
          onClick={() => setRefundOpen(true)}
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Заяви връщане
        </button>
        <RefundRequestDialog
          open={refundOpen}
          onOpenChange={setRefundOpen}
          unlockId={unlockQuery.data?.id ?? null}
        />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-secondary/40 p-4">
      {taskClosed ? (
        <p className="mb-3 rounded-xl bg-background px-3 py-2 text-xs text-muted-foreground">
          Задачата вече не приема нови кандидати.
        </p>
      ) : slotsFull ? (
        <p className="mb-3 rounded-xl bg-background px-3 py-2 text-xs text-muted-foreground">
          Достигнат е лимитът от {maxUnlocks} отключвания. Така всеки изпълнител има реален шанс.
        </p>
      ) : (
        <p className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Users className="h-3.5 w-3.5 shrink-0 text-primary" />
          Остават {slotsLeft} от {maxUnlocks} места за изпълнители
        </p>
      )}
      <Button
        size="lg"
        className="h-auto min-h-14 w-full whitespace-normal break-words px-5 py-3 text-center text-sm leading-snug"
        onClick={handleUnlock}
        disabled={unlock.isPending || slotsFull || taskClosed}
      >
        <span className="inline-flex items-center justify-center gap-2">
          {user && canAfford && !slotsFull && !taskClosed && <Lock className="h-4 w-4 shrink-0" />}
          {taskClosed
            ? "Задачата е затворена"
            : slotsFull
            ? "Местата са запълнени"
            : !user
            ? "Влез, за да отключиш контакта"
            : !canAfford
              ? "Купи кредити"
              : unlock.isPending
                ? "Отключване..."
                : `Отключи контакта (${creditsLabel(cost)})`}
        </span>
      </Button>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        {user && !canAfford ? (
          <span className="inline-flex items-center gap-1 break-words">
            <Coins className="h-3.5 w-3.5 shrink-0 text-primary" />
            Нужни са ти {creditsLabel(cost)} · Имаш {balance}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 break-words">
            <Coins className="h-3.5 w-3.5 shrink-0 text-primary" />
            Твой баланс: {creditsLabel(balance)}
          </span>
        )}
        <Link to="/settings/billing" className="font-medium text-primary hover:underline">
          Купи кредити
        </Link>
      </div>
    </div>
  );
}