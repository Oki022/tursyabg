import { Toaster as Sonner } from "sonner";
import { CheckCircle2, Info, Loader2, TriangleAlert, XCircle } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

type ToasterProps = React.ComponentProps<typeof Sonner>;

function IconBubble({
  tone,
  children,
}: {
  tone: "success" | "error" | "info" | "warning";
  children: React.ReactNode;
}) {
  const tones = {
    success: "bg-emerald-500/15 text-emerald-600",
    error: "bg-rose-500/15 text-rose-600",
    info: "bg-slate-500/15 text-slate-600",
    warning: "bg-amber-500/15 text-amber-600",
  } as const;
  return (
    <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${tones[tone]}`}>
      {children}
    </span>
  );
}

const Toaster = ({ ...props }: ToasterProps) => {
  const isMobile = useIsMobile();

  return (
    <Sonner
      className="toaster group"
      position={isMobile ? "top-center" : "top-right"}
      duration={2500}
      visibleToasts={3}
      gap={8}
      offset={
        isMobile
          ? "calc(env(safe-area-inset-top, 0px) + 4.25rem)"
          : "calc(env(safe-area-inset-top, 0px) + 5rem)"
      }
      mobileOffset={{
        top: "calc(env(safe-area-inset-top, 0px) + 4.25rem)",
        left: "0.75rem",
        right: "0.75rem",
      }}
      icons={{
        success: (
          <IconBubble tone="success">
            <CheckCircle2 className="h-3.5 w-3.5" />
          </IconBubble>
        ),
        error: (
          <IconBubble tone="error">
            <XCircle className="h-3.5 w-3.5" />
          </IconBubble>
        ),
        warning: (
          <IconBubble tone="warning">
            <TriangleAlert className="h-3.5 w-3.5" />
          </IconBubble>
        ),
        info: (
          <IconBubble tone="info">
            <Info className="h-3.5 w-3.5" />
          </IconBubble>
        ),
        loading: (
          <IconBubble tone="info">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          </IconBubble>
        ),
      }}
      toastOptions={{
        unstyled: false,
        classNames: {
          toast:
            "app-toast group toast relative w-full overflow-hidden rounded-2xl border border-border/40 bg-card/80 px-3.5 py-2.5 text-foreground shadow-[0_12px_32px_-12px_rgba(15,23,42,0.35)] backdrop-blur-xl",
          title: "text-[13px] font-semibold leading-snug",
          description: "text-[12px] leading-snug text-muted-foreground",
          icon: "mr-2",
          actionButton: "rounded-full bg-primary px-2.5 py-1 text-[11px] text-primary-foreground",
          cancelButton: "rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground",
          closeButton: "border-border/50 bg-card text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
