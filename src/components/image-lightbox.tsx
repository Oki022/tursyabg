import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
/** Same feel as photo apps: quick start, soft landing. */
const EASE = "cubic-bezier(0.22, 0.61, 0.36, 1)";
const PAGE_MS = 320;
const CLOSE_MS = 200;
/** Finger travel before we decide between a sideways swipe and a swipe down. */
const AXIS_LOCK_PX = 8;
/** Dark gap between two photos while swiping (px), like in photo apps. */
const SLIDE_GAP = 16;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

type Props = {
  images: string[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  /** Task title, used for alt text and labels. */
  title: string;
};

type Gesture = {
  pointerType: string;
  startX: number;
  startY: number;
  startTime: number;
  axis: "x" | "y" | null;
  moved: boolean;
  /** Recent finger positions, for the flick speed. */
  samples: { t: number; x: number; y: number }[];
  startOffset: { x: number; y: number };
  startZoom: number;
  /** Pinch: distance and midpoint when the second finger came down. */
  pinchDist: number;
  pinchMid: { x: number; y: number };
  pinched: boolean;
};

/**
 * Fullscreen photo viewer, built like the photo viewers of the big apps:
 *  - the photos sit side by side on one strip that follows the finger 1:1;
 *    the neighbours are already loaded, so there is no black gap;
 *  - a flick or a swipe past 20% turns the page with a soft animation, the
 *    first and last photo stretch a little (rubber band);
 *  - pinch / double tap / wheel zoom, drag to pan while zoomed;
 *  - swipe up or down to close;
 *  - the phone's back button closes the viewer and stays on the task.
 * Moves are written straight to the element styles (no React render per
 * frame), so the swipe stays smooth on slower phones.
 */
export function ImageLightbox({ images, index, onIndexChange, onClose, title }: Props) {
  const count = images.length;
  const last = count - 1;

  const stageRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const zoomRefs = useRef<(HTMLDivElement | null)[]>([]);

  const [loaded, setLoaded] = useState<Set<string>>(() => new Set());
  const [zoomed, setZoomed] = useState(false);
  const [closing, setClosing] = useState(false);

  // Live values for the current gesture (not React state: no render per frame).
  const zoom = useRef(1);
  const offset = useRef({ x: 0, y: 0 });
  const dragX = useRef(0);
  const dragY = useRef(0);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<Gesture | null>(null);
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);
  const lastPointerType = useRef("mouse");
  const indexRef = useRef(index);
  indexRef.current = index;

  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  const reduceMotion =
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const ms = (value: number) => (reduceMotion ? 0 : value);

  // ---------- writing styles ----------

  const applyTrack = useCallback((animate: boolean) => {
    const track = trackRef.current;
    if (!track) return;
    track.style.transition = animate
      ? `transform ${ms(PAGE_MS)}ms ${EASE}`
      : "none";
    const i = indexRef.current;
    track.style.transform = `translate3d(calc(${-i * 100}% - ${i * SLIDE_GAP}px + ${dragX.current}px), ${dragY.current}px, 0)`;
    const backdrop = backdropRef.current;
    if (backdrop) {
      const h = stageRef.current?.clientHeight || 800;
      backdrop.style.transition = animate ? `opacity ${ms(PAGE_MS)}ms ${EASE}` : "none";
      backdrop.style.opacity = String(clamp(1 - Math.abs(dragY.current) / (h * 0.6), 0.25, 1));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyZoom = useCallback((animate: boolean) => {
    const el = zoomRefs.current[indexRef.current];
    if (!el) return;
    el.style.transition = animate ? `transform ${ms(220)}ms ${EASE}` : "none";
    el.style.transform = `translate3d(${offset.current.x}px, ${offset.current.y}px, 0) scale(${zoom.current})`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Keeps a zoomed photo from being dragged out of the screen. */
  const clampOffset = (o: { x: number; y: number }, z: number) => {
    const stage = stageRef.current;
    if (!stage) return o;
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    return { x: clamp(o.x, w - w * z, 0), y: clamp(o.y, h - h * z, 0) };
  };

  const setZoomTo = useCallback((target: number, px: number, py: number, animate: boolean) => {
    const z = clamp(target, MIN_ZOOM, MAX_ZOOM);
    const k = z / zoom.current;
    const o = offset.current;
    offset.current =
      z <= MIN_ZOOM ? { x: 0, y: 0 } : clampOffset({ x: px - (px - o.x) * k, y: py - (py - o.y) * k }, z);
    zoom.current = z;
    applyZoom(animate);
    setZoomed(z > MIN_ZOOM);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyZoom]);

  const resetZoom = useCallback((animate: boolean) => {
    zoom.current = 1;
    offset.current = { x: 0, y: 0 };
    applyZoom(animate);
    setZoomed(false);
  }, [applyZoom]);

  // ---------- navigation ----------

  const goTo = useCallback(
    (next: number) => {
      if (count < 2) return;
      const target = clamp(next, 0, last);
      dragX.current = 0;
      dragY.current = 0;
      if (target === indexRef.current) {
        applyTrack(true);
        return;
      }
      // Leave the old photo unzoomed for when the user comes back to it.
      resetZoom(false);
      indexRef.current = target;
      applyTrack(true);
      onIndexChange(target);
    },
    [count, last, applyTrack, resetZoom, onIndexChange],
  );

  const close = useCallback(
    (direction: number) => {
      if (closing) return;
      setClosing(true);
      const h = stageRef.current?.clientHeight || 800;
      dragY.current = direction * h;
      applyTrack(true);
      if (backdropRef.current) backdropRef.current.style.opacity = "0";
      window.setTimeout(() => closeRef.current(), ms(CLOSE_MS));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [closing, applyTrack],
  );

  // Show the current photo: in place when the viewer opens, animated after.
  const mounted = useRef(false);
  useLayoutEffect(() => {
    dragX.current = 0;
    applyTrack(mounted.current);
    mounted.current = true;
  }, [index, applyTrack]);

  // Lock the page behind (the real scroller is <html>, see styles.css).
  useEffect(() => {
    const html = document.documentElement;
    const previous = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = previous;
    };
  }, []);

  // Phone back button / browser back: close the viewer, stay on the task.
  useEffect(() => {
    const marker = `lightbox-${Date.now()}`;
    window.history.pushState({ ...(window.history.state ?? {}), tursyaLightbox: marker }, "");
    let poppedByBack = false;
    const onPop = () => {
      poppedByBack = true;
      closeRef.current();
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      // Closed with X / swipe / Escape: remove the extra history entry again.
      if (!poppedByBack && window.history.state?.tursyaLightbox === marker) window.history.back();
    };
  }, []);

  // Keyboard: Escape closes, arrows navigate.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
      } else if (event.key === "ArrowLeft") {
        goTo(indexRef.current - 1);
      } else if (event.key === "ArrowRight") {
        goTo(indexRef.current + 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo]);

  // Mouse wheel zoom (desktop). Non-passive: React's onWheel cannot preventDefault.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      const dy = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1);
      setZoomTo(zoom.current * Math.exp(-dy * 0.0015), event.clientX - rect.left, event.clientY - rect.top, false);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [setZoomTo]);

  // ---------- gestures ----------

  const local = (x: number, y: number) => {
    const rect = stageRef.current?.getBoundingClientRect();
    return rect ? { x: x - rect.left, y: y - rect.top } : { x, y };
  };

  const pinchInfo = () => {
    const [a, b] = [...pointers.current.values()];
    return {
      dist: Math.hypot(a.x - b.x, a.y - b.y),
      mid: local((a.x + b.x) / 2, (a.y + b.y) / 2),
    };
  };

  const handlePointerDown = (event: React.PointerEvent) => {
    if (closing) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    lastPointerType.current = event.pointerType;
    stageRef.current?.setPointerCapture?.(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.current.size === 2 && gesture.current) {
      // Second finger: start a pinch, cancel any swipe in progress.
      const info = pinchInfo();
      Object.assign(gesture.current, {
        pinchDist: info.dist,
        pinchMid: info.mid,
        startZoom: zoom.current,
        startOffset: { ...offset.current },
        pinched: true,
        moved: true,
      });
      if (dragX.current || dragY.current) {
        dragX.current = 0;
        dragY.current = 0;
        applyTrack(true);
      }
      return;
    }
    if (pointers.current.size > 2) return;

    gesture.current = {
      pointerType: event.pointerType,
      startX: event.clientX,
      startY: event.clientY,
      startTime: event.timeStamp,
      axis: null,
      moved: false,
      samples: [{ t: event.timeStamp, x: event.clientX, y: event.clientY }],
      startOffset: { ...offset.current },
      startZoom: zoom.current,
      pinchDist: 0,
      pinchMid: { x: 0, y: 0 },
      pinched: false,
    };
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const g = gesture.current;
    if (!g) return;

    if (pointers.current.size === 2 && g.pinchDist > 0) {
      const info = pinchInfo();
      const z = clamp((g.startZoom * info.dist) / g.pinchDist, MIN_ZOOM * 0.85, MAX_ZOOM);
      const k = z / g.startZoom;
      // Zoom around the fingers and follow them while they move.
      const o = {
        x: info.mid.x - (g.pinchMid.x - g.startOffset.x) * k,
        y: info.mid.y - (g.pinchMid.y - g.startOffset.y) * k,
      };
      zoom.current = z;
      offset.current = z <= MIN_ZOOM ? o : clampOffset(o, z);
      applyZoom(false);
      return;
    }
    if (pointers.current.size !== 1 || g.pinched) return;

    const dx = event.clientX - g.startX;
    const dy = event.clientY - g.startY;
    if (!g.moved && Math.hypot(dx, dy) > AXIS_LOCK_PX) g.moved = true;
    g.samples.push({ t: event.timeStamp, x: event.clientX, y: event.clientY });
    if (g.samples.length > 6) g.samples.shift();

    if (zoom.current > MIN_ZOOM) {
      offset.current = clampOffset({ x: g.startOffset.x + dx, y: g.startOffset.y + dy }, zoom.current);
      applyZoom(false);
      return;
    }

    if (!g.axis) {
      if (Math.hypot(dx, dy) < AXIS_LOCK_PX) return;
      g.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }

    if (g.axis === "x") {
      const i = indexRef.current;
      // Rubber band on the first and the last photo.
      const atEdge = (i === 0 && dx > 0) || (i === last && dx < 0) || count < 2;
      dragX.current = atEdge ? dx * 0.3 : dx;
      dragY.current = 0;
    } else {
      dragX.current = 0;
      dragY.current = dy;
    }
    applyTrack(false);
  };

  const velocity = (g: Gesture) => {
    const s = g.samples;
    if (s.length < 2) return { vx: 0, vy: 0 };
    const a = s[0];
    const b = s[s.length - 1];
    const dt = Math.max(1, b.t - a.t);
    return { vx: (b.x - a.x) / dt, vy: (b.y - a.y) / dt };
  };

  const handlePointerUp = (event: React.PointerEvent) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.delete(event.pointerId);
    const g = gesture.current;
    if (!g) return;

    if (g.pinched) {
      if (pointers.current.size > 0) {
        // One finger still down: continue as a pan from here.
        const [p] = [...pointers.current.values()];
        Object.assign(g, { startX: p.x, startY: p.y, startOffset: { ...offset.current }, pinchDist: 0 });
        g.pinched = zoom.current <= MIN_ZOOM;
        setZoomed(zoom.current > MIN_ZOOM);
        return;
      }
      gesture.current = null;
      if (zoom.current <= MIN_ZOOM * 1.02) resetZoom(true);
      else setZoomed(true);
      return;
    }
    if (pointers.current.size > 0) return;
    gesture.current = null;

    // Tap: a double tap zooms in / out (the mouse uses dblclick below);
    // a single tap beside the photo closes the viewer.
    if (!g.moved) {
      const now = event.timeStamp;
      const prev = lastTap.current;
      if (
        g.pointerType !== "mouse" &&
        prev &&
        now - prev.t < 300 &&
        Math.hypot(event.clientX - prev.x, event.clientY - prev.y) < 30
      ) {
        lastTap.current = null;
        const p = local(event.clientX, event.clientY);
        if (zoom.current > MIN_ZOOM) resetZoom(true);
        else setZoomTo(2.5, p.x, p.y, true);
        return;
      }
      lastTap.current = { t: now, x: event.clientX, y: event.clientY };
      if (zoom.current <= MIN_ZOOM && (event.target as Element).tagName !== "IMG") {
        // Wait: it may be the first tap of a double tap.
        window.setTimeout(() => {
          if (lastTap.current?.t === now) close(1);
        }, 300);
      }
      return;
    }

    if (zoom.current > MIN_ZOOM) return;

    const { vx, vy } = velocity(g);
    const width = stageRef.current?.clientWidth || window.innerWidth;
    const height = stageRef.current?.clientHeight || window.innerHeight;

    if (g.axis === "x") {
      const dx = dragX.current;
      const i = indexRef.current;
      let next = i;
      if ((dx < -width * 0.2 || vx < -0.35) && i < last) next = i + 1;
      else if ((dx > width * 0.2 || vx > 0.35) && i > 0) next = i - 1;
      dragX.current = 0;
      if (next === i) applyTrack(true);
      else goTo(next);
      return;
    }
    if (g.axis === "y") {
      const dy = dragY.current;
      if (Math.abs(dy) > height * 0.15 || Math.abs(vy) > 0.5) {
        close(dy < 0 ? -1 : 1);
        return;
      }
      dragY.current = 0;
      applyTrack(true);
    }
  };

  const handleDoubleClick = (event: React.MouseEvent) => {
    // Touch double taps are handled in handlePointerUp; this is for the mouse.
    if (lastPointerType.current !== "mouse") return;
    lastTap.current = null; // cancels the pending "click beside the photo closes"
    const p = local(event.clientX, event.clientY);
    if (zoom.current > MIN_ZOOM) resetZoom(true);
    else setZoomTo(2.5, p.x, p.y, true);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Снимки към задачата: ${title}`}
      className={`fixed inset-0 z-[100] flex flex-col overscroll-none ${
        reduceMotion ? "" : "animate-in fade-in duration-200"
      }`}
    >
      <div ref={backdropRef} aria-hidden="true" className="absolute inset-0 bg-black" />

      {/* Top bar */}
      <div className="relative z-10 flex shrink-0 items-center justify-between gap-3 px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] text-white">
        <span aria-hidden="true" className="rounded-full bg-white/15 px-3 py-1 text-sm font-medium tabular-nums">
          {`${index + 1} / ${count}`}
        </span>
        <button
          type="button"
          onClick={() => closeRef.current()}
          aria-label="Затвори снимката"
          className="grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white transition hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
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
        onDoubleClick={handleDoubleClick}
        className={`relative min-h-0 flex-1 touch-none overflow-hidden select-none ${
          zoomed ? "cursor-grab" : ""
        }`}
      >
        <div ref={trackRef} className="flex h-full w-full gap-4 will-change-transform">
          {images.map((src, i) => {
            const near = Math.abs(i - index) <= 1;
            const isLoaded = loaded.has(src);
            return (
              <div
                key={src}
                className="relative h-full w-full shrink-0 overflow-hidden"
                aria-hidden={i !== index}
              >
                {!isLoaded && near && (
                  <div className="pointer-events-none absolute inset-0 grid place-items-center">
                    <Loader2 className="h-8 w-8 animate-spin text-white/70" aria-hidden="true" />
                    {i === index && <span className="sr-only">Снимката се зарежда</span>}
                  </div>
                )}
                <div
                  ref={(el) => {
                    zoomRefs.current[i] = el;
                  }}
                  className="absolute inset-0 flex items-center justify-center"
                  style={{ transformOrigin: "0 0" }}
                >
                  <img
                    src={src}
                    alt={`${title}, снимка ${i + 1} от ${count}`}
                    draggable={false}
                    loading={near ? "eager" : "lazy"}
                    decoding="async"
                    onLoad={() =>
                      setLoaded((prev) => {
                        if (prev.has(src)) return prev;
                        const next = new Set(prev);
                        next.add(src);
                        return next;
                      })
                    }
                    className={`max-h-full max-w-full object-contain transition-opacity duration-200 ${
                      isLoaded ? "opacity-100" : "opacity-0"
                    }`}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => goTo(index - 1)}
              disabled={index === 0}
              aria-label="Предишна снимка"
              className="absolute left-3 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white transition hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-30 sm:grid"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              type="button"
              onClick={() => goTo(index + 1)}
              disabled={index === last}
              aria-label="Следваща снимка"
              className="absolute right-3 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white transition hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-30 sm:grid"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {count > 1 && (
        <div className="relative z-10 shrink-0 overflow-x-auto px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
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
