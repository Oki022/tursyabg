import { BellRing } from "lucide-react";
import { TaskAlertsManager } from "./task-alerts-manager";

/** Settings → Нотификации: the user's saved searches, compact by default. */
export function TaskAlertsSettings() {
  return (
    <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm md:p-6">
      <div className="flex items-center gap-2">
        <BellRing className="h-4 w-4 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Известия за нови задачи</h2>
      </div>
      <p className="mb-4 mt-1.5 text-sm text-muted-foreground">
        Проверяваме за нови задачи по търсенията ти на всеки 30 минути (7:00–22:00). Известието в
        приложението идва веднага. Ако не го отвориш до 3 часа, пращаме и имейл, най-много веднъж
        на 3 часа.
      </p>
      <TaskAlertsManager formInitiallyOpen={false} idPrefix="alert-settings" />
    </section>
  );
}
