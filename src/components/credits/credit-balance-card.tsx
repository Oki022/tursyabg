import { Coins, AlertTriangle, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useCreditBalance, useHasSpentCredits } from "@/lib/credits-api";
import { useWelcomeBonus } from "@/lib/settings-api";

/** Cheapest unlock in the pricing ladder. Below this nothing can be unlocked. */
export const MIN_UNLOCK_COST = 5;

export function CreditBalanceCard({ className }: { className?: string }) {
  const { user } = useAuth();
  const { data, isLoading } = useCreditBalance(user?.id);
  const spent = useHasSpentCredits(user?.id).data ?? false;
  const bonus = useWelcomeBonus().data ?? 0;
  const credits = data ?? user?.credits ?? 0;
  const low = !isLoading && credits < MIN_UNLOCK_COST;

  return (
    <div
      className={cn(
        "min-w-0 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-accent/10 to-accent/20 p-4 shadow-sm md:p-5",
        className,
      )}
    >
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Coins className="h-3.5 w-3.5" />
            Кредити
          </p>
          <p className="mt-0.5 truncate text-3xl font-extrabold leading-tight text-primary md:text-4xl">
            {isLoading ? "..." : credits}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Link
            to="/settings/billing"
            hash="history"
            aria-label="История на движенията"
            title="История на движенията"
            className="grid h-9 w-9 place-items-center rounded-full border border-border/60 bg-background/70 text-muted-foreground transition-colors hover:text-foreground"
          >
            <History className="h-4 w-4" />
          </Link>
          <Link
            to="/settings/billing"
            className="rounded-full bg-gradient-to-r from-orange-500 to-rose-500 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-transform active:scale-95"
          >
            Купи кредити
          </Link>
        </div>
      </div>
      {low ? (
        <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-2 text-xs font-medium text-amber-700">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Балансът ти е под цената на най-евтиното отключване. Зареди кредити, за да продължиш.
        </p>
      ) : (
        spent || (
          <p className="mt-3 text-xs text-muted-foreground">
            С кредити отключваш телефона на възложителя по задача, която те интересува. Едно отключване струва
            между 5 и 80 кредита според бюджета на задачата.
            {bonus ? ` Първите ${bonus} кредита са подарък при регистрация.` : ""}
          </p>
        )
      )}
    </div>
  );
}
