"use client";

import { useEffect, useRef, type HTMLAttributes, type PointerEvent } from "react";

/** Shared glass material. Pointer lighting updates CSS without React renders. */
export default function LiquidGlass({
  className = "",
  children,
  onPointerMove,
  onPointerLeave,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  const frame = useRef(0);
  const pointer = useRef({ x: 0, y: 0 });
  const enabled = useRef(false);
  useEffect(() => {
    const media = window.matchMedia(
      "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
    );
    const sync = () => {
      enabled.current = media.matches;
      if (!media.matches && frame.current) {
        cancelAnimationFrame(frame.current);
        frame.current = 0;
      }
    };
    sync();
    media.addEventListener("change", sync);
    return () => {
      media.removeEventListener("change", sync);
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, []);

  function illuminate(event: PointerEvent<HTMLDivElement>) {
    onPointerMove?.(event);
    if (event.pointerType !== "mouse" || !enabled.current || document.hidden)
      return;
    const surface = event.currentTarget;
    if (surface.closest('[data-motion="paused"]')) return;
    pointer.current.x = event.clientX;
    pointer.current.y = event.clientY;
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      if (document.hidden) return;
      const bounds = surface.getBoundingClientRect();
      surface.style.setProperty("--glass-light-x", `${pointer.current.x - bounds.left}px`);
      surface.style.setProperty("--glass-light-y", `${pointer.current.y - bounds.top}px`);
    });
  }
  return (
    <div
      {...props}
      className={`liquid-glass ${className}`}
      onPointerMove={illuminate}
      onPointerLeave={(event) => {
        if (frame.current) cancelAnimationFrame(frame.current);
        frame.current = 0;
        onPointerLeave?.(event);
      }}
    >
      {children}
    </div>
  );
}
