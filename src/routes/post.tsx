import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { categories, cities, detectCategory } from "@/lib/mock-data";
import { toast } from "sonner";

export const Route = createFileRoute("/post")({
  head: () => ({
    meta: [
      { title: "Възложи задача — ЗадачаНет" },
      { name: "description", content: "Опиши своята задача и я публикувай за минути. Получи предложения от подходящи изпълнители." },
    ],
  }),
  component: PostPage,
});

function PostPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [city, setCity] = useState<string | undefined>(undefined);
  const [autoPicked, setAutoPicked] = useState(false);
  const [manuallyTouched, setManuallyTouched] = useState(false);

  useEffect(() => {
    if (manuallyTouched) return;
    const detected = detectCategory(title);
    if (detected && detected !== category) {
      setCategory(detected);
      setAutoPicked(true);
    } else if (!detected && autoPicked) {
      setAutoPicked(false);
    }
  }, [title]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !category || !description || !budget || !city) {
      toast.error("Моля, попълни всички полета");
      return;
    }
    toast.success("Задачата е публикувана!", { description: "Скоро ще получиш първите предложения." });
    setTimeout(() => navigate({ to: "/tasks" }), 600);
  };

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8 md:py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Възложи задача</h1>
        <p className="mt-2 text-muted-foreground">
          Опиши какво ти трябва. Безплатно е и отнема по-малко от минута.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-6 rounded-2xl border border-border bg-card p-6 md:p-8">
        <div className="space-y-2">
          <Label htmlFor="title">Какво трябва да се направи?</Label>
          <Input
            id="title"
            placeholder="Напр. Сменa на плочки в баня"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-11"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="category">Категория</Label>
            {autoPicked && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Автоматично избрана
              </span>
            )}
          </div>
          <Select
            value={category}
            onValueChange={(v) => { setCategory(v); setManuallyTouched(true); setAutoPicked(false); }}
          >
            <SelectTrigger id="category" className="h-11">
              <SelectValue placeholder="Избери категория" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="inline-flex items-center gap-2"><c.icon className="h-4 w-4" /> {c.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {autoPicked && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              Категорията е избрана автоматично според описанието. Можеш да я смениш.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Подробности за задачата</Label>
          <Textarea
            id="description"
            placeholder="Опиши какво точно трябва да се направи, материали, срокове и др."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={6}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="budget">Бюджет (€)</Label>
            <div className="relative">
              <Input
                id="budget"
                type="number"
                min={0}
                placeholder="Напр. 500"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="h-11 pr-10"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">€</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="city">Населено място</Label>
            <Select value={city} onValueChange={setCity}>
              <SelectTrigger id="city" className="h-11">
                <SelectValue placeholder="Избери град" />
              </SelectTrigger>
              <SelectContent>
                {cities.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            С публикуването приемаш Условията за ползване.
          </p>
          <Button type="submit" size="lg" className="sm:px-8">Публикувай задачата</Button>
        </div>
      </form>
    </div>
  );
}