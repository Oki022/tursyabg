import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, MapPin, Clock, User, MessageSquare, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { mockTasks, getCategory } from "@/lib/mock-data";
import { toast } from "sonner";

export const Route = createFileRoute("/tasks/$taskId")({
  component: TaskDetail,
  notFoundComponent: () => (
    <div className="container mx-auto px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold">Задачата не е намерена</h1>
      <Button asChild className="mt-4"><Link to="/tasks">Към всички задачи</Link></Button>
    </div>
  ),
});

function TaskDetail() {
  const { taskId } = Route.useParams();
  const task = mockTasks.find((t) => t.id === taskId);
  if (!task) throw notFound();
  const cat = getCategory(task.category);
  const Icon = cat.icon;

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8 md:py-12">
      <Button asChild variant="ghost" size="sm" className="mb-4 gap-1.5">
        <Link to="/tasks"><ArrowLeft className="h-4 w-4" /> Назад към задачите</Link>
      </Button>

      <div className="grid gap-6 md:grid-cols-[1fr_320px]">
        <article className="rounded-2xl border border-border bg-card p-6 md:p-8">
          <Badge variant="secondary" className="gap-1.5">
            <Icon className="h-3.5 w-3.5" /> {cat.name}
          </Badge>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            {task.title}
          </h1>
          <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" />{task.location}</span>
            <span className="inline-flex items-center gap-1.5"><Clock className="h-4 w-4" />{task.postedAt}</span>
            <span className="inline-flex items-center gap-1.5"><User className="h-4 w-4" />{task.author}</span>
          </div>
          <div className="mt-6 border-t border-border pt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Подробности</h2>
            <p className="mt-3 whitespace-pre-line leading-relaxed text-foreground">{task.description}</p>
          </div>
        </article>

        <aside className="space-y-3 rounded-2xl border border-border bg-card p-6 md:sticky md:top-20 md:self-start">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Бюджет</div>
            <div className="mt-1 text-3xl font-bold text-foreground">{task.budget} €</div>
          </div>
          <Button className="w-full gap-2" size="lg" onClick={() => toast.success("Кандидатурата е изпратена!", { description: "Възложителят ще получи известие." })}>
            <MessageSquare className="h-4 w-4" /> Кандидатствай
          </Button>
          <Button variant="outline" className="w-full gap-2" size="lg" onClick={() => toast("Свържи се чрез чата", { description: "Първото съобщение е безплатно." })}>
            <Phone className="h-4 w-4" /> Свържи се
          </Button>
          <p className="pt-2 text-xs text-muted-foreground">
            Безопасно общуване през платформата. Не плащай извън ЗадачаНет.
          </p>
        </aside>
      </div>
    </div>
  );
}