import { useMemo, useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { categories as ALL_CATEGORIES } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { normalizeSkillTag, skillTagError, skillTagKey } from "@/lib/skill-tags";
import { usePopularSkillTags } from "@/lib/skills-api";

export const MAX_SKILL_CATEGORIES = 8;
export const MAX_SKILL_TAGS = 10;

/**
 * Controlled editor for profile skills: category multi-select (from the
 * existing category list) plus free-text tags. Tags are validated on the
 * client (no phones, emails, links or messenger handles) before they are
 * added, mirroring the server-side masking, and suggested from tags already
 * used across the platform so they converge.
 */
export function SkillsEditor({
  categories,
  tags,
  draft,
  onDraftChange,
  onChange,
  disabled,
}: {
  categories: string[];
  tags: string[];
  draft: string;
  onDraftChange: (value: string) => void;
  onChange: (next: { categories: string[]; tags: string[] }) => void;
  disabled?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const popular = usePopularSkillTags(categories, !disabled);

  const taken = useMemo(() => new Set(tags.map(skillTagKey)), [tags]);
  const query = skillTagKey(draft);

  const suggestions = useMemo(() => {
    const all = popular.data ?? [];
    const pool = all.filter((s) => !taken.has(skillTagKey(s.tag)));
    if (!query) return pool.slice(0, 8);
    return pool.filter((s) => skillTagKey(s.tag).includes(query)).slice(0, 8);
  }, [popular.data, taken, query]);

  const addTag = (value: string) => {
    const t = normalizeSkillTag(value);
    const err = skillTagError(t);
    if (err) {
      setError(err);
      return;
    }
    if (tags.length >= MAX_SKILL_TAGS) {
      setError(`Може да добавиш най-много ${MAX_SKILL_TAGS} умения.`);
      return;
    }
    if (taken.has(skillTagKey(t))) {
      setError("Това умение вече е добавено.");
      return;
    }
    setError(null);
    onDraftChange("");
    onChange({ categories, tags: [...tags, t] });
  };

  const toggleCategory = (id: string) => {
    if (categories.includes(id)) {
      onChange({ categories: categories.filter((c) => c !== id), tags });
    } else if (categories.length < MAX_SKILL_CATEGORIES) {
      onChange({ categories: [...categories, id], tags });
    }
  };

  const removeTag = (tag: string) => {
    onChange({ categories, tags: tags.filter((t) => t !== tag) });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(draft);
    }
  };

  const draftError = draft.trim() ? skillTagError(draft) : null;

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
          До {MAX_SKILL_TAGS} кратки етикета, напр. „фризьор“, „монтаж на климатици“. Без телефони и имейли. Контактите се споделят само чрез платформата.
        </p>
        <div className="mt-1">
          <input
            type="text"
            value={draft}
            onChange={(e) => {
              onDraftChange(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={onKeyDown}
            disabled={disabled || tags.length >= MAX_SKILL_TAGS}
            maxLength={30}
            aria-invalid={Boolean(error || draftError)}
            placeholder="Добави умение…"
            className={cn(
              "h-10 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
              error || draftError ? "border-destructive" : "border-input",
            )}
          />
        </div>

        {(error || draftError) && (
          <p className="text-xs font-medium text-destructive" role="alert">
            {error ?? draftError}
          </p>
        )}

        {suggestions.length > 0 && tags.length < MAX_SKILL_TAGS && (
          <div className="mt-1 grid gap-1">
            <p className="text-xs text-muted-foreground">
              {query ? "Съвпадащи умения" : "Често използвани умения"}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={s.tag}
                  type="button"
                  disabled={disabled}
                  onClick={() => addTag(s.tag)}
                  className="rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  {s.tag}
                </button>
              ))}
            </div>
          </div>
        )}

        {tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-orange-500 to-rose-500 px-2.5 py-1 text-xs font-medium text-white shadow-sm"
              >
                {t}
                <button
                  type="button"
                  onClick={() => removeTag(t)}
                  disabled={disabled}
                  aria-label={`Премахни ${t}`}
                  className="rounded-full p-0.5 text-white/80 transition-colors hover:text-white"
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
