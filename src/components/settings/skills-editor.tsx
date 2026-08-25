import { useState, type KeyboardEvent } from "react";
import { Plus, X } from "lucide-react";
import { categories as ALL_CATEGORIES } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const MAX_SKILL_CATEGORIES = 8;
export const MAX_SKILL_TAGS = 10;

/**
 * Controlled editor for profile skills: category multi-select (from the
 * existing category list) plus free-text tags. Free-text tags are masked and
 * moderated server-side by the profiles_moderate_skills trigger.
 */
export function SkillsEditor({
  categories,
  tags,
  onChange,
  disabled,
}: {
  categories: string[];
  tags: string[];
  onChange: (next: { categories: string[]; tags: string[] }) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState("");

  const toggleCategory = (id: string) => {
    if (categories.includes(id)) {
      onChange({ categories: categories.filter((c) => c !== id), tags });
    } else if (categories.length < MAX_SKILL_CATEGORIES) {
      onChange({ categories: [...categories, id], tags });
    }
  };

  const addTag = () => {
    const t = draft.trim().slice(0, 30);
    setDraft("");
    if (!t) return;
    if (tags.length >= MAX_SKILL_TAGS) return;
    if (tags.some((x) => x.toLowerCase() === t.toLowerCase())) return;
    onChange({ categories, tags: [...tags, t] });
  };

  const removeTag = (tag: string) => {
    onChange({ categories, tags: tags.filter((t) => t !== tag) });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag();
    }
  };

  return (
    <div className="grid gap-4">
      <div className="grid gap-1.5">
        <p className="text-sm font-medium text-foreground">Области, в които работиш</p>
        <p className="text-xs text-muted-foreground">
          Избери до {MAX_SKILL_CATEGORIES} категории. Показват се на публичния ти профил.
        </p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {ALL_CATEGORIES.map((c) => {
            const active = categories.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                disabled={disabled}
                onClick={() => toggleCategory(c.id)}
                aria-pressed={active}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                  active
                    ? "border-transparent bg-gradient-to-r from-orange-500 to-rose-500 text-white shadow-sm"
                    : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
                )}
              >
                {c.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-1.5">
        <p className="text-sm font-medium text-foreground">Свои умения (по желание)</p>
        <p className="text-xs text-muted-foreground">
          До {MAX_SKILL_TAGS} кратки етикета, напр. „фризьор“, „монтаж на климатици“. Без телефони и имейли — контактите се споделят само чрез платформата.
        </p>
        <div className="mt-1 flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={disabled || tags.length >= MAX_SKILL_TAGS}
            maxLength={30}
            placeholder="Добави умение…"
            className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          />
          <button
            type="button"
            onClick={addTag}
            disabled={disabled || !draft.trim() || tags.length >= MAX_SKILL_TAGS}
            aria-label="Добави умение"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-border bg-secondary text-foreground transition-colors hover:bg-secondary/70 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        {tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-foreground"
              >
                {t}
                <button
                  type="button"
                  onClick={() => removeTag(t)}
                  disabled={disabled}
                  aria-label={`Премахни ${t}`}
                  className="rounded-full p-0.5 text-muted-foreground transition-colors hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
