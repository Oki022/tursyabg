import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

type Props = {
  images: string[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  /** Task title, used for alt text and labels. */
  title: string;
};

/**
 * Fullscreen image viewer: swipe / arrows / keyboard navigation,
 * wheel + pinch zoom with panning, swipe-down and backdrop-tap to close.
 */
export function ImageLightbox({ images, index, onIndexChange, onClose, title }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [loaded, setLoaded] = useState(false);
  const [drag, setDrag] = useState({ x: 0, y: 0 });

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{
    startX: number;
    startY: number;
    startOffset: { x: number; y: number };
    startZoom: number;
    startDist: number;
    moved: boolean;
  } | null>(null);

  const count = images.length;
  const src = images[index];

  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const resetView = useCallback(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setDrag({ x: 0, y: 0 });
  }, []);

  const goTo = useCallback(
    (next: number) => {
      if (count < 2) return;
      resetView();
      setLoaded(false);
      onIndexChange((next + count) % count);
    },
    [count, onIndexChange, resetView],
  );

  // Reset the zoom whenever a different photo is shown.
  useEffect(() => {
    resetView();
    setLoaded(false);
  }, [index, resetView]);

  // Body scroll lock while open.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // Keyboard: Escape closes, arrows navigate.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "ArrowLeft") {
        goTo(index - 1);
      } else if (event.key === "ArrowRight") {
        goTo(index + 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo, index, onClose]);

  const zoomAt = useCallback((nextZoom: number, px: number, py: number) => {
    setZoom((current) => {
      const target = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
      const k = target / current;
      setOffset((o) =>
        target === MIN_ZOOM ? { x: 0, y: 0 } : { x: px - (px - o.x) * k, y: py - (py - o.y) * k },
      );
      return target;
    });
  }, []);

  // Non-passive wheel listener: React's onWheel cannot preventDefault.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      const dy = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1);
      setZoom((current) => {
        const target = clamp(current * Math.exp(-dy * 0.0015), MIN_ZOOM, MAX_ZOOM);
        const k = target / current;
        const px = event.clientX - rect.left;
        const py = event.clientY - rect.top;
        setOffset((o) =>
          target === MIN_ZOOM ? { x: 0, y: 0 } : { x: px - (px - o.x) * k, y: py - (py - o.y) * k },
        );
        return target;
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const distance = () => {
    const [a, b] = [...pointers.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const handlePointerDown = (event: React.PointerEvent) => {
    (event.target as Element).setPointerCapture?.(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    gesture.current = {
      startX: event.clientX,
      startY: event.clientY,
      startOffset: offset,
      startZoom: zoom,
      startDist: pointers.current.size === 2 ? distance() : 0,
      moved: false,
    };
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const g = gesture.current;
    if (!g) return;

    // Two fingers: pinch zoom around the midpoint.
    if (pointers.current.size === 2) {
      const rect = stageRef.current?.getBoundingClientRect();
      const points = [...pointers.current.values()];
      if (!rect) return;
      if (!g.startDist) {
        g.startDist = distance();
        g.startZoom = zoom;
        return;
      }
      const mx = (points[0].x + points[1].x) / 2 - rect.left;
      const my = (points[0].y + points[1].y) / 2 - rect.top;
      zoomAt((g.startZoom * distance()) / g.startDist, mx, my);
      g.moved = true;
      return;
    }

    const dx = event.clientX - g.startX;
    const dy = event.clientY - g.startY;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) g.moved = true;

    if (zoom > MIN_ZOOM) {
      setOffset({ x: g.startOffset.x + dx, y: g.startOffset.y + dy });
    } else {
      setDrag({ x: dx, y: Math.max(0, dy) });
    }
  };

  const handlePointerUp = (event: React.PointerEvent) => {
    pointers.current.delete(event.pointerId);
    const g = gesture.current;
    if (pointers.current.size > 0) return;
    gesture.current = null;
    if (!g) return;

    if (zoom > MIN_ZOOM) return;

    const { x, y } = drag;
    setDrag({ x: 0, y: 0 });

    if (y > 110 && Math.abs(y) > Math.abs(x)) {
      onClose();
      return;
    }
    if (Math.abs(x) > 60 && Math.abs(x) > Math.abs(y)) {
      goTo(index + (x < 0 ? 1 : -1));
      return;
    }
    // A tap that never moved and landed on the backdrop closes the viewer.
    if (!g.moved && event.target === event.currentTarget) onClose();
  };

  const transition = reduceMotion
    ? undefined
    : gesture.current
      ? undefined
      : "transform 200ms ease-out";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Снимки към задачата: ${title}`}
      className={`fixed inset-0 z-[100] flex flex-col bg-slate-950/95 backdrop-blur-sm ${
        reduceMotion ? "" : "animate-in fade-in duration-200"
      }`}
      style={{ opacity: drag.y > 0 ? Math.max(0.4, 1 - drag.y / 400) : 1 }}
    >
      {/* Top bar */}
      <div className="flex shrink-0 items-center justify-between gap-3 px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] text-white">
        <span aria-hidden="true" className="rounded-full bg-white/10 px-3 py-1 text-sm font-medium">
          {count > 1 ? `${index + 1} / ${count}` : "1 / 1"}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Затвори снимката"
          className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <p aria-live="polite" className="sr-only">
        {`Снимка ${index + 1} от ${count}`}
      </p>

      {/* Stage */}
      <div
        ref={stageRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={(event) => {
          const rect = stageRef.current?.getBoundingClientRect();
          if (!rect) return;
          zoomAt(zoom > 1 ? 1 : 2.5, event.clientX - rect.left, event.clientY - rect.top);
        }}
        className="relative min-h-0 flex-1 touch-none overflow-hidden select-none"
      >
        {!loaded && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <Loader2 className="h-8 w-8 animate-spin text-white/70" aria-hidden="true" />
            <span className="sr-only">Снимката се зарежда</span>
          </div>
        )}

        <div
          className="absolute inset-0"
          style={{
            transformOrigin: "0 0",
            transform: `translate(${offset.x + drag.x}px, ${offset.y + drag.y}px) scale(${zoom})`,
            transition,
          }}
        >
          <img
            key={src}
            src={src}
            alt={`${title}, снимка ${index + 1} от ${count}`}
            draggable={false}
            onLoad={() => setLoaded(true)}
            className={`h-full w-full object-contain transition-opacity duration-200 ${
              loaded ? "opacity-100" : "opacity-0"
            }`}
          />
        </div>

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => goTo(index - 1)}
              aria-label="Предишна снимка"
              className="absolute left-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:grid"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              type="button"
              onClick={() => goTo(index + 1)}
              aria-label="Следваща снимка"
              className="absolute right-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:grid"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {count > 1 && (
        <div className="shrink-0 overflow-x-auto px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
          <div className="mx-auto flex w-max gap-2">
            {images.map((thumb, i) => (
              <button
                key={thumb}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Покажи снимка ${i + 1}`}
                aria-current={i === index}
                className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                  i === index ? "border-white" : "border-transparent opacity-60 hover:opacity-100"
                }`}
              >
                <img src={thumb} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
