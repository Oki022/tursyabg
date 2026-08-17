import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Lock, Phone, RotateCcw, Coins } from "lucide-react";
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
}: {
  taskId: string;
  ownerId?: string;
  budget: number;
  unlockCost?: number;
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
    try {
      const res = await unlock.mutateAsync(taskId);
      if (res.ok) {
        setRevealed(res.phone);
        if (!res.already) toast.success(`Контактът е отключен за ${creditsLabel(res.creditsSpent)}.`);
      } else if (res.error === "INSUFFICIENT_CREDITS") {
        toast.error("Нямаш достатъчно кредити.", {
          description: `Нужни: ${creditsLabel(res.cost ?? cost)} · Наличност: ${creditsLabel(res.balance ?? 0)}`,
          action: { label: "Купи кредити", onClick: () => void navigate({ to: "/settings/billing" }) },
        });
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
      <Button size="lg" className="w-full gap-2" onClick={handleUnlock} disabled={unlock.isPending}>
        <Lock className="h-4 w-4" />
        {unlock.isPending ? "Отключване..." : `Отключи контакта (${creditsLabel(cost)})`}
      </Button>
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Coins className="h-3.5 w-3.5 text-primary" />
          Твой баланс: {creditsLabel(balanceQuery.data ?? user?.credits ?? 0)}
        </span>
        <Link to="/settings/billing" className="font-medium text-primary hover:underline">
          Купи кредити
        </Link>
      </div>
    </div>
  );
}