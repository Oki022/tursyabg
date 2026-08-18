import { useEffect, useState } from "react";

/**
 * Returns true when the header should be hidden (desktop scroll-down).
 * Always false on mobile, at the top of the page, or with reduced motion off-screen concerns.
 */
export function useHideOnScroll(threshold = 10, minWidth = 768) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;

    const update = () => {
      ticking = false;
      const y = window.scrollY;
      const isDesktop = window.matchMedia(`(min-width: ${minWidth}px)`).matches;

      if (!isDesktop || y <= threshold) {
        setHidden(false);
        lastY = y;
        return;
      }
      const delta = y - lastY;
      if (Math.abs(delta) < threshold) return;
      setHidden(delta > 0);
      lastY = y;
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold, minWidth]);

  return hidden;
}
