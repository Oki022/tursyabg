import { Crown, Siren } from "lucide-react";
import { cn } from "@/lib/utils";

const pill =
  "inline-flex max-w-full items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase leading-tight tracking-normal shadow-sm sm:px-2 sm:text-[11px] sm:tracking-wide";

const icon = "hidden h-3 w-3 shrink-0 sm:block";

export function UrgentBadge({ className }: { className?: string }) {
  return (
    <span className={cn(pill, "bg-destructive text-destructive-foreground", className)}>
      <Siren className={icon} />
      <span className="whitespace-nowrap">Спешно</span>
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
      <Crown className={icon} />
      <span className="whitespace-nowrap">Топ</span>
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
