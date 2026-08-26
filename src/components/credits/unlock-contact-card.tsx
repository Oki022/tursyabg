import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Lock, Phone, Coins, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useCreditBalance, useMyUnlock, useUnlockTask } from "@/lib/credits-api";
import { creditsLabel, getUnlockedContact, unlockCostForBudget } from "@/services/credits";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { toastError } from "@/lib/toast-error";


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
        return;
      }
      if (res.error === "INSUFFICIENT_CREDITS") {
        toast.error("Нямаш достатъчно кредити", { description: "Купи кредити, за да отключиш контакта." });
        void navigate({ to: "/settings/billing" });
        return;
      }
      // Всяка друга причина (лимит, затворена задача, липса на права) идва
      // като код от базата и се превежда от общия форматер.
      toastError(res.error, { title: "Контактът не беше отключен" });
    } catch (err) {
      toastError(err, { title: "Контактът не беше отключен" });
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
        className="h-auto min-h-16 w-full px-5 py-3.5 text-center"
        onClick={handleUnlock}
        disabled={unlock.isPending || slotsFull || taskClosed}
      >
        <span className="flex items-center justify-center gap-2">
          {user && canAfford && !slotsFull && !taskClosed && !unlock.isPending && (
            <Lock className="h-4 w-4 shrink-0" />
          )}
          <span className="flex flex-col items-center leading-snug">
            <span className="text-sm font-semibold">
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
                        : "Отключи контакта"}
            </span>
            {user && canAfford && !slotsFull && !taskClosed && !unlock.isPending && (
              <span className="text-xs font-medium text-primary-foreground/80">
                {creditsLabel(cost)}
              </span>
            )}
          </span>
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