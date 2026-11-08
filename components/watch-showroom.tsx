"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  MoveHorizontal,
  Pause,
  Play,
  Plus,
  Minus,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import type { WatchFinish, WatchScene, WatchView } from "./watch-scene";
import { productImageSet } from "@/lib/product-images";
import "./watch-showroom.css";

const COPY = {
  en: {
    eyebrow: "THE INTERACTIVE ATELIER",
    title: "Every angle.",
    titleAccent: "Extraordinary.",
    body: "A closer look at the details that make time personal. Turn it. Change the finish. Find your perspective.",
    finishLabel: "EXPLORE A FINISH",
    midnight: "Midnight",
    azure: "Azure",
    champagne: "Champagne",
    finishHint: "Three expressions. One point of view.",
    cta: "Shop the collection",
    study:
      "Interactive design study. Explore actual products in our collection.",
    drag: "Drag to explore",
    loading: "Preparing your perspective",
    loadInteractive: "Explore in 3D",
    fallback: "A closer look, in every detail.",
    fallbackHint: "The interactive view is unavailable on this device.",
    live: "REAL-TIME 3D",
    paused: "MOTION PAUSED",
    motionOff: "Motion reduced",
    front: "Dial",
    profile: "Profile",
    back: "Caseback",
    reset: "Reset view",
    rotateLeft: "Rotate left",
    rotateRight: "Rotate right",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    pause: "Pause automatic rotation",
    play: "Start automatic rotation",
    accessible:
      "Interactive 3D watch. Drag horizontally or use the view controls. Arrow keys rotate; plus and minus zoom.",
    steel: "Sculpted metal",
    dial: "Sunburst dial",
    detail: "DETAIL IS EVERYTHING",
    model: "ATELIER / 001",
    keyboard: "Rotate and zoom controls",
    views: "Choose a viewing angle",
    finishes: "Choose a design-study finish",
  },
  fr: {
    eyebrow: "L’ATELIER INTERACTIF",
    title: "Chaque angle.",
    titleAccent: "Extraordinaire.",
    body: "Approchez les détails qui rendent le temps personnel. Tournez. Changez la finition. Trouvez votre perspective.",
    finishLabel: "EXPLOREZ UNE FINITION",
    midnight: "Minuit",
    azure: "Azur",
    champagne: "Champagne",
    finishHint: "Trois expressions. Un même regard.",
    cta: "Voir la collection",
    study:
      "Étude de design interactive. Retrouvez nos produits dans la collection.",
    drag: "Glissez pour explorer",
    loading: "Préparation de votre perspective",
    loadInteractive: "Explorer en 3D",
    fallback: "Au plus près de chaque détail.",
    fallbackHint: "La vue interactive est indisponible sur cet appareil.",
    live: "3D EN TEMPS RÉEL",
    paused: "ANIMATION EN PAUSE",
    motionOff: "Animations réduites",
    front: "Cadran",
    profile: "Profil",
    back: "Fond",
    reset: "Réinitialiser la vue",
    rotateLeft: "Tourner à gauche",
    rotateRight: "Tourner à droite",
    zoomIn: "Agrandir",
    zoomOut: "Réduire",
    pause: "Arrêter la rotation automatique",
    play: "Démarrer la rotation automatique",
    accessible:
      "Montre 3D interactive. Glissez horizontalement ou utilisez les commandes. Les flèches tournent ; plus et moins zooment.",
    steel: "Métal sculpté",
    dial: "Cadran soleil",
    detail: "LE DÉTAIL FAIT TOUT",
    model: "ATELIER / 001",
    keyboard: "Commandes de rotation et de zoom",
    views: "Choisir un angle de vue",
    finishes: "Choisir une finition de l’étude de design",
  },
  ar: {
    eyebrow: "الأتيليه التفاعلي",
    title: "كل زاوية.",
    titleAccent: "استثنائية.",
    body: "اقترب من التفاصيل التي تمنح الوقت طابعك الخاص. أدر الساعة، غيّر لونها، واكتشف منظورك.",
    finishLabel: "اكتشف الألوان",
    midnight: "منتصف الليل",
    azure: "أزرق سماوي",
    champagne: "شامبانيا",
    finishHint: "ثلاثة ألوان. رؤية واحدة.",
    cta: "تسوّق المجموعة",
    study: "دراسة تصميم تفاعلية. اكتشف المنتجات الفعلية في مجموعتنا.",
    drag: "اسحب للاستكشاف",
    loading: "جارٍ تجهيز العرض",
    loadInteractive: "استكشف بتقنية ثلاثية الأبعاد",
    fallback: "اكتشف جمال كل تفصيل.",
    fallbackHint: "العرض التفاعلي غير متاح على هذا الجهاز.",
    live: "عرض ثلاثي الأبعاد مباشر",
    paused: "الحركة متوقفة",
    motionOff: "حركة مخفّضة",
    front: "الميناء",
    profile: "الجانب",
    back: "الخلف",
    reset: "إعادة ضبط العرض",
    rotateLeft: "تدوير لليسار",
    rotateRight: "تدوير لليمين",
    zoomIn: "تكبير",
    zoomOut: "تصغير",
    pause: "إيقاف الدوران التلقائي",
    play: "بدء الدوران التلقائي",
    accessible:
      "ساعة تفاعلية ثلاثية الأبعاد. اسحب أفقياً أو استخدم أزرار التحكم. الأسهم للتدوير وعلامتا الجمع والطرح للتكبير والتصغير.",
    steel: "معدن مصقول",
    dial: "ميناء بأشعة شمسية",
    detail: "التفاصيل تصنع الفرق",
    model: "أتيليه / 001",
    keyboard: "أزرار التدوير والتكبير",
    views: "اختر زاوية العرض",
    finishes: "اختر لون دراسة التصميم",
  },
} as const;

const FINISH_IMAGES: Record<WatchFinish, string> = {
  midnight: "/images/watch-hero.webp",
  azure: "/images/watch-blue.webp",
  champagne: "/images/watch-gold.webp",
};

export default function WatchShowroom({
  locale,
  paused = false,
  onShop,
}: {
  locale: "en" | "fr" | "ar";
  paused?: boolean;
  onShop: () => void;
}) {
  const copy = COPY[locale];
  const hostRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const sceneRef = useRef<WatchScene | null>(null);
  const startSceneRef = useRef<(() => void) | null>(null);
  const [status, setStatus] = useState<
    "idle" | "deferred" | "loading" | "ready" | "fallback"
  >("idle");
  const [finish, setFinish] = useState<WatchFinish>("midnight");
  const [autoRotate, setAutoRotate] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [view, setView] = useState<WatchView | null>(null);
  const finishRef = useRef(finish);
  const autoRotateRef = useRef(autoRotate);
  const pausedRef = useRef(paused);
  const reducedRef = useRef(false);
  useEffect(() => {
    finishRef.current = finish;
    autoRotateRef.current = autoRotate;
    pausedRef.current = paused;
  }, [finish, autoRotate, paused]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      reducedRef.current = media.matches;
      setReducedMotion(media.matches);
      sceneRef.current?.setMotion(!media.matches && !pausedRef.current);
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    const section = sectionRef.current;
    if (!host || !section) return;
    let cancelled = false;
    let started = false;
    let visible = false;
    const connection = (navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }).connection;
    // Keep photography usable without downloading WebGL on constrained networks.
    const deferLoad = connection?.saveData ||
      connection?.effectiveType === "slow-2g" || connection?.effectiveType === "2g";
    // Pausing stops the animation loop; direct controls still render one frame.
    const updateActivity = () =>
      sceneRef.current?.setActive(visible && !document.hidden);
    const fail = () => {
      if (cancelled) return;
      setStatus("fallback");
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
    const start = async () => {
      if (started || cancelled) return;
      started = true;
      setStatus("loading");
      try {
        const { createWatchScene } = await import("./watch-scene");
        if (cancelled) return;
        const instance = createWatchScene(host, fail);
        sceneRef.current = instance;
        instance.setFinish(finishRef.current);
        instance.setMotion(!reducedRef.current && !pausedRef.current);
        instance.setAutoRotate(autoRotateRef.current);
        updateActivity();
        setStatus("ready");
      } catch {
        fail();
        host.replaceChildren();
      }
    };
    startSceneRef.current = () => void start();
    const loadObserver = "IntersectionObserver" in window ? new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          if (deferLoad) setStatus("deferred");
          else void start();
          loadObserver?.disconnect();
        }
      },
      { rootMargin: "220px" },
    ) : null;
    const visibilityObserver = "IntersectionObserver" in window ? new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
      updateActivity();
    }) : null;
    // Observe the canvas itself: on mobile the details precede it by a full screen.
    loadObserver?.observe(host);
    visibilityObserver?.observe(host);
    if (!loadObserver) {
      visible = true;
      if (deferLoad) queueMicrotask(() => {
        if (!cancelled) setStatus("deferred");
      });
      else void start();
    }
    document.addEventListener("visibilitychange", updateActivity);
    return () => {
      cancelled = true;
      startSceneRef.current = null;
      loadObserver?.disconnect();
      visibilityObserver?.disconnect();
      document.removeEventListener("visibilitychange", updateActivity);
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.setFinish(finish);
  }, [finish]);
  useEffect(() => {
    sceneRef.current?.setAutoRotate(autoRotate && !reducedMotion);
  }, [autoRotate, reducedMotion]);
  useEffect(() => {
    sceneRef.current?.setMotion(!paused && !reducedMotion);
  }, [paused, reducedMotion]);

  function chooseView(next: WatchView) {
    setView(next);
    setAutoRotate(false);
    sceneRef.current?.setAutoRotate(false);
    sceneRef.current?.setView(next);
  }
  function rotate(direction: number) {
    setView(null);
    setAutoRotate(false);
    sceneRef.current?.setAutoRotate(false);
    sceneRef.current?.rotate(direction);
  }
  function keyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || status !== "ready") return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      rotate(event.key === "ArrowLeft" ? -1 : 1);
    } else if (["+", "=", "-", "_"].includes(event.key)) {
      event.preventDefault();
      sceneRef.current?.zoom(event.key === "+" || event.key === "=" ? 1 : -1);
    }
  }

  return (
    <section
      id="showroom"
      ref={sectionRef}
      className="watch-atelier"
      aria-labelledby="atelier-heading"
      dir={locale === "ar" ? "rtl" : "ltr"}
    >
      <div className="atelier-topline">
        <span>
          <i />
          {copy.eyebrow}
        </span>
        <span className="atelier-edition">EXPERIENCE 01 / 03</span>
      </div>
      <div className="atelier-shell" data-finish={finish}>
        <div className="atelier-details">
          <span className="atelier-chapter">01 — {copy.detail}</span>
          <h2 id="atelier-heading">
            {copy.title}
            <br />
            <span>{copy.titleAccent}</span>
          </h2>
          <p className="atelier-description">{copy.body}</p>
          <div className="atelier-finish-picker">
            <span className="atelier-field-label">{copy.finishLabel}</span>
            <div
              className="atelier-finishes"
              role="group"
              aria-label={copy.finishes}
            >
              {(["midnight", "azure", "champagne"] as const).map((item) => (
                <button
                  type="button"
                  className={`atelier-finish${finish === item ? " is-selected" : ""}`}
                  key={item}
                  onClick={() => setFinish(item)}
                  aria-pressed={finish === item}
                >
                  <span className={`atelier-swatch atelier-swatch-${item}`}>
                    {finish === item && <Check size={12} />}
                  </span>
                  <span>{copy[item]}</span>
                </button>
              ))}
            </div>
            <span className="atelier-finish-hint">{copy.finishHint}</span>
          </div>
          <button type="button" className="atelier-shop" onClick={onShop}>
            {copy.cta}
            <ArrowUpRight size={18} />
          </button>
          <p className="atelier-disclaimer">{copy.study}</p>
        </div>
        <div
          className={`atelier-stage${status === "ready" ? " is-ready" : ""}`}
        >
          <div className="atelier-stage-glow" aria-hidden="true" />
          <div
            className="atelier-orbit atelier-orbit-outer"
            aria-hidden="true"
          />
          <div
            className="atelier-orbit atelier-orbit-inner"
            aria-hidden="true"
          />
          <span
            className="atelier-coordinate atelier-coordinate-top"
            aria-hidden="true"
          >
            + &nbsp; 34° 01′ N
          </span>
          <span
            className="atelier-coordinate atelier-coordinate-bottom"
            aria-hidden="true"
          >
            + &nbsp; 06° 50′ W
          </span>
          <div className="atelier-model-name" aria-hidden="true">
            <span>AYOUB</span>
            <small>{copy.model}</small>
          </div>
          <div className="atelier-live">
            <i
              className={
                paused || reducedMotion || !autoRotate ? "is-still" : ""
              }
            />
            {reducedMotion
              ? copy.motionOff
              : paused || !autoRotate
                ? copy.paused
                : copy.live}
          </div>
          <div
            className="atelier-render"
            tabIndex={status === "ready" ? 0 : -1}
            role="group"
            aria-label={copy.accessible}
            onKeyDown={keyboard}
            onPointerDown={() => {
              if (status !== "ready") return;
              setView(null);
              setAutoRotate(false);
              sceneRef.current?.setAutoRotate(false);
            }}
          >
            <div ref={hostRef} className="atelier-canvas" />
            {status !== "ready" && (
              <div className="atelier-fallback">
                {/* Existing product photography also serves devices without WebGL. */}
                <img
                  src={FINISH_IMAGES[finish]}
                  srcSet={productImageSet(FINISH_IMAGES[finish])}
                  sizes="(max-width: 760px) 360px, 540px"
                  alt={
                    locale === "ar"
                      ? "ساعة أيوب شوب"
                      : locale === "fr"
                        ? "Montre Ayoub Shop"
                        : "Ayoub Shop watch"
                  }
                  width="640"
                  height="640"
                  loading="lazy"
                  decoding="async"
                />
                <span className="atelier-load-status" role="status">
                  {status === "fallback" || status === "deferred" ? copy.fallback : copy.loading}
                </span>
                {status === "fallback" && <small>{copy.fallbackHint}</small>}
                {status === "deferred" && (
                  <button
                    type="button"
                    className="atelier-load-interactive"
                    onClick={() => startSceneRef.current?.()}
                  >
                    {copy.loadInteractive}
                  </button>
                )}
              </div>
            )}
          </div>
          {status === "ready" && (
            <div className="atelier-material-label" aria-hidden="true">
              <span />
              <div>
                <small>01 / FORM</small>
                <strong>
                  {finish === "champagne" ? copy.dial : copy.steel}
                </strong>
              </div>
            </div>
          )}
          <div className="atelier-stage-bottom">
            <div className="atelier-views" role="group" aria-label={copy.views}>
              {(["front", "profile", "back"] as const).map((item) => (
                <button
                  type="button"
                  key={item}
                  disabled={status !== "ready"}
                  aria-pressed={view === item}
                  onClick={() => chooseView(item)}
                >
                  {copy[item]}
                </button>
              ))}
            </div>
            <span className="atelier-drag-hint">
              <MoveHorizontal size={15} />
              {copy.drag}
            </span>
            <div
              className="atelier-tools"
              role="group"
              aria-label={copy.keyboard}
            >
              <button
                type="button"
                disabled={status !== "ready"}
                onClick={() => rotate(-1)}
                aria-label={copy.rotateLeft}
                title={copy.rotateLeft}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                disabled={status !== "ready"}
                onClick={() => rotate(1)}
                aria-label={copy.rotateRight}
                title={copy.rotateRight}
              >
                <ChevronRight size={16} />
              </button>
              <span className="atelier-tool-divider" />
              <button
                type="button"
                disabled={status !== "ready"}
                onClick={() => sceneRef.current?.zoom(-1)}
                aria-label={copy.zoomOut}
                title={copy.zoomOut}
              >
                <Minus size={15} />
              </button>
              <button
                type="button"
                disabled={status !== "ready"}
                onClick={() => sceneRef.current?.zoom(1)}
                aria-label={copy.zoomIn}
                title={copy.zoomIn}
              >
                <Plus size={15} />
              </button>
              <span className="atelier-tool-divider" />
              <button
                type="button"
                disabled={status !== "ready"}
                onClick={() => {
                  setView(null);
                  sceneRef.current?.reset();
                }}
                aria-label={copy.reset}
                title={copy.reset}
              >
                <RotateCcw size={14} />
              </button>
              <button
                type="button"
                disabled={status !== "ready" || reducedMotion}
                onClick={() => setAutoRotate((value) => !value)}
                aria-label={autoRotate ? copy.pause : copy.play}
                title={
                  reducedMotion
                    ? copy.motionOff
                    : autoRotate
                      ? copy.pause
                      : copy.play
                }
                aria-pressed={autoRotate && !reducedMotion}
              >
                {autoRotate && !reducedMotion ? (
                  <Pause size={13} />
                ) : (
                  <Play size={13} />
                )}
              </button>
            </div>
          </div>
        </div>
        <div className="atelier-bottomline">
          <span>
            <Sparkles size={12} />
            AYOUB DESIGN LAB
          </span>
          <span>
            {copy.model} <i />{" "}
            {finish === "midnight" ? "01" : finish === "azure" ? "02" : "03"} /
            03
          </span>
        </div>
      </div>
    </section>
  );
}
