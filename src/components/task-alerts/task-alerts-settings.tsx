import { useState } from "react";
import { BellRing, Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertFields, type AlertDraft } from "@/components/task-alerts/alert-fields";
import { draftToAlert } from "@/components/task-alerts/save-alert-button";
import { useRegions } from "@/lib/locations-api";
import {
  taskAlertLabel,
  useCreateTaskAlert,
  useDeleteTaskAlert,
  useMyTaskAlerts,
} from "@/lib/task-alerts-api";
import { MAX_TASK_ALERTS } from "@/services/task-alerts";

/** Settings → Нотификации: the user's saved searches. */
export function TaskAlertsSettings() {
  const alerts = useMyTaskAlerts();
  const create = useCreateTaskAlert();
  const remove = useDeleteTaskAlert();
  const { data: regions = [] } = useRegions();
  const regionName = (slug: string) => regions.find((r) => r.slug === slug)?.name;

  const empty: AlertDraft = { category: "all", region: "all", location: undefined };
  const [draft, setDraft] = useState<AlertDraft>(empty);

  const list = alerts.data ?? [];
  const full = list.length >= MAX_TASK_ALERTS;

  const add = () => {
    create.mutate(draftToAlert(draft), { onSuccess: () => setDraft(empty) });
  };

  return (
    <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm md:p-6">
      <div className="flex items-center gap-2">
        <BellRing className="h-4 w-4 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Известия за нови задачи</h2>
      </div>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Избери категория и място. Всяка сутрин ще получиш едно съобщение в приложението и по имейл,
        ако има нови задачи. Ако няма, няма да те безпокоим.
      </p>

      {alerts.isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">Зареждане...</p>
      ) : list.length === 0 ? (
        <p className="mt-4 rounded-xl bg-secondary/60 px-3 py-2.5 text-sm text-muted-foreground">
          Все още нямаш известия. Добави първото по-долу или от страницата със задачи с бутона
          „Известявай ме“.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border/60 rounded-xl border border-border/60">
          {list.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <span className="min-w-0 truncate text-sm text-foreground">{taskAlertLabel(a, regionName)}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 shrink-0 gap-1.5 text-muted-foreground hover:text-destructive"
                disabled={remove.isPending}
                onClick={() => remove.mutate(a.id)}
                aria-label={`Изтрий известието ${taskAlertLabel(a, regionName)}`}
              >
                <Trash2 className="h-4 w-4" />
                Изтрий
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 border-t border-border/60 pt-5">
        <p className="mb-3 text-sm font-medium text-foreground">Ново известие</p>
        <AlertFields draft={draft} onChange={setDraft} idPrefix="alert-settings" />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Ще получаваш: <span className="font-medium text-foreground">{taskAlertLabel(draftToAlert(draft), regionName)}</span>
          </p>
          <Button type="button" className="gap-2" disabled={create.isPending || full} onClick={add}>
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Добави
          </Button>
        </div>
      </div>
      {full && (
        <p className="mt-2 text-xs text-muted-foreground">
          Достигна максимума от {MAX_TASK_ALERTS} известия. Изтрий някое, за да добавиш ново.
        </p>
      )}
    </section>
  );
}
