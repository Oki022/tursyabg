import { Link } from "@tanstack/react-router";
import { Coins, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useCreditBalance } from "@/lib/credits-api";

/** Cheapest unlock in the pricing ladder. Below this nothing can be unlocked. */
export const MIN_UNLOCK_COST = 5;

export function CreditBalanceCard({ className }: { className?: string }) {
  const { user } = useAuth();
  const { data, isLoading } = useCreditBalance(user?.id);
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
            {isLoading ? "—" : credits}
          </p>
        </div>
        <Link
          to="/settings/billing"
          className="shrink-0 rounded-full bg-gradient-to-r from-orange-500 to-rose-500 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-transform active:scale-95"
        >
          Купи кредити
        </Link>
      </div>
      {low && (
        <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-2 text-xs font-medium text-amber-700">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Балансът ти е под цената на най-евтиното отключване. Зареди кредити, за да продължиш.
        </p>
      )}
    </div>
  );
}
