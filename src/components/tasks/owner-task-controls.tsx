import { CheckCircle2, RefreshCw, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCloseTask, useConfirmTaskActive } from "@/lib/tasks-api";
import type { Task } from "@/lib/mock-data";

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
    <div className={compact ? "space-y-2" : "space-y-3 rounded-2xl bg-secondary/60 p-3"}>
      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <Users className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
        <span>
          {unlockCount} от {maxUnlocks} изпълнители са отключили контакта ти. Лимитът пази телефона ти от
          прекалено много обаждания.
        </span>
      </p>
      {isAssigned ? (
        <Button
          variant="outline"
          size={compact ? "sm" : "lg"}
          className="w-full gap-2"
          disabled={confirm.isPending}
          onClick={() => void run(() => confirm.mutateAsync(task.id), "Задачата е активна отново.")}
        >
          <RefreshCw className="h-4 w-4" />
          Активирай отново
        </Button>
      ) : (
        <Button
          variant="outline"
          size={compact ? "sm" : "lg"}
          className="w-full gap-2"
          disabled={close.isPending}
          onClick={() => void run(() => close.mutateAsync(task.id), "Задачата е затворена.")}
        >
          <CheckCircle2 className="h-4 w-4" />
          Затвори задачата (намерих изпълнител)
        </Button>
      )}
    </div>
  );
}
