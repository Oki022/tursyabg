import { useEffect, useState } from "react";

/**
 * Returns true when the header should be hidden (desktop scroll-down).
 * Compares the delta against the previous scroll position on every event:
 * any upward movement of `upThreshold` px reveals the header instantly,
 * downward movement needs `downThreshold` px to hide it (jitter guard).
 */
export function useHideOnScroll(downThreshold = 15, minWidth = 768, upThreshold = 5) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;

    const update = () => {
      ticking = false;
      const y = window.scrollY;
      const isDesktop = window.matchMedia(`(min-width: ${minWidth}px)`).matches;

      if (!isDesktop || y <= downThreshold) {
        lastY = y;
        setHidden(false);
        return;
      }

      const delta = y - lastY;
      lastY = y;

      if (delta <= -upThreshold) {
        setHidden(false);
      } else if (delta >= downThreshold) {
        setHidden(true);
      }
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [downThreshold, minWidth, upThreshold]);

  return hidden;
}
