import { useState } from "react";
import { BellRing, Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LocationCombobox } from "@/components/location-combobox";
import { categories } from "@/lib/mock-data";
import { splitLocation } from "@/lib/locations";
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

  const [category, setCategory] = useState<string>("all");
  const [location, setLocation] = useState<string | undefined>(undefined);

  const list = alerts.data ?? [];
  const full = list.length >= MAX_TASK_ALERTS;

  const add = () => {
    create.mutate(
      {
        category: category === "all" ? null : category,
        city: splitLocation(location).city ?? null,
      },
      {
        onSuccess: () => {
          setCategory("all");
          setLocation(undefined);
        },
      },
    );
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

      <div className="mt-5 grid gap-3 border-t border-border/60 pt-5 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <div className="grid gap-1.5">
          <Label htmlFor="alert-category">Категория</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger id="alert-category" className="h-10">
              <SelectValue placeholder="Всички категории" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Всички категории</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="alert-location">Община</Label>
          <LocationCombobox id="alert-location" value={location} onChange={setLocation} allowClear placeholder="Цяла България" />
        </div>
        <Button type="button" className="h-10 gap-2" disabled={create.isPending || full} onClick={add}>
          {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Добави
        </Button>
      </div>
      {full && (
        <p className="mt-2 text-xs text-muted-foreground">
          Достигна максимума от {MAX_TASK_ALERTS} известия. Изтрий някое, за да добавиш ново.
        </p>
      )}
    </section>
  );
}
