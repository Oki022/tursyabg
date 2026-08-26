import * as React from "react";
import { Check, ChevronsUpDown, Loader2, LocateFixed, MapPin, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useMunicipalities, useNeighborhoods } from "@/lib/locations-api";
import {
  buildLocation,
  formatLocation,
  municipalityLabel,
  nearestMunicipality,
  rankMunicipalities,
  searchKey,
  splitLocation,
  type Municipality,
} from "@/lib/locations";


type Props = {
  value?: string;
  onChange: (value: string | undefined) => void;
  placeholder?: string;
  id?: string;
  className?: string;
  allowClear?: boolean;
  /** Offer "use my location" (browser geolocation) above the list. */
  allowGeolocation?: boolean;
};

export function LocationCombobox({
  value,
  onChange,
  placeholder = "Търси община или град...",
  id,
  className,
  allowClear = false,
  allowGeolocation = true,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  /** Second step: община с квартали asks for the квартал. */
  const [pending, setPending] = React.useState<Municipality | null>(null);
  const [locating, setLocating] = React.useState(false);
  const [geoError, setGeoError] = React.useState<string | null>(null);

  const { data: municipalities = [], isLoading } = useMunicipalities();
  const { data: neighborhoods = [] } = useNeighborhoods(pending?.id);

  const results = React.useMemo(
    () => rankMunicipalities(municipalities, query).slice(0, 60),
    [municipalities, query],
  );

  const selected = splitLocation(value);

  function pick(m: Municipality) {
    if (m.hasNeighborhoods) {
      setPending(m);
      setQuery("");
      return;
    }
    onChange(m.name);
    setOpen(false);
  }

  function useMyLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoError("Браузърът не поддържа определяне на местоположение.");
      return;
    }
    setGeoError(null);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const nearest = nearestMunicipality(municipalities, {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        if (!nearest) {
          setGeoError("Не успяхме да намерим най-близката община.");
          return;
        }
        pick(nearest);
      },
      () => {
        setLocating(false);
        setGeoError("Достъпът до местоположението е отказан.");
      },
      { timeout: 10_000 },
    );
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setPending(null);
          setQuery("");
          setGeoError(null);
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "h-11 w-full justify-between font-normal",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <span className="inline-flex min-w-0 items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0 opacity-70" />
            <span className="truncate">{value ?? placeholder}</span>
          </span>
          {allowClear && value ? (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChange(undefined);
              }}
              className="ml-2 rounded p-0.5 opacity-60 hover:opacity-100"
              aria-label="Изчисти"
            >
              <X className="h-4 w-4" />
            </span>
          ) : (
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        {pending ? (
          <Command>
            <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-sm">
              <button
                type="button"
                onClick={() => setPending(null)}
                className="text-primary hover:underline"
              >
                Назад
              </button>
              <span className="truncate text-muted-foreground">
                Квартал в {pending.name}
              </span>
            </div>
            <CommandList>
              <CommandEmpty>Няма квартали за тази община.</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value={`__all-${pending.slug}`}
                  onSelect={() => {
                    onChange(pending.name);
                    setPending(null);
                    setOpen(false);
                  }}
                >
                  <MapPin className="mr-2 h-4 w-4 opacity-60" />
                  Цялата община {pending.name}
                </CommandItem>
                {neighborhoods.map((n) => (
                  <CommandItem
                    key={n.id}
                    value={n.name}
                    onSelect={() => {
                      onChange(buildLocation(pending.name, n.name));
                      setPending(null);
                      setOpen(false);
                    }}
                  >
                    <MapPin className="mr-2 h-4 w-4 opacity-60" />
                    <span className="truncate">{n.name}</span>
                    <Check
                      className={cn(
                        "ml-auto h-4 w-4",
                        selected.neighborhood === n.name ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        ) : (
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Търси на кирилица или латиница..."
              value={query}
              onValueChange={setQuery}
            />
            {allowGeolocation && (
              <div className="border-b border-border px-2 py-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-full justify-start gap-2 text-sm"
                  onClick={useMyLocation}
                  disabled={locating || isLoading}
                >
                  {locating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <LocateFixed className="h-4 w-4" />
                  )}
                  Използвай текущото местоположение
                </Button>
                {geoError && <p className="px-2 pt-1 text-xs text-destructive">{geoError}</p>}
              </div>
            )}
            <CommandList>
              <CommandEmpty>
                {isLoading ? "Зареждане на общините..." : "Няма намерена община."}
              </CommandEmpty>
              <CommandGroup>
                {results.map((m) => (
                  <CommandItem key={m.id} value={m.slug} onSelect={() => pick(m)}>
                    <MapPin className="mr-2 h-4 w-4 shrink-0 opacity-60" />
                    <span className="min-w-0 truncate">
                      {municipalityLabel(m.name, m.hasNeighborhoods)}
                      <span className="ml-1 text-xs text-muted-foreground">
                        обл. {m.regionName}
                      </span>
                    </span>
                    <Check
                      className={cn(
                        "ml-auto h-4 w-4 shrink-0",
                        selected.city === m.name ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        )}
      </PopoverContent>
    </Popover>
      <p className="text-xs text-muted-foreground">
        Избери общината си, тя покрива всички села в нея, а конкретното село опиши в описанието.
      </p>
    </div>
  );
}

