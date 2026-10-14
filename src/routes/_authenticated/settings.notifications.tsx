import { TaskAlertsSettings } from "@/components/task-alerts/task-alerts-settings";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { SettingsPageShell } from "@/components/settings-page-shell";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/auth";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  NOTIFICATION_GROUPS,
  getMyNotificationPreferences,
  setMyNotificationPreferences,
  type NotificationGroup,
  type NotificationPreferences,
} from "@/services/notification-preferences";

export const Route = createFileRoute("/_authenticated/settings/notifications")({
  head: () => ({
    meta: [
      { title: "Нотификации | ТърсяБГ" },
      { name: "description", content: "Избери за какво да получаваш известия по имейл и в приложението." },
      { property: "og:title", content: "Нотификации | ТърсяБГ" },
      { property: "og:description", content: "Управлявай своите известия в ТърсяБГ." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsNotificationsPage,
});

function SettingsNotificationsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const prefsQuery = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: getMyNotificationPreferences,
  });
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);

  useEffect(() => {
    if (prefsQuery.data) setPrefs(prefsQuery.data);
  }, [prefsQuery.data]);

  const save = useMutation({
    mutationFn: (next: NotificationPreferences) => {
      if (!user?.id) throw new Error("Липсва профил.");
      return setMyNotificationPreferences(user.id, next);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notification-preferences"] });
      toast.success("Настройките са запазени.");
    },
    onError: () => {
      if (prefsQuery.data) setPrefs(prefsQuery.data);
      toast.error("Настройките не бяха запазени. Опитай отново.");
    },
  });

  const toggle = (key: NotificationGroup, value: boolean) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    save.mutate(next);
  };

  return (
    <SettingsPageShell
      title="Нотификации"
      description="Избери за какво да получаваш известия. Промените се запазват веднага."
    >
      <TaskAlertsSettings />

      <div className="divide-y divide-border/60 rounded-2xl border border-border/60 bg-card shadow-sm">
        {NOTIFICATION_GROUPS.map((group) => (
          <div key={group.key} className="flex items-start justify-between gap-4 p-4 md:p-5">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{group.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{group.description}</p>
            </div>
            <Switch
              checked={prefs[group.key]}
              disabled={prefsQuery.isLoading}
              onCheckedChange={(v) => toggle(group.key, v)}
              aria-label={`Известия: ${group.title}`}
            />
          </div>
        ))}
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-border/60 bg-muted/40 p-4 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p>
          Важните известия винаги се получават и не могат да бъдат изключени. Това са решенията на
          модерацията, спирането или блокирането на профил, връщането на точки и заявките за изтриване
          на профил.
        </p>
      </div>
    </SettingsPageShell>
  );
}
