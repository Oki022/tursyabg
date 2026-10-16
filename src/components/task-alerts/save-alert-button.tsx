import { useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Bell, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { useMyTaskAlerts } from "@/lib/task-alerts-api";
import { sameAlert } from "@/services/task-alerts";
import { cn } from "@/lib/utils";
import { draftToAlert, isNarrow, type AlertDraft } from "./alert-fields";
import { TaskAlertsManager } from "./task-alerts-manager";

/**
 * "Известия" button (/tasks, homepage). Opens a dialog with the user's saved
 * searches and a form pre-filled with the given filters. `compact` shows a
 * short label on small screens.
 */
export function SaveAlertButton({
  initial,
  className,
  compact = false,
}: {
  initial: AlertDraft;
  className?: string;
  compact?: boolean;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const href = useRouterState({ select: (s) => s.location.href });
  const alerts = useMyTaskAlerts();
  const [open, setOpen] = useState(false);

  const count = alerts.data?.length ?? 0;
  const current = draftToAlert(initial);
  // Open the form unless the current filters are already saved (or too broad).
  const formInitiallyOpen =
    isNarrow(current) ? !(alerts.data ?? []).some((a) => sameAlert(a, current)) : count === 0;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn("gap-2 rounded-full border-primary/40 text-primary hover:bg-primary/5", className)}
        onClick={() => {
          if (!user) {
            void navigate({ to: "/auth", search: { mode: "login", redirect: href } });
            return;
          }
          setOpen(true);
        }}
      >
        {count > 0 ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
        {compact ? (
          <>
            <span className="sm:hidden">{count > 0 ? `Известия (${count})` : "Известия"}</span>
            <span className="hidden sm:inline">
              {count > 0 ? `Известия за нови задачи (${count})` : "Известявай ме за нови задачи"}
            </span>
          </>
        ) : count > 0 ? (
          `Известия за нови задачи (${count})`
        ) : (
          "Известявай ме за нови задачи"
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Известия за нови задачи</DialogTitle>
            <DialogDescription>
              Проверяваме за нови задачи на всеки 30 минути (7:00–22:00). Известието в
              приложението идва веднага, а имейл пращаме най-много веднъж на 3 часа. Ако няма нови,
              няма да те безпокоим.
            </DialogDescription>
          </DialogHeader>
          {/* Mounted only while open, so the form starts from the current filters every time. */}
          {open && (
            <TaskAlertsManager
              initialDraft={initial}
              formInitiallyOpen={formInitiallyOpen}
              idPrefix="alert-dialog"
              inDialog
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
