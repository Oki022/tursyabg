import { createFileRoute } from "@tanstack/react-router";
import { Link, useNavigate } from "@tanstack/react-router";
import { Search, Plus, Briefcase, ShieldCheck, Zap, ArrowRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TaskCard } from "@/components/task-card";
import { mockTasks, categories } from "@/lib/mock-data";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const recent = mockTasks.slice(0, 6);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({ to: "/tasks", search: query ? { q: query } : undefined });
  };

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/60 bg-gradient-to-b from-primary/5 via-background to-background">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
              <Zap className="h-3.5 w-3.5 text-primary" />
              Над 1 200 активни задачи в България
            </span>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-foreground md:text-6xl">
              Какво трябва да се свърши днес?
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">
              Опиши задачата си и намери точния човек, който да я изпълни.
            </p>

            <form onSubmit={onSearch} className="mx-auto mt-8 flex max-w-2xl flex-col gap-2 rounded-3xl border border-border/60 bg-card p-2 shadow-2xl shadow-primary/10 ring-1 ring-black/[0.02] sm:flex-row sm:items-center sm:rounded-full sm:pl-3">
              <div className="flex flex-1 items-center gap-2 px-3">
                <Search className="h-5 w-5 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Напр. ремонт на баня, почистване, преместване..."
                  className="h-11 border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0"
                />
              </div>
              <Button type="submit" size="lg">Търси</Button>
            </form>

            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="w-full gap-2 sm:w-auto">
                <Link to="/post"><Plus className="h-4 w-4" /> Възложи задача</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="w-full gap-2 sm:w-auto">
                <Link to="/tasks"><Briefcase className="h-4 w-4" /> Намери задачи</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="container mx-auto px-4 py-12">
        <h2 className="mb-6 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Популярни категории
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9">
          {categories.map((c) => {
            const Icon = c.icon;
            return (
              <Link
                key={c.id}
                to="/tasks"
                search={{ category: c.id }}
                className="group flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 text-center transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm"
              >
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="text-xs font-medium text-foreground">{c.name}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Recent tasks */}
      <section className="container mx-auto px-4 py-12">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              Последни задачи
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Най-новите проекти, които чакат да бъдат изпълнени.
            </p>
          </div>
          <Button asChild variant="ghost" className="gap-1">
            <Link to="/tasks">Виж всички <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recent.map((t) => <TaskCard key={t.id} task={t} />)}
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-border/60 bg-secondary/40">
        <div className="container mx-auto px-4 py-16">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Как работи</h2>
            <p className="mt-2 text-sm text-muted-foreground">Три прости стъпки до свършена работа.</p>
          </div>
          <div className="mx-auto mt-10 grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-3">
            {[
              { icon: Plus, title: "1. Опиши задачата", desc: "Кажи какво трябва да се направи, кога и за какъв бюджет." },
              { icon: Briefcase, title: "2. Получи предложения", desc: "Подходящи изпълнители ще ти пишат с цени и въпроси." },
              { icon: ShieldCheck, title: "3. Избери и плати", desc: "Избери най-подходящия и плати само когато си доволен." },
            ].map((s) => (
              <div key={s.title} className="rounded-2xl border border-border bg-card p-6">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-primary-foreground">
                  <s.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-base font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
