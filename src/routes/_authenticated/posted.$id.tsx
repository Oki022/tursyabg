import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Clock, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskCard } from "@/components/task-card";
import { PromoPicker } from "@/components/promotions/promo-picker";
import { useTask } from "@/lib/tasks-api";

export const Route = createFileRoute("/_authenticated/posted/$id")({
  head: () => ({
    meta: [
      { title: "Задачата е публикувана — Търся" },
      {
        name: "description",
        content: "Задачата ти е публикувана успешно. Промотирай я, за да получиш повече оферти от майстори.",
      },
      { property: "og:title", content: "Задачата е публикувана — Търся" },
      { property: "og:description", content: "Промотирай новата си задача за повече прегледания и оферти." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PostedPage,
});

function PostedPage() {
  const { id } = Route.useParams();
  const { data: task } = useTask(id);
  const pending = task?.status === "pending";

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8 md:py-12">
      <div className="text-center">
        <span
          className={`mx-auto grid h-14 w-14 place-items-center rounded-2xl ${
            pending ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
          }`}
        >
          {pending ? <Clock className="h-7 w-7" /> : <CheckCircle2 className="h-7 w-7" />}
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
          {pending ? "Задачата ти чака одобрение" : "🎉 Задачата ти е публикувана!"}
        </h1>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
          {pending
            ? "Първата задача от нов профил минава през кратка проверка от нашия екип. Обикновено отнема до няколко часа — ще получиш известие веднага щом стане публична."
            : "Вече е видима в борсата и е напълно безплатна. Ако искаш повече оферти, промотирай я още сега."}
        </p>
      </div>

      {task && (
        <div className="mx-auto mt-8 max-w-sm">
          <div className="mb-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Твоята задача
          </div>
          <TaskCard task={task} />
        </div>
      )}

      {!pending && (
      <section className="mt-10 rounded-2xl border border-border bg-card p-5 md:p-6">
        <div className="flex items-center gap-2">
          <Rocket className="h-4 w-4 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Искаш ли повече оферти?</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Избери промоция — плащането е еднократно и защитено.
        </p>
        <div className="mt-4">
          <PromoPicker taskId={id} />
        </div>
      </section>
      )}

      <div className="mt-6 flex flex-col items-center gap-3">
        <Button asChild variant="outline" className="w-full sm:w-auto">
          <Link to="/task/$id" params={{ id }}>
            Виж задачата
          </Link>
        </Button>
        <Link to="/tasks" className="text-sm text-muted-foreground underline hover:text-foreground">
          {pending ? "Разгледай други задачи" : "Продължи без промоция"}
        </Link>
      </div>
    </div>
  );
}
