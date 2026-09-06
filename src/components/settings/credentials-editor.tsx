import { ChevronDown, Info, Plus, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MAX_CREDENTIALS,
  MAX_CREDENTIAL_LABEL,
  MAX_CREDENTIAL_VALUE,
  credentialError,
  type Credential,
} from "@/lib/credentials";

type Props = {
  entries: Credential[];
  onChange: (next: Credential[]) => void;
  disabled?: boolean;
};

export function CredentialsEditor({ entries, onChange, disabled }: Props) {
  const rows = entries.length > 0 ? entries : [{ label: "", value: "", url: "" }];
  const filledCount = entries.filter((e) => e.label.trim() || e.value.trim()).length;
  const [open, setOpen] = useState(false);

  const update = (index: number, patch: Partial<Credential>) => {
    const next = rows.map((r, i) => (i === index ? { ...r, ...patch } : r));
    onChange(next);
  };

  const remove = (index: number) => {
    onChange(rows.filter((_, i) => i !== index));
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 rounded-xl px-1 py-1.5 text-left transition-colors hover:text-foreground"
        >
          <span className="text-sm font-semibold text-foreground">
            Публични регистри и идентификационни номера
            {filledCount > 0 ? ` (${filledCount})` : ""}
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
          />
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent className="collapsible-content">
        <div className="space-y-3 pt-3">
          <p className="text-xs text-muted-foreground">
            Полето е предвидено най-вече за експерти и консултанти, адвокати, счетоводители и други
            лицензирани професионалисти. Посочи вписване в публичен регистър или лиценз, за да могат
            клиентите сами да го проверят.
          </p>

        {rows.map((row, i) => {
          const err = credentialError(row);
          return (
            <div key={i} className="rounded-xl border border-border/60 bg-secondary/30 p-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs" htmlFor={`cred-label-${i}`}>
                    Регистър или орган
                  </Label>
                  <Input
                    id={`cred-label-${i}`}
                    value={row.label}
                    maxLength={MAX_CREDENTIAL_LABEL}
                    placeholder="Напр. Адвокатска колегия"
                    disabled={disabled}
                    onChange={(e) => update(i, { label: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs" htmlFor={`cred-value-${i}`}>
                    Номер или идентификатор
                  </Label>
                  <Input
                    id={`cred-value-${i}`}
                    value={row.value}
                    maxLength={MAX_CREDENTIAL_VALUE}
                    placeholder="Напр. 1234567890"
                    disabled={disabled}
                    onChange={(e) => update(i, { value: e.target.value })}
                  />
                </div>
              </div>
              <div className="mt-2 space-y-1">
                <Label className="text-xs" htmlFor={`cred-url-${i}`}>
                  Линк към публичния регистър (по избор)
                </Label>
                <Input
                  id={`cred-url-${i}`}
                  value={row.url ?? ""}
                  inputMode="url"
                  placeholder="https://..."
                  disabled={disabled}
                  onChange={(e) => update(i, { url: e.target.value })}
                />
              </div>
              {err && <p className="mt-2 text-xs text-destructive">{err}</p>}
              {rows.length > 1 && (
                <div className="mt-2 flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-xs text-muted-foreground"
                    disabled={disabled}
                    onClick={() => remove(i)}
                  >
                    <X className="h-3.5 w-3.5" /> Премахни
                  </Button>
                </div>
              )}
            </div>
          );
        })}

          {rows.length < MAX_CREDENTIALS && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={disabled}
              onClick={() => onChange([...rows, { label: "", value: "", url: "" }])}
            >
              <Plus className="h-4 w-4" /> Добави още едно вписване
            </Button>
          )}

          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            Информацията се показва публично и не се проверява от нас. Телефони и имейли се
            премахват автоматично.
          </p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

