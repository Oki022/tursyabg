import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  CheckCircle2,
  HelpCircle,
  Info,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useConfirmTaskActive } from "@/lib/tasks-api";
import { useMyEngagements } from "@/lib/reviews-api";
import { CloseTaskDialog } from "@/components/tasks/close-task-dialog";
import { DeleteTaskDialog } from "@/components/tasks/delete-task-dialog";
import type { Task } from "@/lib/mock-data";

const LIMIT_HELP =
  "Лимитът пази телефона ти от прекалено много обаждания. Само първите изпълнители могат да отключат контакта ти.";

/** Owner-only controls: close the task when assigned, or confirm it is still open. */
export function OwnerTaskControls({
  task,
  compact = false,
  redirectAfterDelete,
}: {
  task: Task;
  compact?: boolean;
  redirectAfterDelete?: "profile";
}) {
  const confirm = useConfirmTaskActive();
  const [closeOpen, setCloseOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const unlockCount = task.unlockCount ?? 0;
  const maxUnlocks = task.maxUnlocks ?? 5;
  const isAssigned = task.status === "assigned";
  const { data: engagements = [] } = useMyEngagements(isAssigned);
  const hasEngagement = engagements.some((e) => e.taskId === task.id);

  const run = async (fn: () => Promise<void>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
    } catch {
      toast.error("Действието не беше изпълнено.");
    }
  };

  const limitLine = (
    <div className="flex w-full min-w-0 items-center gap-1 text-[11px] text-muted-foreground">
      <Users className="h-3 w-3 shrink-0 text-primary" />
      <span className="min-w-0 truncate">
        {unlockCount}/{maxUnlocks} отключвания
      </span>
      <Popover>
        <PopoverTrigger
          aria-label="Какво означава лимитът"
          className="ml-auto shrink-0 rounded-full p-0.5 text-muted-foreground hover:text-foreground"
        >
          <Info className="h-3.5 w-3.5" />
        </PopoverTrigger>
        <PopoverContent side="top" align="end" className="w-56 text-xs leading-snug">
          {unlockCount} от {maxUnlocks} изпълнители са отключили контакта ти. {LIMIT_HELP}
        </PopoverContent>
      </Popover>
    </div>
  );

  const btn = compact
    ? "h-auto w-full min-w-0 justify-center whitespace-normal py-1.5 text-[11px] leading-snug"
    : "h-auto w-full min-w-0 justify-center whitespace-normal py-2 text-sm";

  return (
    <div
      className={
        compact
          ? "w-full min-w-0 space-y-2 overflow-hidden"
          : "w-full min-w-0 space-y-3 overflow-hidden rounded-2xl bg-secondary/60 p-3"
      }
    >
      {limitLine}

      {isAssigned ? (
        <div className="w-full min-w-0 space-y-2">
          {!hasEngagement && !dismissed && (
            <div className="min-w-0 space-y-1.5 rounded-xl bg-secondary/60 p-2">
              <p className="flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground">
                <HelpCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                Кой свърши задачата? Посочи изпълнителя за отзиви.
              </p>
              <Button size="sm" className={btn} onClick={() => setAssignOpen(true)}>
                Посочи изпълнител
              </Button>
              <Button size="sm" variant="ghost" className={btn} onClick={() => setDismissed(true)}>
                Скрий
              </Button>
              <CloseTaskDialog
                taskId={task.id}
                open={assignOpen}
                onOpenChange={setAssignOpen}
                assignOnly
              />
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            className={`${btn} gap-1.5`}
            disabled={confirm.isPending}
            onClick={() => void run(() => confirm.mutateAsync(task.id), "Задачата е активна отново.")}
          >
            <RefreshCw className="h-3.5 w-3.5 shrink-0" />
            Активирай отново
          </Button>
        </div>
      ) : (
        <div className="w-full min-w-0">
          <Button variant="outline" size="sm" className={`${btn} gap-1.5`} onClick={() => setCloseOpen(true)}>
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            Затвори
          </Button>
          <CloseTaskDialog taskId={task.id} open={closeOpen} onOpenChange={setCloseOpen} />
        </div>
      )}

      <div className="w-full min-w-0 border-t border-border/60 pt-2">
        {compact ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className={`${btn} gap-1.5`}>
                <MoreHorizontal className="h-3.5 w-3.5 shrink-0" />
                Още
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem asChild>
                <Link to="/task/$id/edit" params={{ id: task.id }}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Редактирай
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => setDeleteOpen(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Изтрий
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="flex w-full min-w-0 flex-col gap-1.5 sm:flex-row">
            <Button asChild variant="ghost" size="sm" className={`${btn} gap-1.5 sm:flex-1`}>
              <Link to="/task/$id/edit" params={{ id: task.id }}>
                <Pencil className="h-4 w-4 shrink-0" />
                Редактирай
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`${btn} gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive sm:flex-1`}
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-4 w-4 shrink-0" />
              Изтрий
            </Button>
          </div>
        )}
      </div>
      <DeleteTaskDialog
        taskId={task.id}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        {...(redirectAfterDelete ? { redirectTo: redirectAfterDelete } : {})}
      />
    </div>
  );
}
