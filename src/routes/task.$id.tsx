import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  MessageSquare,
  Phone,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { getInitials, useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { getCategory } from "@/lib/mock-data";
import { useTask } from "@/lib/tasks-api";
import { toast } from "sonner";

const GALLERY_BY_CATEGORY: Record<string, string[]> = {
  remonti: [
    "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1604147706283-d7119b5b822c?auto=format&fit=crop&w=1400&q=80",
  ],
  pochistvane: [
    "https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&w=1400&q=80",
  ],
  prevoz: [
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=1400&q=80",
  ],
  gradina: [
    "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?auto=format&fit=crop&w=1400&q=80",
  ],
  default: [
    "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=1400&q=80",
  ],
};

export const Route = createFileRoute("/task/$id")({
  component: TaskDetails,
  notFoundComponent: () => (
    <div className="container mx-auto px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold text-slate-900">Задачата не е намерена</h1>
      <Button asChild className="mt-4">
        <Link to="/tasks">Назад</Link>
      </Button>
    </div>
  ),
});

function TaskDetails() {
  const { id } = Route.useParams();
  const { data: task, isLoading } = useTask(id);
  const { user } = useAuth();
  const [active, setActive] = useState(0);
  const [messageOpen, setMessageOpen] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-6xl px-4 py-10">
        <div className="h-[320px] w-full animate-pulse rounded-3xl bg-muted sm:h-[420px]" />
        <div className="mt-6 h-8 w-2/3 animate-pulse rounded bg-muted" />
        <div className="mt-3 h-4 w-full animate-pulse rounded bg-muted" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        <h1 className="text-2xl font-semibold text-slate-900">Задачата не е намерена</h1>
        <Button asChild className="mt-4">
          <Link to="/tasks">Назад</Link>
        </Button>
      </div>
    );
  }

  const cat = getCategory(task.category);
  const Icon = cat.icon;
  const baseImages = GALLERY_BY_CATEGORY[task.category] ?? GALLERY_BY_CATEGORY.default;
  const images = task.gallery && task.gallery.length > 0 ? task.gallery : baseImages;

  const prev = () => setActive((index) => (index - 1 + images.length) % images.length);
  const next = () => setActive((index) => (index + 1) % images.length);

  const handleSendMessage = async () => {
    if (!messageText.trim()) {
      toast.error("Моля въведете съобщение");
      return;
    }
    if (!user) {
      toast.error("Влез в профила си, за да изпратиш съобщение.");
      return;
    }
    if (!task.userId) return;
    setSending(true);
    const { error } = await supabase.from("messages").insert({
      task_id: task.id,
      sender_id: user.id,
      receiver_id: task.userId,
      content: messageText.trim(),
    });
    setSending(false);
    if (error) {
      toast.error("Съобщението не беше изпратено.");
      return;
    }
    setMessageOpen(false);
    setMessageText("");
    toast.success("✅ Съобщението е изпратено успешно!", {
      description: `${task.author} ще получи известие.`,
    });
  };

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6 md:py-10">
      <Button asChild variant="ghost" size="sm" className="mb-5 gap-1.5">
        <Link to="/tasks">
          <ArrowLeft className="h-4 w-4" /> Назад
        </Link>
      </Button>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.75fr)_minmax(320px,0.8fr)]">
        <div className="min-w-0">
          <div className="group relative overflow-hidden rounded-3xl bg-slate-100 shadow-xl shadow-primary/10 ring-1 ring-border/60">
            <div className="relative h-[320px] w-full sm:h-[420px] lg:h-[520px]">
              {images.map((src, index) => (
                <img
                  key={src}
                  src={src}
                  alt={`${task.title} — снимка ${index + 1}`}
                  loading={index === 0 ? "eager" : "lazy"}
                  className={`absolute inset-0 mx-auto h-full w-full object-contain transition-opacity duration-300 ${index === active ? "opacity-100" : "opacity-0"}`}
                />
              ))}
              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={prev}
                    className="absolute left-4 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/95 text-slate-900 shadow-lg backdrop-blur transition hover:scale-105"
                    aria-label="Предишна снимка"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={next}
                    className="absolute right-4 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/95 text-slate-900 shadow-lg backdrop-blur transition hover:scale-105"
                    aria-label="Следваща снимка"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                  <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-slate-900/50 px-3 py-2 backdrop-blur">
                    {images.map((_, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => setActive(index)}
                        aria-label={`Снимка ${index + 1}`}
                        className={`h-1.5 rounded-full transition-all ${index === active ? "w-7 bg-white" : "w-1.5 bg-white/60 hover:bg-white"}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-2">
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

          <section className="mt-8 rounded-3xl border border-border/60 bg-card p-6 shadow-sm md:p-7">
            <h2 className="text-lg font-semibold text-slate-900">Описание</h2>
            <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-foreground/90">
              {task.description}
            </p>
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-3xl bg-white p-6 shadow-2xl shadow-primary/15 ring-1 ring-border/60">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Бюджет
            </div>
            <div className="mt-2 flex items-end justify-between gap-3">
              <div className="text-4xl font-bold text-slate-900">{task.budget} €</div>
              <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
                Фиксиран
              </span>
            </div>

            <div className="mt-6 space-y-3">
              <Button
                size="lg"
                variant="outline"
                className="w-full gap-2"
                onClick={() => toast("Свържи се чрез чата", { description: "Първото съобщение е безплатно." })}
              >
                <Phone className="h-4 w-4" /> Обади се
              </Button>
              <Button
                size="lg"
                className="w-full gap-2"
                onClick={() => setMessageOpen(true)}
              >
                <MessageSquare className="h-4 w-4" /> Изпрати съобщение
              </Button>
            </div>

            <div className="mt-5 flex items-center gap-1.5 rounded-2xl bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              Безопасно общуване през платформата.
            </div>

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
                    <CalendarDays className="h-3.5 w-3.5" /> Член от 2026 г.
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 border-t border-border/60 pt-5">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Локация
              </div>
              <div className="relative mt-3 h-32 overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-border/60">
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(15,23,42,0.06)_1px,transparent_1px),linear-gradient(0deg,rgba(15,23,42,0.06)_1px,transparent_1px)] bg-[size:24px_24px]" />
                <div className="absolute inset-0 grid place-items-center">
                  <div className="flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 text-sm font-medium text-slate-900 shadow-md ring-1 ring-border/60">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                    </span>
                    {task.location}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <Dialog open={messageOpen} onOpenChange={setMessageOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl">
              Изпрати съобщение до {task.author}
            </DialogTitle>
            <DialogDescription>
              Започнете разговор относно тази задача.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl bg-slate-100 px-4 py-3 ring-1 ring-border/60">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Задача
            </div>
            <div className="mt-1 line-clamp-2 text-sm font-semibold text-slate-900">
              {task.title}
            </div>
          </div>

          <Textarea
            value={messageText}
            onChange={(event) => setMessageText(event.target.value)}
            placeholder="Напишете вашето съобщение тук..."
            rows={6}
            className="resize-none"
          />

          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <ShieldAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
            <p className="leading-relaxed">
              <span className="font-semibold">За вашата сигурност</span>, общувайте и плащайте само през платформата.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setMessageOpen(false)}
              className="sm:flex-1"
            >
              Отказ
            </Button>
            <Button onClick={handleSendMessage} disabled={sending} className="sm:flex-1 gap-2">
              <MessageSquare className="h-4 w-4" /> Изпрати
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}