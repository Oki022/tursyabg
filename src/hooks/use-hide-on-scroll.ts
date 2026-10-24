import { useEffect, useState } from "react";

/** Distance (px) to scroll in one direction before the header hides. */
const HIDE_AFTER = 40;

/**
 * True while a menu, dialog or popover is open. Radix locks the page scroll
 * (data-scroll-locked on <body>) and marks the open trigger with
 * data-state="open". Opening it can move the page by a few pixels; the
 * header must not slide away then, or the menu goes off screen with it while
 * the rest of the page stays blocked.
 */
function overlayOpen(): boolean {
  return (
    document.body.hasAttribute("data-scroll-locked") ||
    !!document.querySelector('header [aria-expanded="true"], header [data-state="open"]')
  );
}

/** Returns true when the header should be hidden on desktop scroll-down. */
export function useHideOnScroll(minWidth = 768) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    // Where the current scroll-down started; slow scrolling adds up too.
    let downFrom = lastY;

    function onScroll() {
      const y = window.scrollY;
      const isDesktop = window.matchMedia(`(min-width: ${minWidth}px)`).matches;

      if (!isDesktop || y < 10 || overlayOpen()) {
        setHidden(false);
        downFrom = y;
      } else if (y < lastY) {
        setHidden(false);
        downFrom = y;
      } else if (y - downFrom > HIDE_AFTER) {
        setHidden(true);
      }

      lastY = y;
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [minWidth]);

  return hidden;
}
