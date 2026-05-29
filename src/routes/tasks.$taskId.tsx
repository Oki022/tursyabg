import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, MapPin, Clock, MessageSquare, Phone, ChevronLeft, ChevronRight, ShieldCheck, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getCategory } from "@/lib/mock-data";
import { useTasks } from "@/lib/tasks-context";
import { getInitials } from "@/lib/auth";
import { toast } from "sonner";

const GALLERY_BY_CATEGORY: Record<string, string[]> = {
  remonti: [
    "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1604147706283-d7119b5b822c?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1400&q=80",
  ],
  pochistvane: [
    "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&w=1400&q=80",
  ],
  prevoz: [
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=1400&q=80",
  ],
  gradina: [
    "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1599629954294-14df9ec8bc78?auto=format&fit=crop&w=1400&q=80",
  ],
  default: [
    "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1400&q=80",
  ],
};

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
  const { getTaskById } = useTasks();
  const task = getTaskById(taskId);
  if (!task) throw notFound();
  const cat = getCategory(task.category);
  const Icon = cat.icon;
  const baseImages = GALLERY_BY_CATEGORY[task.category] ?? GALLERY_BY_CATEGORY.default;
  const images = task.image
    ? [task.image, ...baseImages.filter((u) => u !== task.image)]
    : baseImages;
  const [active, setActive] = useState(0);
  const prev = () => setActive((i) => (i - 1 + images.length) % images.length);
  const next = () => setActive((i) => (i + 1) % images.length);

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6 md:py-10">
      <Button asChild variant="ghost" size="sm" className="mb-4 gap-1.5">
        <Link to="/tasks"><ArrowLeft className="h-4 w-4" /> Назад към задачите</Link>
      </Button>

      <div className="grid gap-8 md:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)]">
        {/* Left column */}
        <div className="min-w-0">
          {/* Gallery */}
          <div className="group relative overflow-hidden rounded-2xl bg-slate-100 shadow-sm ring-1 ring-black/5">
            <div className="relative h-[320px] w-full sm:h-[420px] md:h-[480px]">
              {images.map((src, i) => (
                <img
                  key={src}
                  src={src}
                  alt={`${task.title} — снимка ${i + 1}`}
                  loading={i === 0 ? "eager" : "lazy"}
                  className={`absolute inset-0 mx-auto h-full w-full object-contain transition-opacity duration-300 ${i === active ? "opacity-100" : "opacity-0"}`}
                />
              ))}
              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={prev}
                    className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-slate-900 shadow-md backdrop-blur transition hover:scale-105 hover:bg-white"
                    aria-label="Предишна снимка"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={next}
                    className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-slate-900 shadow-md backdrop-blur transition hover:scale-105 hover:bg-white"
                    aria-label="Следваща снимка"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                  <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1.5 backdrop-blur">
                    {images.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setActive(i)}
                        aria-label={`Снимка ${i + 1}`}
                        className={`h-1.5 rounded-full transition-all ${i === active ? "w-6 bg-white" : "w-1.5 bg-white/60 hover:bg-white/80"}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Title + meta */}
          <div className="mt-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="gap-1.5 rounded-full px-3 py-1">
                <Icon className="h-3.5 w-3.5" /> {cat.name}
              </Badge>
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
                <Clock className="h-3.5 w-3.5" /> {task.postedAt}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" /> {task.location}
              </span>
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
              {task.title}
            </h1>
          </div>

          {/* Description */}
          <section className="mt-8 rounded-2xl border border-border/60 bg-card p-6 md:p-7">
            <h2 className="text-lg font-semibold text-slate-900">Описание</h2>
            <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-foreground/90">
              {task.description}
            </p>
          </section>
        </div>

        {/* Right column — sticky action sidebar */}
        <aside className="md:sticky md:top-24 md:self-start">
          <div className="rounded-2xl bg-white p-6 shadow-2xl shadow-primary/10 ring-1 ring-border/60">
            <div className="flex items-baseline justify-between gap-2">
              <div>
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Бюджет</div>
                <div className="mt-1 text-3xl font-bold text-slate-900">{task.budget} €</div>
              </div>
              <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">
                Фиксиран
              </span>
            </div>

            <div className="mt-5 space-y-2.5">
              <Button
                size="lg"
                className="w-full gap-2"
                onClick={() => toast.success("Съобщението е изпратено!", { description: "Възложителят ще получи известие." })}
              >
                <MessageSquare className="h-4 w-4" /> Изпрати съобщение
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="w-full gap-2"
                onClick={() => toast("Свържи се чрез чата", { description: "Първото съобщение е безплатно." })}
              >
                <Phone className="h-4 w-4" /> Обади се
              </Button>
            </div>

            <div className="mt-5 flex items-center gap-1.5 rounded-lg bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              Безопасно общуване през платформата.
            </div>

            {/* Customer */}
            <div className="mt-6 border-t border-border/60 pt-5">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Потребител
              </div>
              <div className="mt-3 flex items-center gap-3">
                <Avatar className="h-12 w-12 border border-border">
                  <AvatarFallback className="bg-primary-soft text-sm font-semibold text-primary">
                    {getInitials(task.author)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-900">{task.author}</div>
                  <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Член от 2026 г.
                  </div>
                </div>
              </div>
            </div>

            {/* Location */}
            <div className="mt-6 border-t border-border/60 pt-5">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Локация
              </div>
              <div
                className="relative mt-3 h-32 overflow-hidden rounded-xl ring-1 ring-border/60"
                style={{
                  backgroundImage:
                    "linear-gradient(135deg, oklch(0.97 0.01 250), oklch(0.93 0.02 200)), repeating-linear-gradient(0deg, transparent 0 19px, oklch(0.88 0.02 230 / 0.5) 19px 20px), repeating-linear-gradient(90deg, transparent 0 19px, oklch(0.88 0.02 230 / 0.5) 19px 20px)",
                  backgroundBlendMode: "multiply, normal, normal",
                }}
              >
                <div className="absolute inset-0 grid place-items-center">
                  <div className="flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 text-sm font-medium text-slate-900 shadow-md ring-1 ring-border/60">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                    </span>
                    {task.location}
                  </div>
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Показва се само кварталът. Точният адрес е скрит.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}