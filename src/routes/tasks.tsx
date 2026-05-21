import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, MapPin, SlidersHorizontal, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TaskCard } from "@/components/task-card";
import { categories, cities, mockTasks, getCategory } from "@/lib/mock-data";

type Search = { q?: string; category?: string; city?: string };

export const Route = createFileRoute("/tasks")({
  head: () => ({
    meta: [
      { title: "Активни задачи — ЗадачаНет" },
      { name: "description", content: "Разгледай актуалните задачи и проекти от хора в България." },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): Search => ({
    q: typeof s.q === "string" ? s.q : undefined,
    category: typeof s.category === "string" ? s.category : undefined,
    city: typeof s.city === "string" ? s.city : undefined,
  }),
  component: TasksPage,
});

function TasksPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [query, setQuery] = useState(search.q ?? "");

  const filtered = useMemo(() => {
    return mockTasks.filter((t) => {
      if (search.category && t.category !== search.category) return false;
      if (search.city && t.city !== search.city) return false;
      if (search.q) {
        const q = search.q.toLowerCase();
        if (!t.title.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [search]);

  const update = (next: Partial<Search>) =>
    navigate({ search: (prev: Search) => ({ ...prev, ...next }) });

  const activeFilters = [search.category, search.city, search.q].filter(Boolean).length;

  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          Борса за задачи
        </h1>
        <p className="mt-2 text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? "активна задача" : "активни задачи"}
        </p>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); update({ q: query || undefined }); }}
        className="mb-6 flex items-center gap-2 rounded-xl border border-border bg-card p-2 shadow-sm"
      >
        <Search className="ml-2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Търси по ключова дума..."
          className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
        />
        <Button type="submit" size="sm">Търси</Button>
      </form>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
        {/* Sidebar */}
        <aside className="space-y-6 rounded-2xl border border-border bg-card p-5 lg:sticky lg:top-20 lg:self-start">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <SlidersHorizontal className="h-4 w-4" /> Филтри
            </h2>
            {activeFilters > 0 && (
              <button
                onClick={() => navigate({ search: {} })}
                className="text-xs text-primary hover:underline"
              >
                Изчисти
              </button>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Категория
            </h3>
            <div className="space-y-1">
              {categories.map((c) => {
                const active = search.category === c.id;
                const Icon = c.icon;
                return (
                  <button
                    key={c.id}
                    onClick={() => update({ category: active ? undefined : c.id })}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${active ? "bg-primary/10 text-primary font-medium" : "text-foreground hover:bg-secondary"}`}
                  >
                    <Icon className="h-4 w-4" />
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Населено място
            </h3>
            <div className="space-y-1">
              {cities.map((city) => {
                const active = search.city === city;
                return (
                  <button
                    key={city}
                    onClick={() => update({ city: active ? undefined : city })}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${active ? "bg-primary/10 text-primary font-medium" : "text-foreground hover:bg-secondary"}`}
                  >
                    <MapPin className="h-4 w-4" />
                    {city}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Results */}
        <div>
          {activeFilters > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {search.category && (
                <Badge variant="secondary" className="gap-1.5">
                  {getCategory(search.category).name}
                  <button onClick={() => update({ category: undefined })}><X className="h-3 w-3" /></button>
                </Badge>
              )}
              {search.city && (
                <Badge variant="secondary" className="gap-1.5">
                  {search.city}
                  <button onClick={() => update({ city: undefined })}><X className="h-3 w-3" /></button>
                </Badge>
              )}
              {search.q && (
                <Badge variant="secondary" className="gap-1.5">
                  „{search.q}"
                  <button onClick={() => { setQuery(""); update({ q: undefined }); }}><X className="h-3 w-3" /></button>
                </Badge>
              )}
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
              <p className="text-foreground font-medium">Няма намерени задачи</p>
              <p className="mt-1 text-sm text-muted-foreground">Опитай с по-малко филтри или публикувай своя задача.</p>
              <Button asChild className="mt-4">
                <Link to="/post">Възложи задача</Link>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {filtered.map((t) => <TaskCard key={t.id} task={t} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}