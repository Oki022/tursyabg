import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LocationCombobox } from "@/components/location-combobox";
import { categories } from "@/lib/mock-data";
import { useRegions } from "@/lib/locations-api";

export type AlertDraft = {
  category: string; // "all" or a category id
  region: string; // "all" or a region slug
  location?: string; // "Община" or "Община, кв." from LocationCombobox
};

/** Category + област + община pickers shared by the dialog and the settings page. */
export function AlertFields({
  draft,
  onChange,
  idPrefix,
}: {
  draft: AlertDraft;
  onChange: (next: AlertDraft) => void;
  idPrefix: string;
}) {
  const { data: regions = [] } = useRegions();

  return (
    <div className="grid gap-4">
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

      <div className="grid gap-1.5">
        <Label htmlFor={`${idPrefix}-region`}>Област</Label>
        <Select
          value={draft.region}
          onValueChange={(v) => onChange({ ...draft, region: v, location: undefined })}
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
          onChange={(v) => onChange({ ...draft, location: v })}
          allowClear
          placeholder="Всички общини"
        />
        <p className="text-xs text-muted-foreground">
          Ако избереш община, ще получаваш само задачите от нея.
        </p>
      </div>
    </div>
  );
}
