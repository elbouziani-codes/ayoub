"use client";

import {
  useEffect,
  useRef,
  type HTMLAttributes,
  type PointerEvent,
} from "react";
import "./store-motion.css";

type TiltSurfaceProps = HTMLAttributes<HTMLElement> & { disabled?: boolean };

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
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const sync = () => {
      enabled.current = !disabled && !reduced.matches && fine.matches;
      if (!enabled.current) reset();
    };
    const hide = () => {
      if (document.hidden) reset();
    };
    const invalidateBounds = () => {
      bounds.current = null;
    };
    sync();
    reduced.addEventListener("change", sync);
    fine.addEventListener("change", sync);
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("scroll", invalidateBounds, { passive: true });
    window.addEventListener("resize", invalidateBounds, { passive: true });
    return () => {
      reduced.removeEventListener("change", sync);
      fine.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("scroll", invalidateBounds);
      window.removeEventListener("resize", invalidateBounds);
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
      bounds.current ||= element.getBoundingClientRect();
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
