import { CheckCircle2, Info, RefreshCw, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCloseTask, useConfirmTaskActive } from "@/lib/tasks-api";
import type { Task } from "@/lib/mock-data";

const LIMIT_HELP =
  "Лимитът пази телефона ти от прекалено много обаждания. Само първите изпълнители могат да отключат контакта ти.";

/** Owner-only controls: close the task when assigned, or confirm it is still open. */
export function OwnerTaskControls({ task, compact = false }: { task: Task; compact?: boolean }) {
  const close = useCloseTask();
  const confirm = useConfirmTaskActive();
  const unlockCount = task.unlockCount ?? 0;
  const maxUnlocks = task.maxUnlocks ?? 5;
  const isAssigned = task.status === "assigned";

  const run = async (fn: () => Promise<void>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
    } catch {
      toast.error("Действието не беше изпълнено.");
    }
  };

  return (
    <div
      className={
        compact
          ? "w-full min-w-0 space-y-2"
          : "w-full min-w-0 space-y-3 rounded-2xl bg-secondary/60 p-3"
      }
    >
      {compact ? (
        <div className="min-w-0 space-y-1">
          <div className="flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground">
            <Users className="h-3 w-3 shrink-0 text-primary" />
            <span className="truncate">
              {unlockCount} от {maxUnlocks} изпълнители
            </span>
            <Popover>
              <PopoverTrigger
                aria-label="Какво означава лимитът"
                className="ml-auto shrink-0 rounded-full p-0.5 text-muted-foreground hover:text-foreground"
              >
                <Info className="h-3 w-3" />
              </PopoverTrigger>
              <PopoverContent side="top" className="w-56 text-xs leading-snug">
                {unlockCount} от {maxUnlocks} изпълнители са отключили контакта ти. {LIMIT_HELP}
              </PopoverContent>
            </Popover>
          </div>
          <div
            className="flex gap-1"
            role="progressbar"
            aria-valuenow={unlockCount}
            aria-valuemin={0}
            aria-valuemax={maxUnlocks}
          >
            {Array.from({ length: maxUnlocks }).map((_, i) => (
              <span
                key={i}
                className={`h-1 flex-1 rounded-full ${i < unlockCount ? "bg-primary" : "bg-muted"}`}
              />
            ))}
          </div>
        </div>
      ) : (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Users className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <span>
            {unlockCount} от {maxUnlocks} изпълнители са отключили контакта ти. {LIMIT_HELP}
          </span>
        </p>
      )}
      {isAssigned ? (
        <Button
          variant="outline"
          size={compact ? "sm" : "lg"}
          className={`w-full min-w-0 gap-1.5 whitespace-normal ${compact ? "h-auto py-1.5 text-[11px] leading-snug" : "gap-2"}`}
          disabled={confirm.isPending}
          onClick={() => void run(() => confirm.mutateAsync(task.id), "Задачата е активна отново.")}
        >
          <RefreshCw className={compact ? "h-3 w-3 shrink-0" : "h-4 w-4"} />
          Активирай отново
        </Button>
      ) : (
        <div className="w-full min-w-0 space-y-1">
          <Button
            variant="outline"
            size={compact ? "sm" : "lg"}
            className={`w-full min-w-0 gap-1.5 whitespace-normal ${compact ? "h-auto py-1.5 text-[11px] leading-snug" : "gap-2"}`}
            disabled={close.isPending}
            onClick={() => void run(() => close.mutateAsync(task.id), "Задачата е затворена.")}
          >
            <CheckCircle2 className={compact ? "h-3 w-3 shrink-0" : "h-4 w-4"} />
            Затвори задачата
          </Button>
          <p className={`text-muted-foreground ${compact ? "text-[10px] leading-snug" : "text-xs"}`}>
            Ако си намерил изпълнител.
          </p>
        </div>
      )}
    </div>
  );
}
