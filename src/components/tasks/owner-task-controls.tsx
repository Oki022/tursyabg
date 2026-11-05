import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarClock, CheckCircle2, HelpCircle, Info, Pencil, RefreshCw, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useConfirmTaskActive } from "@/lib/tasks-api";
import { useMyEngagements } from "@/lib/reviews-api";
import { CloseTaskDialog } from "@/components/tasks/close-task-dialog";
import { errorBg } from "@/lib/errors";
import { dayMonthBg, taskLifetimeNotice } from "@/lib/task-lifetime";
import type { Task } from "@/lib/mock-data";

const LIMIT_HELP =
  "Лимитът пази телефона ти от прекалено много обаждания. Само първите изпълнители могат да отключат контакта ти.";

/** Keeps the task live 30 more days (also brings back an automatically deactivated one). */
function useKeepTaskLive() {
  const confirm = useConfirmTaskActive();
  const keep = async (taskId: string, ok: string) => {
    try {
      await confirm.mutateAsync(taskId);
      toast.success(ok);
    } catch (e) {
      const { title, description } = errorBg(e, { title: "Действието не беше изпълнено." });
      toast.error(title, { description });
    }
  };
  return { keep, pending: confirm.isPending };
}

/** "Активирай отново" for a closed or automatically deactivated task. */
export function ReactivateTaskButton({ taskId, className }: { taskId: string; className?: string }) {
  const { keep, pending } = useKeepTaskLive();
  return (
    <Button
      variant="outline"
      size="sm"
      className={className}
      disabled={pending}
      onClick={() => void keep(taskId, "Задачата е активна отново за 30 дни.")}
    >
      <RefreshCw className="h-3.5 w-3.5 shrink-0" />
      Активирай отново
    </Button>
  );
}

/** Owner-only controls: close the task, confirm it is still open, or switch it back on. */
export function OwnerTaskControls({
  task,
  compact = false,
}: {
  task: Task;
  compact?: boolean;
  redirectAfterDelete?: "profile";
}) {
  const { keep, pending: keeping } = useKeepTaskLive();
  const [closeOpen, setCloseOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const unlockCount = task.unlockCount ?? 0;
  const maxUnlocks = task.maxUnlocks ?? 5;
  const isAssigned = task.status === "assigned";
  const isInactive = task.status === "inactive";
  const adminHidden = Boolean(task.adminHiddenAt);
  const notice = taskLifetimeNotice(task);
  // A reposted task lives on as its copy; an admin-hidden one stays hidden.
  const canReactivate = !adminHidden && !task.repostedAt;
  const { data: engagements = [] } = useMyEngagements(isAssigned);
  const hasEngagement = engagements.some((e) => e.taskId === task.id);

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
          {canReactivate && <ReactivateTaskButton taskId={task.id} className={`${btn} gap-1.5`} />}
        </div>
      ) : isInactive ? (
        <div className="w-full min-w-0 space-y-2">
          <p className="text-[11px] leading-snug text-muted-foreground">
            Задачата не е активна и изпълнителите не я виждат.
          </p>
          {canReactivate && <ReactivateTaskButton taskId={task.id} className={`${btn} gap-1.5`} />}
        </div>
      ) : (
        <div className="w-full min-w-0 space-y-2">
          {notice && (
            <div className="min-w-0 space-y-1.5 rounded-xl border border-primary/30 bg-primary/5 p-2">
              <p className="flex items-start gap-1.5 text-[12px] font-semibold leading-snug text-foreground">
                <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                {notice.kind === "confirm" ? "Задачата още ли е актуална?" : "Задачата изтича скоро"}
              </p>
              <p className="text-[11px] leading-snug text-muted-foreground">
                {notice.kind === "confirm"
                  ? `Потвърди до ${dayMonthBg(notice.until)}, иначе ще я деактивираме.`
                  : `Изтича на ${dayMonthBg(notice.until)}.`}
              </p>
              <Button
                size="sm"
                className={`${btn} gap-1.5`}
                disabled={keeping}
                onClick={() => void keep(task.id, "Готово. Задачата остава активна още 30 дни.")}
              >
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                {notice.kind === "confirm" ? "Да, още е актуална" : "Удължи с 30 дни"}
              </Button>
            </div>
          )}
          <Button variant="outline" size="sm" className={`${btn} gap-1.5`} onClick={() => setCloseOpen(true)}>
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            Затвори
          </Button>
          <CloseTaskDialog taskId={task.id} open={closeOpen} onOpenChange={setCloseOpen} />
        </div>
      )}

      <div className="w-full min-w-0 border-t border-border/60 pt-2">
        <Button asChild variant="ghost" size="sm" className={`${btn} gap-1.5`}>
          <Link to="/task/$id/edit" params={{ id: task.id }}>
            <Pencil className="h-4 w-4 shrink-0" />
            Редактирай
          </Link>
        </Button>
      </div>
    </div>
  );
}
