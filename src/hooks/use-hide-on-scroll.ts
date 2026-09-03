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
    let upwardDistance = 0;
    let downwardDistance = 0;
    let ticking = false;

    const update = () => {
      ticking = false;
      const y = window.scrollY;
      const isDesktop = window.matchMedia(`(min-width: ${minWidth}px)`).matches;

      if (!isDesktop || y <= downThreshold) {
        lastY = y;
        upwardDistance = 0;
        downwardDistance = 0;
        setHidden(false);
        return;
      }

      const delta = y - lastY;
      lastY = y;

      // TEMP DIAGNOSTIC
      console.log("[hide]", JSON.stringify({ y, prev: y - delta, delta, up: upwardDistance, down: downwardDistance }));
      if (delta < 0) {
        upwardDistance += -delta;
        downwardDistance = 0;
        if (upwardDistance >= upThreshold) setHidden(false);
      } else if (delta > 0) {
        downwardDistance += delta;
        upwardDistance = 0;
        if (downwardDistance >= downThreshold) setHidden(true);
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
