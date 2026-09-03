import { useEffect, useState } from "react";

/** Returns true when the header should be hidden on desktop scroll-down. */
export function useHideOnScroll(minWidth = 768) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;

    function onScroll() {
      const y = window.scrollY;
      const isDesktop = window.matchMedia(`(min-width: ${minWidth}px)`).matches;

      if (!isDesktop || y < 10) {
        setHidden(false);
      } else if (y < lastY) {
        setHidden(false);
      } else if (y > lastY + 15) {
        setHidden(true);
      }

      lastY = y;
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [minWidth]);

  return hidden;
}
