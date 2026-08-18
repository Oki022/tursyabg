import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { absoluteUrl } from "@/lib/brand";

/** Shares the clean canonical URL of a page (never the current URL with tracking params). */
export function ShareButton({ path, title, className }: { path: string; title: string; className?: string }) {
  const url = absoluteUrl(path);

  const onShare = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success("Линкът е копиран.");
    } catch {
      /* потребителят е отказал споделянето */
    }
  };

  return (
    <Button type="button" variant="outline" size="sm" className={className} onClick={onShare}>
      <Share2 className="h-4 w-4" /> Сподели
    </Button>
  );
}
