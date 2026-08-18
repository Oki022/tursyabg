import { Link } from "@tanstack/react-router";
import { ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand";

export const BRAND_NAME = BRAND;

/** Single source of truth for the brand mark. Swap this to a custom image path
 *  (e.g. "/logo.png" or an imported asset) to change the logo everywhere. */
export const LOGO_SRC: string | null = null;


type LogoSize = "sm" | "md" | "lg";

const MARK: Record<LogoSize, string> = {
  sm: "h-8 w-8 rounded-lg",
  md: "h-9 w-9 rounded-lg",
  lg: "h-12 w-12 rounded-xl",
};

const ICON: Record<LogoSize, string> = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-7 w-7",
};

const TEXT: Record<LogoSize, string> = {
  sm: "text-base",
  md: "text-lg",
  lg: "text-2xl",
};

interface LogoProps {
  size?: LogoSize;
  showText?: boolean;
  /** Render as a link to "/" (default) or as plain markup. */
  asLink?: boolean;
  className?: string;
}

export function Logo({ size = "md", showText = true, asLink = true, className }: LogoProps) {
  const content = (
    <>
      <span className={cn("grid place-items-center bg-primary text-primary-foreground overflow-hidden", MARK[size])}>
        {LOGO_SRC ? (
          <img src={LOGO_SRC} alt={BRAND_NAME} className="h-full w-full object-cover" />
        ) : (
          <ClipboardList className={ICON[size]} aria-hidden="true" />
        )}
      </span>
      {showText && <span className={cn("tracking-tight", TEXT[size])}>{BRAND_NAME}</span>}
    </>
  );

  const classes = cn("flex items-center gap-2 font-semibold text-foreground", className);

  if (!asLink) return <span className={classes}>{content}</span>;

  return (
    <Link to="/" className={classes} aria-label={BRAND_NAME}>
      {content}
    </Link>
  );
}
