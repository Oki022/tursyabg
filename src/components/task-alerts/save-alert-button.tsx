import { useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Bell, BellRing, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { splitLocation } from "@/lib/locations";
import { useRegions } from "@/lib/locations-api";
import { taskAlertLabel, useCreateTaskAlert, useMyTaskAlerts } from "@/lib/task-alerts-api";
import { sameAlert, type TaskAlertInput } from "@/services/task-alerts";
import { cn } from "@/lib/utils";
import { AlertFields, type AlertDraft } from "./alert-fields";

export function draftToAlert(d: AlertDraft): TaskAlertInput {
  const city = splitLocation(d.location).city ?? null;
  return {
    category: d.category === "all" ? null : d.category,
    city,
    // A municipality is more specific than an област; keep only one of them.
    region: city ? null : d.region === "all" ? null : d.region,
  };
}

/**
 * "Известявай ме" on /tasks. Opens a small dialog pre-filled with the current
 * filters, so the user confirms (or changes) what they will be notified about.
 */
export function SaveAlertButton({
  initial,
  className,
}: {
  initial: AlertDraft;
  className?: string;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const href = useRouterState({ select: (s) => s.location.href });
  const alerts = useMyTaskAlerts();
  const create = useCreateTaskAlert();
  const { data: regions = [] } = useRegions();
  const regionName = (slug: string) => regions.find((r) => r.slug === slug)?.name;

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<AlertDraft>(initial);

  const current = draftToAlert(initial);
  const saved = (alerts.data ?? []).some((a) => sameAlert(a, current));

  if (saved) {
    return (
      <Button asChild variant="outline" size="sm" className={cn("gap-2 rounded-full", className)}>
        <Link to="/settings/notifications">
          <BellRing className="h-4 w-4 text-primary" />
          Известията за това търсене са включени
        </Link>
      </Button>
    );
  }

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
          setDraft(initial);
          setOpen(true);
        }}
      >
        <Bell className="h-4 w-4" />
        Известявай ме за нови задачи
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Известия за нови задачи</DialogTitle>
            <DialogDescription>
              Всяка сутрин ще ти изпращаме новите задачи по това търсене, в приложението и по имейл.
              Ако няма нови, няма да те безпокоим.
            </DialogDescription>
          </DialogHeader>

          <AlertFields draft={draft} onChange={setDraft} idPrefix="alert-dialog" />

          <p className="rounded-xl bg-secondary/60 px-3 py-2 text-sm text-foreground">
            Ще получаваш: <strong>{taskAlertLabel(draftToAlert(draft), regionName)}</strong>
          </p>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Откажи
            </Button>
            <Button
              type="button"
              className="gap-2"
              disabled={create.isPending}
              onClick={() =>
                create.mutate(draftToAlert(draft), {
                  onSuccess: () => setOpen(false),
                  onError: (err) => {
                    if (err instanceof Error && err.message === "ALERT_EXISTS") setOpen(false);
                  },
                })
              }
            >
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
              Включи известията
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
