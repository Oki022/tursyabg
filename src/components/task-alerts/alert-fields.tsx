import { useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LocationCombobox } from "@/components/location-combobox";
import { categories } from "@/lib/mock-data";
import { splitLocation } from "@/lib/locations";
import { useMunicipalities, useRegions } from "@/lib/locations-api";
import type { TaskAlertInput } from "@/services/task-alerts";

export type AlertDraft = {
  category: string; // "all" or a category id
  region: string; // "all" or a region slug
  location?: string; // община name from LocationCombobox
};

export const EMPTY_DRAFT: AlertDraft = { category: "all", region: "all", location: undefined };

export function draftToAlert(d: AlertDraft): TaskAlertInput {
  const city = splitLocation(d.location).city ?? null;
  return {
    category: d.category === "all" ? null : d.category,
    city,
    // An община is more specific than an област; keep only one of them.
    region: city ? null : d.region === "all" ? null : d.region,
  };
}

/** A saved search must narrow something down, otherwise it would mail every new task. */
export function isNarrow(a: TaskAlertInput): boolean {
  return Boolean(a.category || a.city || a.region);
}

/** Category + област + община pickers shared by the /tasks dialog and the settings page. */
export function AlertFields({
  draft,
  onChange,
  idPrefix,
  inDialog = false,
}: {
  draft: AlertDraft;
  onChange: (next: AlertDraft) => void;
  idPrefix: string;
  inDialog?: boolean;
}) {
  const { data: regions = [] } = useRegions();
  const { data: municipalities = [] } = useMunicipalities();

  // Filters from /tasks may carry only an община; show its област as well.
  useEffect(() => {
    if (!draft.location || draft.region !== "all" || municipalities.length === 0) return;
    const city = splitLocation(draft.location).city;
    const slug = municipalities.find((m) => m.name === city)?.regionSlug;
    if (slug) onChange({ ...draft, region: slug });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [municipalities.length]);

  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor={`${idPrefix}-category`}>Категория</Label>
        <Select value={draft.category} onValueChange={(v) => onChange({ ...draft, category: v })}>
          <SelectTrigger id={`${idPrefix}-category`} className="h-10">
            <SelectValue placeholder="Всички категории" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Всички категории</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor={`${idPrefix}-region`}>Област</Label>
          <Select
            value={draft.region}
            onValueChange={(v) => {
              const city = splitLocation(draft.location).city;
              const cityRegion = municipalities.find((m) => m.name === city)?.regionSlug;
              // Changing the област drops an община that is not in it.
              onChange({ ...draft, region: v, location: cityRegion && cityRegion === v ? draft.location : undefined });
            }}
          >
            <SelectTrigger id={`${idPrefix}-region`} className="h-10">
              <SelectValue placeholder="Цяла България" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Цяла България</SelectItem>
              {regions.map((r) => (
                <SelectItem key={r.slug} value={r.slug}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor={`${idPrefix}-location`}>Община (по избор)</Label>
          <LocationCombobox
            id={`${idPrefix}-location`}
            value={draft.location}
            onChange={(v) => {
              const city = splitLocation(v).city;
              const regionSlug = municipalities.find((m) => m.name === city)?.regionSlug;
              // Picking an община also shows its област, so the two never disagree.
              onChange({ ...draft, location: city, region: regionSlug ?? draft.region });
            }}
            allowClear
            cityOnly
            modal={inDialog}
            placeholder="Всички общини"
          />
        </div>
      </div>
    </div>
  );
}
