import { useEffect, useState } from "react";

/**
 * Returns true when the header should be hidden (desktop scroll-down).
 * Deliberately simple: any upward movement reveals the header immediately,
 * downward movement hides it after `downThreshold` px (jitter guard).
 */
export function useHideOnScroll(downThreshold = 15, minWidth = 768) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    let downwardDistance = 0;
    let ticking = false;

    const update = () => {
      ticking = false;
      const y = window.scrollY;
      const isDesktop = window.matchMedia(`(min-width: ${minWidth}px)`).matches;

      if (!isDesktop || y <= downThreshold) {
        lastY = y;
        downwardDistance = 0;
        setHidden(false);
        return;
      }

      const delta = y - lastY;
      lastY = y;

      if (delta < 0) {
        downwardDistance = 0;
        setHidden(false);
      } else if (delta > 0) {
        downwardDistance += delta;
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
  }, [downThreshold, minWidth]);

  return hidden;
}
