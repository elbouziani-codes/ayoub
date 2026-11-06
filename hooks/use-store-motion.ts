"use client";

import { useEffect, type RefObject } from "react";

/** Event-driven storefront motion. There is deliberately no perpetual render loop. */
export function useStoreMotion(
  rootRef: RefObject<HTMLDivElement | null>,
  paused: boolean,
) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const precisePointer = window.matchMedia(
      "(hover: hover) and (pointer: fine)",
    );
    let revealObserver: IntersectionObserver | null = null;
    let frame = 0;
    let heroFrame = 0;
    let activeHero: HTMLElement | null = null;
    let heroX = 0;
    let heroY = 0;
    let heroBounds: DOMRect | null = null;
    const heroes = new Set<HTMLElement>();

    const motionAllowed = () => !paused && !reducedMotion.matches;

    const reveal = (element: HTMLElement) => {
      element.classList.add("is-revealed");
      revealObserver?.unobserve(element);
    };

    const observeElement = (element: HTMLElement) => {
      if (element.classList.contains("is-revealed")) return;
      const index = Number(element.dataset.revealIndex || "0");
      element.style.setProperty(
        "--reveal-delay",
        `${Math.max(0, Math.min(Number.isFinite(index) ? index : 0, 5)) * 65}ms`,
      );
      if (revealObserver && motionAllowed()) revealObserver.observe(element);
      else reveal(element);
    };

    const discover = (node: HTMLElement) => {
      if (node.matches("[data-reveal]")) observeElement(node);
      node
        .querySelectorAll<HTMLElement>("[data-reveal]")
        .forEach(observeElement);
      const attachHero = (hero: HTMLElement) => {
        if (heroes.has(hero)) return;
        heroes.add(hero);
        hero.addEventListener("pointermove", moveHero, { passive: true });
        hero.addEventListener("pointerleave", resetHero, { passive: true });
      };
      if (node.matches(".hero-interactive")) attachHero(node);
      node
        .querySelectorAll<HTMLElement>(".hero-interactive")
        .forEach(attachHero);
    };

    const resetHero = () => {
      if (heroFrame) cancelAnimationFrame(heroFrame);
      heroFrame = 0;
      activeHero?.style.setProperty("--hero-x", "0");
      activeHero?.style.setProperty("--hero-y", "0");
      activeHero = null;
      heroBounds = null;
    };

    const configureMotion = () => {
      revealObserver?.disconnect();
      revealObserver = null;
      root.classList.remove("motion-ready");
      root.dataset.motion = motionAllowed() ? "running" : "paused";
      if (motionAllowed() && "IntersectionObserver" in window) {
        revealObserver = new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (entry.isIntersecting) reveal(entry.target as HTMLElement);
            }
          },
          { rootMargin: "0px 0px 48px 0px", threshold: 0.08 },
        );
      }
      discover(root);
      // Add only after the observer exists: failed JS can never hide the shop.
      if (revealObserver) root.classList.add("motion-ready");
      if (!motionAllowed()) resetHero();
    };

    const updateScroll = () => {
      frame = 0;
      const scrollTop = window.scrollY;
      const scrollable =
        document.documentElement.scrollHeight - window.innerHeight;
      const progress =
        scrollable > 0
          ? Math.min(100, Math.max(0, (scrollTop / scrollable) * 100))
          : 0;
      root.style.setProperty("--scroll-progress", `${progress.toFixed(2)}%`);
      root.dataset.scrolled = scrollTop > 24 ? "true" : "false";
      // A page scroll changes the hero's viewport coordinates.
      heroBounds = null;
    };

    const queueScroll = () => {
      if (!frame && !document.hidden)
        frame = requestAnimationFrame(updateScroll);
    };

    const moveHero = (event: PointerEvent) => {
      if (
        event.pointerType !== "mouse" ||
        !motionAllowed() ||
        !precisePointer.matches ||
        document.hidden
      )
        return;
      const target =
        event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
      if (!target || !root.contains(target)) {
        if (activeHero) resetHero();
        return;
      }
      if (activeHero !== target) {
        resetHero();
        activeHero = target;
      }
      heroBounds ||= target.getBoundingClientRect();
      heroX = Math.max(
        -1,
        Math.min(
          1,
          ((event.clientX - heroBounds.left) / Math.max(1, heroBounds.width)) *
            2 -
            1,
        ),
      );
      heroY = Math.max(
        -1,
        Math.min(
          1,
          ((event.clientY - heroBounds.top) / Math.max(1, heroBounds.height)) *
            2 -
            1,
        ),
      );
      if (!heroFrame) {
        heroFrame = requestAnimationFrame(() => {
          heroFrame = 0;
          activeHero?.style.setProperty("--hero-x", heroX.toFixed(3));
          activeHero?.style.setProperty("--hero-y", heroY.toFixed(3));
        });
      }
    };

    const visibility = () => {
      root.classList.toggle("motion-suspended", document.hidden);
      if (document.hidden) {
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
        resetHero();
      } else queueScroll();
    };

    configureMotion();
    updateScroll();
    const mutations = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node instanceof HTMLElement) discover(node);
        }
      }
      queueScroll();
    });
    // Only added subtrees are scanned, never the complete product grid per update.
    mutations.observe(root, { childList: true, subtree: true });
    const resizeObserver =
      "ResizeObserver" in window ? new ResizeObserver(queueScroll) : null;
    resizeObserver?.observe(root);
    window.addEventListener("scroll", queueScroll, { passive: true });
    window.addEventListener("resize", queueScroll, { passive: true });
    document.addEventListener("visibilitychange", visibility);
    // Pointer listeners are installed only on the interactive hero surfaces.
    reducedMotion.addEventListener("change", configureMotion);
    precisePointer.addEventListener("change", resetHero);

    return () => {
      revealObserver?.disconnect();
      mutations.disconnect();
      resizeObserver?.disconnect();
      if (frame) cancelAnimationFrame(frame);
      resetHero();
      window.removeEventListener("scroll", queueScroll);
      window.removeEventListener("resize", queueScroll);
      document.removeEventListener("visibilitychange", visibility);
      for (const hero of heroes) {
        hero.removeEventListener("pointermove", moveHero);
        hero.removeEventListener("pointerleave", resetHero);
      }
      reducedMotion.removeEventListener("change", configureMotion);
      precisePointer.removeEventListener("change", resetHero);
      root.classList.remove("motion-ready", "motion-suspended");
    };
  }, [paused, rootRef]);
}
