import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, ImagePlus, X, UploadCloud, Info, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LocationCombobox } from "@/components/location-combobox";
import { categories } from "@/lib/mock-data";
import { suggestCategories } from "@/lib/category-suggest";
import { OTHER_SUBCATEGORY, isValidSubcategory, subcategoriesFor } from "@/lib/subcategories";
import { cn } from "@/lib/utils";
import {
  DESCRIPTION_MAX,
  DESCRIPTION_MIN,
  TITLE_MAX,
  TITLE_MIN,
  budgetIssueBg,
  descriptionIssueBg,
  examplesFor,
  titleIssueBg,
} from "@/lib/content-quality";
import { useHydrated } from "@/hooks/use-hydrated";
import { BUDGET_RANGES, budgetForRange, type BudgetRange } from "@/lib/budget-range";

export type TaskFormValues = {
  title: string;
  category: string;
  /** Required for new tasks; "drugo" when nothing fits. */
  subcategory: string | null;
  description: string;
  budget: number;
  /** "По договаряне" range, or null for an exact amount. */
  budgetRange: BudgetRange | null;
  location: string;
};

export type ExistingImage = { id: string; url: string };

export type TaskFormSubmit = {
  values: TaskFormValues;
  files: File[];
  removedImageIds: string[];
};

const MAX_IMAGES = 8;

/** Debounces a value so inline hints appear only after the user pauses typing. */
function useDebounced<T>(value: T, delay = 450) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function FieldHint({ message }: { message: string }) {
  return (
    <p
      data-field-hint
      className="flex items-start gap-1.5 rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive"
    >
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{message}</span>
    </p>
  );
}

function Counter({ value, min, max }: { value: number; min: number; max: number }) {
  const ok = value >= min && value <= max;
  return (
    <span className={`text-xs tabular-nums ${ok ? "text-muted-foreground" : "text-destructive"}`}>
      {value}/{max}
      {value < min ? ` (мин. ${min})` : ""}
    </span>
  );
}

/** Shared task form used both for posting a new task and editing an existing one. */
export function TaskForm({
  mode,
  initial,
  existingImages = [],
  minBudget,
  submitting,
  submitLabel,
  onSubmit,
  onError,
  disabled = false,
  footerNote,
}: {
  mode: "create" | "edit";
  initial?: Partial<TaskFormValues>;
  existingImages?: ExistingImage[];
  /** When set, the budget cannot be lowered below this value (professionals already paid). */
  minBudget?: number;
  submitting: boolean;
  submitLabel: string;
  onSubmit: (data: TaskFormSubmit) => void | Promise<void>;
  onError: (message: string) => void;
  disabled?: boolean;
  footerNote?: React.ReactNode;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [category, setCategory] = useState<string | undefined>(initial?.category);
  // Tasks from before subcategories open in the edit form as "Друго".
  const [subcategory, setSubcategory] = useState<string | undefined>(
    initial?.subcategory ?? (mode === "edit" && initial?.category ? OTHER_SUBCATEGORY : undefined),
  );
  const subOptions = subcategoriesFor(category);
  // A new category keeps the subcategory only when it also exists there.
  useEffect(() => {
    if (subcategory && !isValidSubcategory(category, subcategory)) setSubcategory(undefined);
  }, [category, subcategory]);
  const [description, setDescription] = useState(initial?.description ?? "");
  const [budgetRange, setBudgetRange] = useState<BudgetRange | null>(initial?.budgetRange ?? null);
  const [budgetMode, setBudgetMode] = useState<"exact" | "range">(initial?.budgetRange ? "range" : "exact");
  const [budget, setBudget] = useState(
    initial?.budget != null && !initial?.budgetRange ? String(initial.budget) : "",
  );
  const [location, setLocation] = useState<string | undefined>(initial?.location || undefined);
  const [manuallyTouched, setManuallyTouched] = useState(mode === "edit");
  const [photos, setPhotos] = useState<{ id: string; url: string; name: string; file: File }[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Бутонът чака hydration, иначе ранен клик изпраща обикновена HTML форма и данните се губят.
  const hydrated = useHydrated();

  const keptExisting = existingImages.filter((i) => !removed.includes(i.id));
  const totalImages = keptExisting.length + photos.length;

  const examples = examplesFor(category);
  const debouncedTitle = useDebounced(title);
  const debouncedDescription = useDebounced(description);
  const debouncedBudget = useDebounced(budget);
  const titleHint = debouncedTitle.trim() ? titleIssueBg(debouncedTitle) : null;
  const descriptionHint = debouncedDescription.trim()
    ? descriptionIssueBg(debouncedDescription, title)
    : null;
  const budgetHint =
    budgetMode === "exact" && debouncedBudget.trim() ? budgetIssueBg(Number(debouncedBudget)) : null;

  const addFiles = (files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    const next = arr.map((f) => ({
      id: `${f.name}-${f.size}-${Math.random().toString(36).slice(2, 8)}`,
      url: URL.createObjectURL(f),
      name: f.name,
      file: f,
    }));
    setPhotos((p) => [...p, ...next].slice(0, Math.max(MAX_IMAGES - keptExisting.length, 0)));
  };

  const removePhoto = (id: string) => {
    setPhotos((p) => {
      const target = p.find((x) => x.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return p.filter((x) => x.id !== id);
    });
  };

  // Full-text analysis (title + description) with weighted Bulgarian phrase
  // scoring; the top 2-3 candidates are offered as one-tap chips.
  const candidates = useMemo(
    () => (manuallyTouched ? [] : suggestCategories(debouncedTitle, debouncedDescription)),
    [debouncedTitle, debouncedDescription, manuallyTouched],
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    // Validation failures also surface an inline hint; scroll to it so the
    // reason is visible instead of looking like "nothing happened".
    const scrollToHint = () =>
      setTimeout(
        () => form.querySelector("[data-field-hint]")?.scrollIntoView({ behavior: "smooth", block: "center" }),
        500,
      );
    const isRange = budgetMode === "range";
    if (!title || !category || !description || !location || (isRange ? !budgetRange : !budget)) {
      onError(isRange && !budgetRange ? "Избери ориентировъчен бюджет." : "Моля, попълни всички полета");
      return;
    }
    if (!subcategory || !isValidSubcategory(category, subcategory)) {
      onError("Избери вид услуга. Ако нищо не пасва, избери „Друго“.");
      return;
    }
    const budgetValue = isRange && budgetRange ? budgetForRange(budgetRange) : Number(budget) || 0;
    if (minBudget != null && budgetValue < minBudget) {
      onError(`Бюджетът не може да бъде под ${minBudget} €.`);
      return;
    }
    const problem =
      titleIssueBg(title) ??
      descriptionIssueBg(description, title) ??
      (isRange ? null : budgetIssueBg(budgetValue));
    if (problem) {
      onError(problem);
      scrollToHint();
      return;
    }
    await onSubmit({
      values: {
        title,
        category,
        subcategory,
        description,
        budget: budgetValue,
        budgetRange: isRange ? budgetRange : null,
        location,
      },
      files: photos.map((p) => p.file),
      removedImageIds: removed,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-border bg-card p-6 md:p-8">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="title">Какво трябва да се направи?</Label>
          <Counter value={title.trim().length} min={TITLE_MIN} max={TITLE_MAX} />
        </div>
        <Input
          id="title"
          placeholder={examples.title}
          maxLength={TITLE_MAX}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="h-11"
        />
        {titleHint && <FieldHint message={titleHint} />}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="category">Категория</Label>
        </div>
        {candidates.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              Предложения:
            </span>
            {candidates.map((c, i) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setCategory(c.id);
                  setManuallyTouched(true);
                }}
                className={
                  i === 0
                    ? "inline-flex items-center rounded-full bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-800 transition hover:bg-amber-200"
                    : "inline-flex items-center rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground"
                }
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
        <Select
          value={category}
          onValueChange={(v) => {
            setCategory(v);
            setManuallyTouched(true);
          }}
        >
          <SelectTrigger id="category" className="h-11">
            <SelectValue placeholder="Избери категория" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                <span className="inline-flex items-center gap-2">
                  <c.icon className="h-4 w-4" /> {c.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {subOptions.length > 0 && (
        <div className="space-y-2">
          <Label id="subcategory-label">Вид услуга</Label>
          <div role="radiogroup" aria-labelledby="subcategory-label" className="flex flex-wrap gap-2">
            {subOptions.map((s) => {
              const active = subcategory === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setSubcategory(s.id)}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-foreground hover:border-primary/50 hover:bg-primary/5",
                  )}
                >
                  {s.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="description">Подробности за задачата</Label>
          <Counter value={description.trim().length} min={DESCRIPTION_MIN} max={DESCRIPTION_MAX} />
        </div>
        <Textarea
          id="description"
          placeholder={examples.description}
          maxLength={DESCRIPTION_MAX}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={6}
        />
        <p className="text-xs text-muted-foreground">
          Включи какво точно трябва да се направи, кога ти трябва и специфики като размери, материали
          или достъп до мястото. Повече детайли означават по-точни предложения.
        </p>
        {descriptionHint && <FieldHint message={descriptionHint} />}
      </div>

      <div className="space-y-2">
        <Label>Снимки (по избор)</Label>
        <p className="text-xs text-muted-foreground">
          Снимките помагат на изпълнителите да разберат по-добре какво трябва да се направи.
        </p>

        {keptExisting.length > 0 && (
          <div className="grid grid-cols-3 gap-3 pt-1 sm:grid-cols-4">
            {keptExisting.map((img) => (
              <div
                key={img.id}
                className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-muted"
              >
                <img src={img.url} alt="Снимка към задачата" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setRemoved((r) => [...r, img.id])}
                  className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white transition-opacity hover:bg-black/80"
                  aria-label="Премахни снимката"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {totalImages < MAX_IMAGES && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`group relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
              dragOver
                ? "border-primary bg-primary/5"
                : "border-border bg-secondary/40 hover:border-primary/50 hover:bg-primary/5"
            }`}
          >
            <span className="grid h-12 w-12 place-items-center rounded-full bg-background shadow-sm ring-1 ring-border">
              <UploadCloud className="h-6 w-6 text-primary" />
            </span>
            <div className="text-sm font-medium text-foreground">
              Пусни снимките тук или{" "}
              <span className="text-primary underline-offset-2 group-hover:underline">
                избери от устройството
              </span>
            </div>
            <div className="text-xs text-muted-foreground">PNG, JPG до 10MB · максимум 8 снимки</div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && addFiles(e.target.files)}
            />
          </div>
        )}

        {photos.length > 0 && (
          <div className="grid grid-cols-3 gap-3 pt-2 sm:grid-cols-4">
            {photos.map((p) => (
              <div
                key={p.id}
                className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-muted"
              >
                <img src={p.url} alt={p.name} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removePhoto(p.id);
                  }}
                  className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white transition-opacity hover:bg-black/80"
                  aria-label="Премахни снимката"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {totalImages < MAX_IMAGES && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
              >
                <ImagePlus className="h-5 w-5" />
                <span className="text-xs font-medium">Още</span>
              </button>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor={budgetMode === "exact" ? "budget" : undefined}>Бюджет</Label>
        <div role="radiogroup" aria-label="Вид бюджет" className="grid grid-cols-2 gap-1 rounded-xl bg-secondary/60 p-1">
          {(
            [
              { id: "exact", label: "Точна сума" },
              { id: "range", label: "По договаряне" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={budgetMode === opt.id}
              onClick={() => setBudgetMode(opt.id)}
              className={`h-9 rounded-lg text-sm font-medium transition-colors ${
                budgetMode === opt.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {budgetMode === "exact" ? (
          <div className="relative">
            <Input
              id="budget"
              aria-label="Бюджет (€)"
              type="number"
              min={minBudget ?? 0}
              placeholder="Напр. 500"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              className="h-11 pr-10"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              €
            </span>
          </div>
        ) : (
          <>
            <div role="radiogroup" aria-label="Ориентировъчен бюджет" className="flex flex-wrap gap-2">
              {BUDGET_RANGES.map((r) => {
                const blocked = minBudget != null && r.value < minBudget;
                const active = budgetRange === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={blocked}
                    onClick={() => setBudgetRange(r.id)}
                    className={`rounded-full border px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-foreground hover:border-primary/50"
                    }`}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Изпълнителите ще видят ориентировъчния бюджет. Цената се уточнява с избрания изпълнител.
            </p>
          </>
        )}
        {budgetHint && <FieldHint message={budgetHint} />}
        {minBudget != null && (
          <p className="flex items-start gap-1.5 rounded-xl bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <span>
              Майстори вече платиха точки за тази задача според бюджета ѝ. Затова бюджетът не може да
              бъде намаляван под {minBudget} €, можеш само да го увеличиш. Всичко останало е свободно за
              редакция.
            </span>
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="location">Град и квартал</Label>
        <LocationCombobox id="location" value={location} onChange={setLocation} postingHint />
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-muted-foreground">
          {footerNote ?? "С публикуването приемаш Условията за ползване."}
        </div>
        <Button type="submit" size="lg" disabled={!hydrated || submitting || disabled} className="sm:px-8">
          {submitting ? "Изчакай..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
