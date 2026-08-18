import { useEffect, useRef, useState } from "react";
import { Sparkles, CheckCircle2, Lock, ImagePlus, X, UploadCloud, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LocationCombobox } from "@/components/location-combobox";
import { categories, detectCategory } from "@/lib/mock-data";

export type TaskFormValues = {
  title: string;
  category: string;
  description: string;
  budget: number;
  location: string;
};

export type ExistingImage = { id: string; url: string };

export type TaskFormSubmit = {
  values: TaskFormValues;
  files: File[];
  removedImageIds: string[];
};

const MAX_IMAGES = 8;

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
  const [description, setDescription] = useState(initial?.description ?? "");
  const [budget, setBudget] = useState(initial?.budget != null ? String(initial.budget) : "");
  const [location, setLocation] = useState<string | undefined>(initial?.location || undefined);
  const [autoPicked, setAutoPicked] = useState(false);
  const [manuallyTouched, setManuallyTouched] = useState(mode === "edit");
  const [photos, setPhotos] = useState<{ id: string; url: string; name: string; file: File }[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const keptExisting = existingImages.filter((i) => !removed.includes(i.id));
  const totalImages = keptExisting.length + photos.length;

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !category || !description || !budget || !location) {
      onError("Моля, попълни всички полета");
      return;
    }
    const budgetValue = Number(budget) || 0;
    if (minBudget != null && budgetValue < minBudget) {
      onError(`Бюджетът не може да бъде под ${minBudget} €.`);
      return;
    }
    await onSubmit({
      values: { title, category, description, budget: budgetValue, location },
      files: photos.map((p) => p.file),
      removedImageIds: removed,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-border bg-card p-6 md:p-8">
      <div className="space-y-2">
        <Label htmlFor="title">Какво трябва да се направи?</Label>
        <Input
          id="title"
          placeholder="Напр. Смяна на плочки в баня"
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
          onValueChange={(v) => {
            setCategory(v);
            setManuallyTouched(true);
            setAutoPicked(false);
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

      <div className="space-y-2">
        <Label>Снимки (по избор)</Label>
        <p className="text-xs text-muted-foreground">
          Снимките помагат на майсторите да разберат по-добре какво трябва да се направи.
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
        <Label htmlFor="budget">Бюджет (€)</Label>
        <div className="relative">
          <Input
            id="budget"
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
        {minBudget != null && (
          <p className="flex items-start gap-1.5 rounded-xl bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <span>
              Майстори вече платиха кредити за тази задача според бюджета ѝ. Затова бюджетът не може да
              бъде намаляван под {minBudget} €, можеш само да го увеличиш. Всичко останало е свободно за
              редакция.
            </span>
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="location">Град и квартал</Label>
        <LocationCombobox id="location" value={location} onChange={setLocation} />
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" />
          Точният ви адрес е скрит. Ще се показва само вашият квартал.
        </p>
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-muted-foreground">
          {footerNote ?? "С публикуването приемаш Условията за ползване."}
        </div>
        <Button type="submit" size="lg" disabled={submitting || disabled} className="sm:px-8">
          {submitting ? "Изчакай..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
