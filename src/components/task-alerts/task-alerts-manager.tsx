import { useState } from "react";
import { BellRing, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRegions } from "@/lib/locations-api";
import {
  taskAlertLabel,
  useCreateTaskAlert,
  useDeleteTaskAlert,
  useMyTaskAlerts,
} from "@/lib/task-alerts-api";
import { MAX_TASK_ALERTS, sameAlert } from "@/services/task-alerts";
import { cn } from "@/lib/utils";
import { AlertFields, EMPTY_DRAFT, draftToAlert, isNarrow, type AlertDraft } from "./alert-fields";

/**
 * The user's saved searches: list with delete, plus a form to add one.
 * Used on the /tasks dialog (form pre-filled with the page filters) and on the
 * settings page (form collapsed until the user asks for it).
 */
export function TaskAlertsManager({
  initialDraft = EMPTY_DRAFT,
  formInitiallyOpen,
  idPrefix,
  inDialog = false,
}: {
  initialDraft?: AlertDraft;
  formInitiallyOpen: boolean;
  idPrefix: string;
  inDialog?: boolean;
}) {
  const alerts = useMyTaskAlerts();
  const create = useCreateTaskAlert();
  const remove = useDeleteTaskAlert();
  const { data: regions = [] } = useRegions();
  const regionName = (slug: string) => regions.find((r) => r.slug === slug)?.name;

  const list = alerts.data ?? [];
  const full = list.length >= MAX_TASK_ALERTS;

  const [formOpen, setFormOpen] = useState(formInitiallyOpen);
  const [draft, setDraft] = useState<AlertDraft>(initialDraft);

  const candidate = draftToAlert(draft);
  const narrow = isNarrow(candidate);
  const duplicate = list.some((a) => sameAlert(a, candidate));
  const canSave = narrow && !duplicate && !full && !create.isPending;

  const save = () => {
    if (!canSave) return;
    create.mutate(candidate, {
      onSuccess: () => {
        setDraft(EMPTY_DRAFT);
        setFormOpen(false);
      },
    });
  };

  return (
    <div className="grid gap-4">
      <div>
        <p className="mb-2 text-sm font-medium text-foreground">
          Твоите известия{list.length > 0 ? ` (${list.length}/${MAX_TASK_ALERTS})` : ""}
        </p>
        {alerts.isLoading ? (
          <p className="text-sm text-muted-foreground">Зареждане...</p>
        ) : list.length === 0 ? (
          <p className="rounded-xl bg-secondary/60 px-3 py-2.5 text-sm text-muted-foreground">
            Още нямаш известия.
          </p>
        ) : (
          <ul className="max-h-48 divide-y divide-border/60 overflow-y-auto rounded-xl border border-border/60">
            {list.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="flex min-w-0 items-center gap-2 text-sm text-foreground">
                  <BellRing className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="truncate">{taskAlertLabel(a, regionName)}</span>
                </span>
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
      </div>

      {!formOpen ? (
        <Button
          type="button"
          variant="outline"
          className="w-full gap-2 sm:w-auto sm:justify-self-start"
          disabled={full}
          onClick={() => setFormOpen(true)}
        >
          <Plus className="h-4 w-4" />
          Ново известие
        </Button>
      ) : (
        <div className={cn("grid gap-3 rounded-xl border border-border/60 p-3", inDialog ? "" : "bg-secondary/30")}>
          <p className="text-sm font-medium text-foreground">Ново известие</p>
          <AlertFields draft={draft} onChange={setDraft} idPrefix={idPrefix} inDialog={inDialog} />
          <p className="text-sm text-muted-foreground">
            {narrow ? (
              <>
                Ще получаваш: <span className="font-medium text-foreground">{taskAlertLabel(candidate, regionName)}</span>
              </>
            ) : (
              "Избери категория или място, за да не получаваш всички нови задачи в страната."
            )}
          </p>
          {duplicate && narrow && (
            <p className="text-sm text-primary">Вече имаш това известие.</p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setDraft(EMPTY_DRAFT);
                setFormOpen(false);
              }}
            >
              Откажи
            </Button>
            <Button type="button" className="gap-2" disabled={!canSave} onClick={save}>
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
              Включи известията
            </Button>
          </div>
        </div>
      )}

      {full && (
        <p className="text-xs text-muted-foreground">
          Достигна максимума от {MAX_TASK_ALERTS} известия. Изтрий някое, за да добавиш ново.
        </p>
      )}
    </div>
  );
}
