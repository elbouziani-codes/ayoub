"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { formatMoney, productDetail, productName, type Locale, type TranslationKey } from "@/lib/i18n";
import { productImageSet } from "@/lib/product-images";
import type { Product } from "@/lib/types";
import LiquidGlass from "./liquid-glass";

/** Keep carousel updates local so rotating a watch never rerenders the catalog. */
export default function HeroWatch({ products, locale, copy, paused, onSelect }: {
  products: Product[];
  locale: Locale;
  copy: Record<TranslationKey, string>;
  paused: boolean;
  onSelect: (product: Product) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [documentVisible, setDocumentVisible] = useState(true);
  // Keep the server-rendered watch visible before hydration; CSS honors reduced motion.
  const [reducedMotion, setReducedMotion] = useState(false);
  const featured = useMemo(() => products.filter((product) => product.featured), [products]);
  const activeIndex = featured.length ? index % featured.length : 0;
  const hero = featured[activeIndex] || products[0];
  const active = visible && documentVisible && !paused && !reducedMotion;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => setReducedMotion(media.matches);
    const syncVisibility = () => setDocumentVisible(!document.hidden);
    syncMotion();
    syncVisibility();
    media.addEventListener("change", syncMotion);
    document.addEventListener("visibilitychange", syncVisibility);
    const observer = "IntersectionObserver" in window
      ? new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting))
      : null;
    if (root.current) observer?.observe(root.current);
    return () => {
      observer?.disconnect();
      media.removeEventListener("change", syncMotion);
      document.removeEventListener("visibilitychange", syncVisibility);
    };
  }, []);

  useEffect(() => {
    if (!active || featured.length < 2) return;
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % featured.length), 6500);
    return () => window.clearInterval(timer);
  }, [active, featured.length]);

  return (
    <div ref={root} className="hero-visual hero-interactive" data-hero-active={active}>
      <div className="hero-aura" />
      <div className="orbit" />
      <div className="hero-orbit-ring" aria-hidden="true" />
      <div className="hero-spec">
        {copy.precision}
        <strong>{hero ? productDetail(hero, locale, "caseSize") : "42 mm"} · {copy.steel}</strong>
      </div>
      <div className="hero-watch-stage">
        <img
          key={hero?.id || "hero"}
          className="hero-watch"
          src={hero?.images[0] || "/images/watch-hero.webp"}
          srcSet={productImageSet(hero?.images[0] || "/images/watch-hero.webp")}
          sizes="(max-width: 440px) 425px, (max-width: 1020px) 485px, (max-width: 1230px) 565px, (min-width: 1600px) 700px, 640px"
          alt={hero ? productName(hero, locale) : "Silver and black chronograph watch"}
          fetchPriority={index === 0 ? "high" : "auto"}
          width="1254"
          height="1254"
        />
        <div className="hero-glint" aria-hidden="true" />
      </div>
      <div className="hero-index">
        <b>{String(activeIndex + 1).padStart(2, "0")}</b>
        <i />{String(Math.max(featured.length, 1)).padStart(2, "0")}
      </div>
      {hero && (
        <LiquidGlass key={hero.id} className="floating-product glass">
          <div>
            <div className="eyebrow">{copy.featured}</div>
            <h3>{productName(hero, locale)}</h3>
            <p>{formatMoney(hero.price, locale)} <span>{locale === "ar" ? "درهم" : "MAD"}</span></p>
          </div>
          <button onClick={() => onSelect(hero)} aria-label={`${copy.productDetails}: ${productName(hero, locale)}`}>
            <ArrowUpRight />
          </button>
        </LiquidGlass>
      )}
      <div className="hero-slides" role="group" aria-label={copy.collections}>
        {featured.map((product, slide) => (
          <button
            key={product.id}
            aria-label={productName(product, locale)}
            aria-pressed={activeIndex === slide}
            className={activeIndex === slide ? "active" : ""}
            onClick={() => setIndex(slide)}
          />
        ))}
      </div>
    </div>
  );
}
