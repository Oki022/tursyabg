import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Bell, BellRing, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useCreateTaskAlert, useMyTaskAlerts } from "@/lib/task-alerts-api";
import { sameAlert, type TaskAlertInput } from "@/services/task-alerts";
import { cn } from "@/lib/utils";

/**
 * "Известявай ме" for the current /tasks filters. Saves the category and place
 * as a saved search; new matching tasks then arrive in the morning digest.
 */
export function SaveAlertButton({ alert, className }: { alert: TaskAlertInput; className?: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const href = useRouterState({ select: (s) => s.location.href });
  const alerts = useMyTaskAlerts();
  const create = useCreateTaskAlert();

  const saved = (alerts.data ?? []).some((a) => sameAlert(a, alert));

  if (saved) {
    return (
      <Button asChild variant="outline" size="sm" className={cn("gap-2 rounded-full", className)}>
        <Link to="/settings/notifications">
          <BellRing className="h-4 w-4 text-primary" />
          Известията са включени
        </Link>
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("gap-2 rounded-full border-primary/40 text-primary hover:bg-primary/5", className)}
      disabled={create.isPending}
      onClick={() => {
        if (!user) {
          void navigate({ to: "/auth", search: { mode: "login", redirect: href } });
          return;
        }
        create.mutate(alert);
      }}
    >
      {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
      Известявай ме за нови задачи като тези
    </Button>
  );
}
