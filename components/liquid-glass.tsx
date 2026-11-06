"use client";

import type { HTMLAttributes, PointerEvent } from "react";

/** Shared glass material. Pointer lighting updates CSS without React renders. */
export default function LiquidGlass({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  function illuminate(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse") return;
    const surface = event.currentTarget;
    const bounds = surface.getBoundingClientRect();
    surface.style.setProperty(
      "--glass-light-x",
      `${event.clientX - bounds.left}px`,
    );
    surface.style.setProperty(
      "--glass-light-y",
      `${event.clientY - bounds.top}px`,
    );
  }
  return (
    <div
      {...props}
      className={`liquid-glass ${className}`}
      onPointerMove={illuminate}
    >
      {children}
    </div>
  );
}
