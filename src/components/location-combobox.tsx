import * as React from "react";
import { Check, ChevronsUpDown, MapPin, X } from "lucide-react";
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
import { locations } from "@/lib/mock-data";

type Props = {
  value?: string;
  onChange: (value: string | undefined) => void;
  placeholder?: string;
  id?: string;
  className?: string;
  allowClear?: boolean;
};

export function LocationCombobox({
  value,
  onChange,
  placeholder = "Въведи град или квартал...",
  id,
  className,
  allowClear = false,
}: Props) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
          <span className="inline-flex items-center gap-2 truncate">
            <MapPin className="h-4 w-4 shrink-0 opacity-70" />
            <span className="truncate">{value ?? placeholder}</span>
          </span>
          {allowClear && value ? (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onChange(undefined); }}
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
        <Command>
          <CommandInput placeholder={placeholder} />
          <CommandList>
            <CommandEmpty>Няма намерени локации.</CommandEmpty>
            <CommandGroup>
              {locations.map((loc) => (
                <CommandItem
                  key={loc}
                  value={loc}
                  onSelect={(current) => {
                    onChange(current === value ? undefined : current);
                    setOpen(false);
                  }}
                >
                  <MapPin className="mr-2 h-4 w-4 opacity-60" />
                  {loc}
                  <Check className={cn("ml-auto h-4 w-4", value === loc ? "opacity-100" : "opacity-0")} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}