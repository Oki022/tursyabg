import { createFileRoute, Link } from "@tanstack/react-router";
import { BellRing, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BackLink } from "@/components/back-link";
import { TaskCard, TaskCardSkeleton } from "@/components/task-card";
import { useMyAlertTasks } from "@/lib/alert-tasks-api";
import { pageTitle } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/alerts")({
  head: () => ({
    meta: [
      { title: pageTitle("Нови задачи за теб") },
      { name: "description", content: "Задачите, които отговарят на твоите известия." },
    ],
  }),
  component: AlertTasksPage,
});

function AlertTasksPage() {
  const { data: items = [], isLoading, isError, refetch } = useMyAlertTasks();

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6 md:py-10">
      <BackLink />
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">Нови задачи за теб</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Задачите от последните 14 дни, които отговарят на твоите известия. Най-новите са най-отгоре.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/settings/notifications">Управлявай известията</Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <TaskCardSkeleton key={i} />
          ))}
        </div>
      ) : isError ? (
        <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-border/60 bg-card p-8 text-center">
          <TriangleAlert className="h-6 w-6 text-destructive" />
          <p className="text-sm text-muted-foreground">Задачите не се заредиха.</p>
          <Button variant="outline" onClick={() => refetch()}>
            Опитай пак
          </Button>
        </div>
      ) : items.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-muted/30 p-10 text-center">
          <BellRing className="mx-auto mb-3 h-8 w-8 text-muted-foreground opacity-60" />
          <p className="text-sm font-medium text-foreground">Все още няма нови задачи по твоите известия.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Щом се появи подходяща задача, ще ти пишем по имейл и тук.
          </p>
          <Button asChild className="mt-4">
            <Link to="/tasks">Разгледай всички задачи</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}
