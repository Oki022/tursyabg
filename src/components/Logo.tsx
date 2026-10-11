import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand";

export const BRAND_NAME = BRAND;

/** Single source of truth for the brand mark (trimmed, transparent PNG). */
export const LOGO_SRC = "/brand/logo-mark-128.png";
const LOGO_SRC_2X = "/brand/logo-mark-256.png";

type LogoSize = "sm" | "md" | "lg";

/*
 * Size rules (mark height = M):
 *   - wordmark cap height ≈ 0.50 × M, so the text sits balanced next to the mark
 *   - the letters get a thin outline (38 font units) so their weight matches the
 *     bold strokes of the mark
 *   - gap between mark and wordmark ≈ 0.30 × M
 *   - md shrinks one step on phones (32px instead of 36px)
 * The wordmark viewBox is centred on the cap height, so items-center lines the
 * letters up with the middle of the mark; the descender of "р" hangs below.
 */
const MARK: Record<LogoSize, string> = {
  sm: "h-7 w-7", // 28px
  md: "h-8 w-8 sm:h-9 sm:w-9", // 32 → 36px
  lg: "h-12 w-12", // 48px
};

const WORDMARK: Record<LogoSize, string> = {
  sm: "h-[22px]", // cap 14px
  md: "h-[25.2px] sm:h-[28.4px]", // cap 16 → 18px
  lg: "h-[37.8px]", // cap 24px
};

const GAP: Record<LogoSize, string> = {
  sm: "gap-2", // 8px
  md: "gap-[10px] sm:gap-[11px]", // 10 → 11px
  lg: "gap-3.5", // 14px
};

/** "ТЪРСЯ.БГ" set in Shoptronic SP and converted to outlines, so no font file is loaded. */
function Wordmark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="7 -707 4564 865"
      className={cn("block w-auto shrink-0 overflow-visible fill-current stroke-current", className)}
      aria-hidden="true"
      focusable="false"
    >
      <path strokeWidth={38} strokeLinejoin="round" d="M578 -496C578 -533 563 -548 526 -548H58C22 -548 7 -533 7 -496C7 -459 22 -444 59 -444H240V-52C240 -15 255 0 292 0H293C330 0 345 -15 345 -52V-444H526C563 -444 578 -459 578 -496ZM1283 -167C1280 -273 1224 -327 1116 -327H810V-548H650C613 -548 598 -533 598 -496C598 -459 613 -444 650 -444H705V-52C706 -15 720 0 757 0H758C795 0 810 -15 810 -52V-222H1119C1161 -222 1178 -205 1178 -163C1178 -121 1161 -105 1119 -105H936C899 -105 885 -90 884 -53V-52C885 -15 899 0 936 0H1116C1224 0 1280 -54 1283 -160ZM1657 -549H1358V106C1358 143 1373 158 1410 158H1411C1448 158 1462 143 1463 106V-444H1657C1786 -444 1825 -405 1825 -277V-273C1825 -145 1786 -106 1657 -106H1589C1552 -105 1537 -91 1537 -54V-53C1537 -16 1552 -1 1589 -1H1657C1843 -1 1930 -86 1930 -273V-277C1930 -464 1844 -549 1657 -549ZM2471 -105H2274C2146 -105 2107 -144 2107 -272V-276C2107 -404 2146 -444 2274 -444H2471C2508 -444 2523 -459 2523 -496C2523 -533 2508 -548 2471 -548H2274C2087 -548 2002 -463 2002 -276V-272C2002 -85 2087 0 2274 0H2471C2508 0 2523 -15 2523 -52V-53C2523 -90 2508 -105 2471 -105ZM2755 -548C2647 -548 2591 -495 2589 -389V-382C2590 -319 2610 -274 2649 -248C2612 -204 2594 -142 2594 -54V-52C2594 -15 2609 0 2646 0H2647C2684 0 2699 -15 2699 -52V-54C2699 -183 2738 -222 2866 -222H2957C2994 -222 3009 -237 3009 -274V-275C3009 -312 2994 -326 2957 -327H2752C2710 -327 2694 -343 2694 -385C2694 -427 2710 -444 2752 -444H3083V-52C3084 -15 3099 0 3135 0H3136C3173 0 3188 -15 3188 -52V-548ZM3352 -134C3313 -134 3282 -103 3282 -64C3282 -25 3313 6 3352 6C3390 6 3421 -25 3421 -64C3421 -103 3390 -134 3352 -134ZM4116 -167C4114 -273 4058 -327 3950 -327H3748C3711 -326 3696 -312 3696 -275V-274C3696 -237 3711 -222 3748 -222H3953C3995 -222 4011 -205 4011 -163C4011 -121 3995 -105 3953 -105H3622V-444H4020C4057 -444 4071 -459 4072 -496C4071 -533 4057 -548 4020 -548H3517V0H3950C4058 0 4114 -54 4116 -160ZM4571 -496C4571 -533 4556 -548 4519 -548H4464C4277 -548 4192 -463 4192 -276V-52C4192 -15 4207 0 4244 0H4245C4282 0 4297 -15 4297 -52V-276C4297 -404 4336 -444 4464 -444H4519C4556 -444 4571 -459 4571 -496Z" />
    </svg>
  );
}

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
      <img
        src={LOGO_SRC}
        srcSet={`${LOGO_SRC} 1x, ${LOGO_SRC_2X} 2x`}
        alt=""
        aria-hidden="true"
        width={128}
        height={128}
        decoding="async"
        className={cn("block shrink-0 object-contain", MARK[size])}
      />
      {showText && <Wordmark className={WORDMARK[size]} />}
    </>
  );

  const classes = cn("flex items-center text-foreground", GAP[size], className);

  if (!asLink) {
    return (
      <span className={classes} role="img" aria-label={BRAND_NAME}>
        {content}
      </span>
    );
  }

  return (
    <Link to="/" className={classes} aria-label={BRAND_NAME}>
      {content}
    </Link>
  );
}
