import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TaskCard, TaskCardSkeleton } from "@/components/task-card";
import { LocationCombobox } from "@/components/location-combobox";
import { categories, getCategory } from "@/lib/mock-data";
import { useTasksFeed } from "@/lib/tasks-api";
import { useMunicipalities, useRegionCounts, useRegions } from "@/lib/locations-api";
import { formatLocation, municipalityLabel, splitLocation } from "@/lib/locations";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { clampDescription, seo } from "@/lib/seo";

type Search = { q?: string; category?: string; location?: string; region?: string; from?: "home" };

export const Route = createFileRoute("/tasks")({
  head: ({ match }) => {
    const s = (match.search ?? {}) as Search;
    const cat = s.category ? getCategory(s.category).name : undefined;
    const city = s.location ? s.location.split(",")[0]!.trim() : undefined;
    const label = [cat, city ? `в ${municipalityLabel(city)}` : undefined].filter(Boolean).join(" ");

    return seo({
      title: label ? `${label}, намери работа` : "Намери работа, активни задачи",
      description: clampDescription(
        label
          ? `Намери работа за ${label}. Свържи се директно със заявителя, договори цена в евро и виж реални отзиви преди да започнеш работа.`
          : "Намери работа при хора от цяла България, ремонти, почистване, превоз, уроци и още. Разгледай актуалните задачи и се свържи директно.",
      ),
      path: "/tasks",
    });
  },
  validateSearch: (s: Record<string, unknown>): Search => ({
    q: typeof s.q === "string" ? s.q : undefined,
    category: typeof s.category === "string" ? s.category : undefined,
    location: typeof s.location === "string" ? s.location : undefined,
    region: typeof s.region === "string" ? s.region : undefined,
    from: s.from === "home" ? "home" : undefined,
  }),
  component: TasksPage,
});

function TasksPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [query, setQuery] = useState(search.q ?? "");
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useTasksFeed({
    q: search.q,
    category: search.category,
    location: search.location,
    region: search.region,
  });
  const filtered = data?.pages.flatMap((p) => p.items) ?? [];
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const resultsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (search.from !== "home" || !resultsRef.current || typeof window === "undefined") return;

    const mobile = window.matchMedia("(max-width: 767px)").matches;
    if (!mobile) return;
    const timer = window.setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [search.from]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && !isFetchingNextPage) void fetchNextPage();
    }, { rootMargin: "400px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const update = (next: Partial<Search>) =>
    navigate({ search: (prev: Search) => ({ ...prev, ...next }) });

  const activeFilters = [search.category, search.location, search.region, search.q].filter(Boolean).length;

  const { data: regions = [] } = useRegions();
  const { data: municipalities = [] } = useMunicipalities();
  const selectedCity = splitLocation(search.location).city;
  const selectedMunicipality = municipalities.find((m) => m.name === selectedCity);
  // Fallback suggestions come from the област of the selected община, or from
  // the explicitly chosen област, so an empty result never looks like a dead site.
  const fallbackRegion = selectedMunicipality?.regionSlug ?? search.region;
  const { data: regionCounts = [] } = useRegionCounts(fallbackRegion, search.category);
  const nearby = regionCounts
    .filter((c) => c.taskCount > 0 && c.name !== selectedCity)
    .slice(0, 8);
  const fallbackRegionName = regions.find((r) => r.slug === fallbackRegion)?.name;

  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <div className="mb-6">
        <div ref={resultsRef} data-results-anchor className="scroll-mt-20">
          <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Борса за работа
          </h1>
          <p className="mt-2 text-muted-foreground">
            {isLoading ? "Зареждане..." : `${filtered.length}${hasNextPage ? "+" : ""} ${filtered.length === 1 ? "активна задача" : "активни задачи"}`}
          </p>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); update({ q: query || undefined }); }}
          className="mt-4 flex w-full max-w-[640px] items-center gap-2 rounded-full border border-border/60 bg-card p-1.5 pl-4 shadow-sm"
        >
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Търси по ключова дума..."
            className="h-9 min-w-0 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
          <Button type="submit" className="shrink-0 rounded-full px-5">Търси</Button>
        </form>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr] lg:gap-5">

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
              Област
            </h3>
            <Select
              value={search.region ?? "all"}
              onValueChange={(v) => update({ region: v === "all" ? undefined : v })}
            >
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Всички области" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Всички области</SelectItem>
                {regions.map((r) => (
                  <SelectItem key={r.slug} value={r.slug}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Община или квартал
            </h3>
            <LocationCombobox
              value={search.location}
              onChange={(v) => update({ location: v })}
              allowClear
            />
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
              {search.location && (
                <Badge variant="secondary" className="gap-1.5">
                  {formatLocation(search.location)}

                  <button onClick={() => update({ location: undefined })}><X className="h-3 w-3" /></button>
                </Badge>
              )}
              {search.region && (
                <Badge variant="secondary" className="gap-1.5">
                  обл. {regions.find((r) => r.slug === search.region)?.name ?? search.region}
                  <button onClick={() => update({ region: undefined })}><X className="h-3 w-3" /></button>
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

          {isLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => <TaskCardSkeleton key={i} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
              <p className="text-foreground font-medium">Няма намерени задачи</p>
              <p className="mt-1 text-sm text-muted-foreground">Опитай с по-малко филтри или публикувай своя задача.</p>
              {nearby.length > 0 && (
                <div className="mt-6 text-left">
                  <p className="text-sm font-medium text-foreground">
                    Задачи в близки общини{fallbackRegionName ? `, област ${fallbackRegionName}` : ""}
                  </p>
                  <ul className="mt-3 flex flex-wrap justify-center gap-2">
                    {nearby.map((c) => (
                      <li key={c.slug}>
                        <Link
                          to="/city/$city"
                          params={{ city: c.slug }}
                          className="inline-flex rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                        >
                          {municipalityLabel(c.name)} ({c.taskCount})
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <Button asChild className="mt-6">
                <Link to="/post">Възложи работа</Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 xl:grid-cols-4">
                {filtered.map((t) => <TaskCard key={t.id} task={t} />)}
                {isFetchingNextPage && Array.from({ length: 4 }).map((_, i) => <TaskCardSkeleton key={`s${i}`} />)}
              </div>
              <div ref={sentinelRef} className="h-10" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}