"use client";

import {
  useEffect,
  useRef,
  type HTMLAttributes,
  type PointerEvent,
} from "react";
import "./store-motion.css";

type TiltSurfaceProps = HTMLAttributes<HTMLElement> & { disabled?: boolean };

// A product grid shares its environment listeners instead of registering five
// window/document listeners for every card.
const environmentSubscribers = new Set<() => void>();
let environmentEnabled = false;
let layoutVersion = 0;
let stopEnvironment: (() => void) | null = null;

function subscribeEnvironment(subscriber: () => void) {
  if (!stopEnvironment) {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const sync = () => {
      environmentEnabled = !reduced.matches && fine.matches && !document.hidden;
      for (const notify of environmentSubscribers) notify();
    };
    const invalidate = () => {
      layoutVersion++;
    };
    reduced.addEventListener("change", sync);
    fine.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("scroll", invalidate, { passive: true });
    window.addEventListener("resize", invalidate, { passive: true });
    stopEnvironment = () => {
      reduced.removeEventListener("change", sync);
      fine.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("scroll", invalidate);
      window.removeEventListener("resize", invalidate);
    };
    sync();
  }
  environmentSubscribers.add(subscriber);
  subscriber();
  return () => {
    environmentSubscribers.delete(subscriber);
    if (!environmentSubscribers.size) {
      stopEnvironment?.();
      stopEnvironment = null;
    }
  };
}

/** Small, mouse-only depth cues; touch and keyboard retain a stationary surface. */
export default function TiltSurface({
  children,
  className = "",
  disabled = false,
  onPointerEnter,
  onPointerMove,
  onPointerLeave,
  ...props
}: TiltSurfaceProps) {
  const surface = useRef<HTMLElement>(null);
  const enabled = useRef(false);
  const frame = useRef(0);
  const bounds = useRef<DOMRect | null>(null);
  const boundsVersion = useRef(-1);
  const pointer = useRef({ x: 0, y: 0 });

  const reset = () => {
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = 0;
    bounds.current = null;
    const element = surface.current;
    if (!element) return;
    element.style.removeProperty("--tilt-x");
    element.style.removeProperty("--tilt-y");
    element.style.removeProperty("--shine-x");
    element.style.removeProperty("--shine-y");
    element.removeAttribute("data-tilting");
  };

  useEffect(() => {
    if (disabled) {
      enabled.current = false;
      reset();
      return;
    }
    const unsubscribe = subscribeEnvironment(() => {
      enabled.current = environmentEnabled;
      if (!enabled.current) reset();
    });
    return () => {
      unsubscribe();
      reset();
    };
  }, [disabled]);

  const move = (event: PointerEvent<HTMLElement>) => {
    onPointerMove?.(event);
    const element = surface.current;
    if (
      !element ||
      event.pointerType !== "mouse" ||
      !enabled.current ||
      document.hidden ||
      element.closest('[data-motion="paused"]')
    )
      return;
    pointer.current = { x: event.clientX, y: event.clientY };
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      if (!bounds.current || boundsVersion.current !== layoutVersion) {
        bounds.current = element.getBoundingClientRect();
        boundsVersion.current = layoutVersion;
      }
      const rect = bounds.current;
      const x = Math.max(
        0,
        Math.min(1, (pointer.current.x - rect.left) / Math.max(1, rect.width)),
      );
      const y = Math.max(
        0,
        Math.min(1, (pointer.current.y - rect.top) / Math.max(1, rect.height)),
      );
      element.style.setProperty("--tilt-x", `${((0.5 - y) * 9).toFixed(2)}deg`);
      element.style.setProperty("--tilt-y", `${((x - 0.5) * 9).toFixed(2)}deg`);
      element.style.setProperty("--shine-x", `${(x * 100).toFixed(1)}%`);
      element.style.setProperty("--shine-y", `${(y * 100).toFixed(1)}%`);
      element.dataset.tilting = "true";
    });
  };

  return (
    <article
      {...props}
      ref={surface}
      className={`tilt-surface ${className}`}
      onPointerEnter={(event) => {
        bounds.current = null;
        onPointerEnter?.(event);
      }}
      onPointerMove={move}
      onPointerLeave={(event) => {
        reset();
        onPointerLeave?.(event);
      }}
    >
      {children}
    </article>
  );
}
