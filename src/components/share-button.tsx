import { useState } from "react";
import { Share2, Copy, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { absoluteUrl } from "@/lib/brand";

/** Shares the clean canonical URL of a page (never the current URL with tracking params). */
export function ShareButton({
  path,
  title,
  text,
  className,
  iconOnly = false,
}: {
  path: string;
  title: string;
  text?: string;
  className?: string;
  /** Round icon button (phone top bar), without the "Сподели" label. */
  iconOnly?: boolean;
}) {
  const url = absoluteUrl(path);
  const [open, setOpen] = useState(false);

  const onShare = async () => {
    const shareText = text ?? `Виж тази задача в ТърсяБГ: ${title}`;
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({ title, text: shareText, url });
        return;
      }
    } catch (err) {
      // Отказано споделяне не е грешка, показваме резервния вариант само при друг проблем.
      if (err instanceof DOMException && err.name === "AbortError") return;
    }
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        toast.success("Линкът е копиран.");
        return;
      }
    } catch {
      /* клипбордът е блокиран */
    }
    setOpen(true);
  };

  const encoded = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        {iconOnly ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Сподели"
            className={`h-9 w-9 rounded-full border-border/60 bg-card text-muted-foreground shadow-sm ${className ?? ""}`}
            onClick={onShare}
          >
            <Share2 className="h-4 w-4" />
          </Button>
        ) : (
          <Button type="button" variant="outline" size="sm" className={className} onClick={onShare}>
            <Share2 className="h-4 w-4" /> Сподели
          </Button>
        )}
      </PopoverAnchor>
      <PopoverContent align="end" className="w-72 space-y-3">
        <p className="text-sm font-medium text-foreground">Копирай линка</p>
        <div className="flex gap-2">
          <Input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="text-xs" />
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Копирай"
            onClick={() => {
              const input = document.createElement("textarea");
              input.value = url;
              document.body.appendChild(input);
              input.select();
              try {
                document.execCommand("copy");
                toast.success("Линкът е копиран.");
              } catch {
                toast.error("Копирай линка ръчно.");
              }
              document.body.removeChild(input);
            }}
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={`https://www.facebook.com/sharer/sharer.php?u=${encoded}`} target="_blank" rel="noreferrer">
              Facebook
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={`viber://forward?text=${encodedTitle}%20${encoded}`}>Viber</a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={`https://wa.me/?text=${encodedTitle}%20${encoded}`} target="_blank" rel="noreferrer">
              WhatsApp
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={`mailto:?subject=${encodedTitle}&body=${encoded}`}>
              <Mail className="h-4 w-4" /> Имейл
            </a>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
