import { Crown, Siren } from "lucide-react";
import { cn } from "@/lib/utils";

const pill =
  "inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase leading-tight tracking-wide shadow-sm sm:text-[11px]";

export function UrgentBadge({ className }: { className?: string }) {
  return (
    <span className={cn(pill, "bg-destructive text-destructive-foreground", className)}>
      <Siren className="h-3 w-3 shrink-0" />
      <span className="truncate">Спешно</span>
    </span>
  );
}

export function TopBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        pill,
        "bg-gradient-to-r from-primary to-accent text-primary-foreground",
        className,
      )}
    >
      <Crown className="h-3 w-3 shrink-0" />
      <span className="truncate">Топ обява</span>
    </span>
  );
}

export function PromotedBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        pill,
        "bg-gradient-to-r from-primary to-accent text-primary-foreground",
        className,
      )}
    >
      Промотирана
    </span>
  );
}
