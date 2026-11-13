"use client";

import {
  useEffect,
  useRef,
  useState,
  useMemo,
  useDeferredValue,
  type ReactNode,
  type FormEvent,
} from "react";
import Image from "next/image";
import {
  ArrowRight,
  ArrowUpRight,
  ArrowDown,
  Search,
  Heart,
  ShoppingBag,
  Menu,
  X,
  Plus,
  Minus,
  Trash2,
  Truck,
  ShieldCheck,
  PackageCheck,
  Banknote,
  Check,
  SlidersHorizontal,
  Watch,
  Copy,
  LockKeyhole,
  Clock3,
  ChevronRight,
  RotateCcw,
  Gem,
  MessageCircle,
  Box,
  Pause,
  Play,
  Sun,
  Moon,
} from "lucide-react";
import {
  FACEBOOK_URL,
  INSTAGRAM_URL,
  SUPPORT_URL,
} from "@/lib/shop-config";
import { productImageSet, productThumbnail } from "@/lib/product-images";
import HeroWatch from "./hero-watch";
import WatchShowroom from "./watch-showroom";
import TiltSurface from "./tilt-surface";
import { useStoreMotion } from "@/hooks/use-store-motion";
import type { Product, TrackedOrder, Order, EditorialAsset } from "@/lib/types";
import { legalPageLabels } from "@/lib/legal";
import {
  localizedDictionary,
  type ContentOverrides,
  formatMoney,
  productName,
  productDescription,
  productDetail,
  type Locale,
  type TranslationKey,
} from "@/lib/i18n";

type CartItem = { productId: string; quantity: number };
type Receipt = { order: Order; trackingToken: string };
type Overlay =
  | "cart"
  | "checkout"
  | "product"
  | "search"
  | "track"
  | "success"
  | "privacy"
  | "terms"
  | "shipping"
  | "story"
  | null;
const CITIES = [
  "Casablanca",
  "Rabat",
  "Marrakech",
  "Fès",
  "Tanger",
  "Agadir",
  "Meknès",
  "Oujda",
  "Kénitra",
  "Tétouan",
  "Safi",
  "Mohammedia",
  "El Jadida",
  "Béni Mellal",
  "Nador",
  "Essaouira",
  "Laâyoune",
  "Dakhla",
];
type PublicStoreSettings = {
  shipping: { fee: number; freeThreshold: number; estimatedDaysMin: number; estimatedDaysMax: number; codEnabled: boolean; cities: string[] };
  appearance: { primaryColor: string; secondaryColor: string; defaultTheme: "dark" | "light" | "system"; radius: "sharp" | "soft" | "round" };
  checkout: { instructions: string; confirmationMessage: string; marketingEnabled: boolean };
};
const fallbackSettings: PublicStoreSettings = { shipping: { fee: 35, freeThreshold: 1000, estimatedDaysMin: 2, estimatedDaysMax: 7, codEnabled: true, cities: CITIES }, appearance: { primaryColor: "#4d8dff", secondaryColor: "#9ac9ff", defaultTheme: "dark", radius: "soft" }, checkout: { instructions: "", confirmationMessage: "", marketingEnabled: false } };
const legalCheckoutCopy = {
  en: { accept: "I have read and accept the Terms and Conditions of Sale", marketing: "I agree to receive optional news and offers. I can withdraw this consent.", unavailable: "Ordering is paused until the verified Terms and Conditions are published.", review: "Review your delivery details, items and final total before confirming." },
  fr: { accept: "J’ai lu et j’accepte les Conditions générales de vente", marketing: "J’accepte de recevoir des actualités et offres facultatives. Je peux retirer ce consentement.", unavailable: "Les commandes sont suspendues jusqu’à la publication des CGV vérifiées.", review: "Vérifiez vos coordonnées, les articles et le total final avant de confirmer." },
  ar: { accept: "قرأت الشروط العامة للبيع وأوافق عليها", marketing: "أوافق اختياريًا على تلقي الأخبار والعروض ويمكنني سحب موافقتي.", unavailable: "تم تعليق الطلب إلى حين نشر شروط بيع موثقة.", review: "راجع بيانات التوصيل والمنتجات والمبلغ النهائي قبل التأكيد." },
};
const hexopsCredit = {
  en: { label: "Developed by", visit: "Visit HexOps" },
  fr: { label: "Développé par", visit: "Visiter HexOps" },
  ar: { label: "طوّرته", visit: "زيارة HexOps" },
};
const socialLabels = {
  en: { menu: "Contact us", open: "Show contact options", close: "Hide contact options", facebook: "Visit us on Facebook", instagram: "Visit us on Instagram", whatsapp: "Chat with us on WhatsApp" },
  fr: { menu: "Nous contacter", open: "Afficher les options de contact", close: "Masquer les options de contact", facebook: "Retrouvez-nous sur Facebook", instagram: "Retrouvez-nous sur Instagram", whatsapp: "Écrivez-nous sur WhatsApp" },
  ar: { menu: "تواصل معنا", open: "عرض وسائل التواصل", close: "إخفاء وسائل التواصل", facebook: "تابعنا على فيسبوك", instagram: "تابعنا على إنستغرام", whatsapp: "تواصل معنا على واتساب" },
};
const themeLabels = {
  en: { light: "Use light mode", dark: "Use dark mode" },
  fr: { light: "Activer le mode clair", dark: "Activer le mode sombre" },
  ar: { light: "تفعيل الوضع الفاتح", dark: "تفعيل الوضع الداكن" },
};

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M13.7 21v-8h2.7l.4-3.1h-3.1v-2c0-.9.3-1.5 1.6-1.5H17V3.6c-.8-.1-1.7-.2-2.5-.2-2.5 0-4.2 1.5-4.2 4.3v2.2H7.5V13h2.8v8h3.4Z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.4" cy="6.7" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function Brand() {
  return (
    <a href="/" className="brand">
      <span className="brand-mark">
        <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
          <path
            d="m6 32 13-26h3l13 26h-8L18 13l-5 11h10l3 6H10"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="m27 9 5 10" stroke="#80a7e8" strokeWidth="1.5" />
        </svg>
      </span>
      <span className="brand-type">
        AYOUB<em>SHOP</em>
        <small>YOUR TIME. YOUR STATEMENT.</small>
      </span>
    </a>
  );
}

function Modal({
  children,
  title,
  onClose,
  className = "",
  closeLabel = "Close",
  titleAs: Title = "h2",
  labelledBy = "modal-title",
}: {
  children: ReactNode;
  title?: ReactNode;
  onClose: () => void;
  className?: string;
  closeLabel?: string;
  titleAs?: "h2" | "p";
  labelledBy?: string;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const el = panel.current;
    const initial =
      el?.querySelector<HTMLElement>(
        "input:not([type=hidden]),select,textarea",
      ) ?? el?.querySelector<HTMLElement>("button,a[href]");
    initial?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close.current();
      if (e.key === "Tab" && el) {
        const nodes = Array.from(
          el.querySelectorAll<HTMLElement>(
            'button:not([disabled]),a[href],input:not([disabled]),select,textarea,[tabindex="0"]',
          ),
        ).filter((x) => x.offsetParent !== null);
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = original;
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className={`modal-backdrop ${className.includes("drawer") ? "drawer-backdrop" : ""}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={`modal ${className}`}
      >
        <div className="modal-header">
          <Title id="modal-title" className="modal-title">{title || "Ayoub Shop"}</Title>
          <button
            className="icon-button"
            aria-label={closeLabel}
            onClick={onClose}
          >
            <X />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function Storefront({
  initialProducts,
  initialProduct,
  catalogUnavailable = false,
  initialLocale = "fr",
  contentOverrides = {},
  editorialAsset = { slot: "editorialImage", image: "/images/watch-blue.webp", en: "Blue dial watch detail", fr: "Détails d’une montre bleue", ar: "تفاصيل ساعة زرقاء" },
  storeSettings = fallbackSettings,
  termsVersionId = null,
}: {
  initialProducts: Product[];
  initialProduct?: Product;
  catalogUnavailable?: boolean;
  initialLocale?: Locale;
  contentOverrides?: ContentOverrides;
  editorialAsset?: EditorialAsset;
  storeSettings?: PublicStoreSettings;
  termsVersionId?: string | null;
}) {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const rootRef = useRef<HTMLDivElement>(null);
  const [motionPaused, setMotionPaused] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useStoreMotion(rootRef, motionPaused);
  const d = useMemo(() => localizedDictionary(locale, contentOverrides), [locale, contentOverrides]);
  const t = (k: TranslationKey) => d[k];
  const [products, setProducts] = useState(initialProducts);
  const [catalogError, setCatalogError] = useState(catalogUnavailable);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [overlay, setOverlay] = useState<Overlay>(
    initialProduct ? "product" : null,
  );
  const [selected, setSelected] = useState<Product | null>(
    initialProduct || null,
  );
  const [imageIndex, setImageIndex] = useState(0);
  const [detailQty, setDetailQty] = useState(1);
  const [mobileNav, setMobileNav] = useState(false);
  const [socialOpen, setSocialOpen] = useState(false);
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState("featured");
  const [showFilters, setShowFilters] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [stockOnly, setStockOnly] = useState(false);
  const [savedOnly, setSavedOnly] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [trackNumber, setTrackNumber] = useState("");
  const [trackToken, setTrackToken] = useState("");
  const [tracked, setTracked] = useState<TrackedOrder | null>(null);
  const [lastOrder, setLastOrder] = useState<{
    number: string;
    token: string;
  } | null>(null);
  const idempotency = useRef<{ payload: string; key: string } | null>(null);
  useEffect(() => {
    try {
      setMotionPaused(localStorage.getItem("ayoub-motion") === "paused");
      const savedTheme = localStorage.getItem("ayoub-theme");
      setTheme(
        savedTheme === "light" || savedTheme === "dark"
          ? savedTheme
          : storeSettings.appearance.defaultTheme === "light" || (storeSettings.appearance.defaultTheme === "system" && window.matchMedia("(prefers-color-scheme: light)").matches)
            ? "light"
            : "dark",
      );
      const l = localStorage.getItem("ayoub-language");
      if (l === "en" || l === "fr" || l === "ar") setLocale(l);
      const c = JSON.parse(localStorage.getItem("ayoub-cart") || "[]");
      if (Array.isArray(c))
        setCart(
          c
            .filter(
              (x: CartItem) =>
                typeof x.productId === "string" &&
                Number.isInteger(x.quantity) &&
                x.quantity > 0,
            )
            .map((x: CartItem) => ({
              ...x,
              quantity: Math.min(10, x.quantity),
            })),
        );
      const f = JSON.parse(localStorage.getItem("ayoub-favorites") || "[]");
      if (Array.isArray(f))
        setFavorites(f.filter((x) => typeof x === "string"));
      const o = JSON.parse(localStorage.getItem("ayoub-last-order") || "null");
      if (o && typeof o.number === "string" && typeof o.token === "string")
        setLastOrder(o);
    } catch {}
    setReady(true);
    const params = new URLSearchParams(window.location.search);
    if (params.get("view") === "all") setShowAll(true);
    if (params.get("category")) {
      setCategory(params.get("category")!);
      setShowAll(true);
    }
    if (params.get("track")) setOverlay("track");
  }, [storeSettings.appearance.defaultTheme]);
  useEffect(() => {
    document.documentElement.dataset.shopTheme = theme;
    if (ready) localStorage.setItem("ayoub-theme", theme);
  }, [theme, ready]);
  useEffect(() => {
    if (ready)
      try {
        localStorage.setItem(
          "ayoub-motion",
          motionPaused ? "paused" : "enabled",
        );
      } catch {}
  }, [motionPaused, ready]);
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOverlay((current) => (current === "search" ? null : "search"));
        setError("");
      }
    }
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    if (ready) {
      try {
        localStorage.setItem("ayoub-language", locale);
        document.cookie = `ayoub-language=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
      } catch {}
    }
  }, [locale, ready]);
  useEffect(() => {
    if (ready)
      try {
        localStorage.setItem("ayoub-cart", JSON.stringify(cart));
      } catch {}
  }, [cart, ready]);
  useEffect(() => {
    if (ready)
      try {
        localStorage.setItem("ayoub-favorites", JSON.stringify(favorites));
      } catch {}
  }, [favorites, ready]);
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );
  const notify = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3300);
  };
  const holdToast = () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  };
  const resumeToast = () => {
    holdToast();
    if (!document.activeElement?.closest(".toast-stack"))
      toastTimer.current = setTimeout(() => setToast(""), 3300);
  };
  const close = () => {
    setOverlay(null);
    setError("");
    setBusy(false);
    if (initialProduct && window.location.pathname.startsWith("/products/"))
      window.history.replaceState(null, "", "/");
  };
  const open = (which: Overlay) => {
    setError("");
    setOverlay(which);
    setMobileNav(false);
    setSocialOpen(false);
  };
  async function refresh() {
    try {
      const r = await fetch("/api/products", { cache: "no-store" });
      if (!r.ok) throw new Error();
      const data = (await r.json()) as { products: Product[] };
      setProducts(data.products);
      setCatalogError(false);
      return data.products as Product[];
    } catch {
      setCatalogError(true);
      return null;
    }
  }
  useEffect(() => {
    if (overlay === "cart" || overlay === "checkout") void refresh();
  }, [overlay]);
  const cartLines = cart.map((item) => ({
    item,
    product: products.find((p) => p.id === item.productId),
  }));
  const activeLines = cartLines.filter(
    (x): x is { item: CartItem; product: Product } => !!x.product,
  );
  const subtotal = activeLines.reduce(
    (sum, { item, product }) => sum + product.price * item.quantity,
    0,
  );
  const shipping = subtotal >= storeSettings.shipping.freeThreshold ? 0 : storeSettings.shipping.fee;
  const count = cart.reduce((n, i) => n + i.quantity, 0);
  const invalidCart = cartLines.some(
    (x) => !x.product || x.item.quantity > (x.product?.stock || 0),
  );
  const add = (p: Product, quantity = 1) => {
    const old = cart.find((i) => i.productId === p.id)?.quantity || 0;
    if (old + quantity > Math.min(10, p.stock)) {
      notify(t("cartStock"));
      return;
    }
    setCart((prev) => {
      const existing = prev.find((x) => x.productId === p.id);
      return existing
        ? prev.map((x) =>
            x.productId === p.id
              ? { ...x, quantity: x.quantity + quantity }
              : x,
          )
        : [...prev, { productId: p.id, quantity }];
    });
    notify(t("added"));
  };
  const updateQty = (id: string, quantity: number) =>
    setCart((prev) =>
      quantity < 1
        ? prev.filter((i) => i.productId !== id)
        : prev.map((i) =>
            i.productId === id ? { ...i, quantity: Math.min(10, quantity) } : i,
          ),
    );
  const toggleFavorite = (id: string) => {
    const included = favorites.includes(id);
    setFavorites((prev) =>
      included ? prev.filter((x) => x !== id) : [...prev, id],
    );
    notify(t(included ? "unsaved" : "saved"));
  };
  const selectProduct = (p: Product) => {
    setSelected(p);
    setImageIndex(0);
    setDetailQty(1);
    open("product");
  };
  const scrollToSection = (id: string) => {
    const reduced =
      motionPaused ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
  };
  const browse = (cat = "All", all = true) => {
    setCategory(cat);
    setSavedOnly(false);
    setShowAll(all);
    setMobileNav(false);
    setOverlay(null);
    setTimeout(() => scrollToSection("collection"), 20);
  };
  const resetFilters = () => {
    setCategory("All");
    setMinPrice("");
    setMaxPrice("");
    setStockOnly(false);
    setSavedOnly(false);
    setSort("featured");
  };
  const filtered = useMemo(() => {
    let rows = products.filter(
      (p) =>
        (category === "All" ||
          (category === "New"
            ? p.badge?.toLowerCase() === "new"
            : p.category === category)) &&
        (!savedOnly || favorites.includes(p.id)) &&
        (!minPrice || p.price >= Number(minPrice)) &&
        (!maxPrice || p.price <= Number(maxPrice)) &&
        (!stockOnly || p.stock > 0),
    );
    if (sort === "featured")
      rows.sort((a, b) => Number(b.featured) - Number(a.featured));
    if (sort === "low") rows.sort((a, b) => a.price - b.price);
    if (sort === "high") rows.sort((a, b) => b.price - a.price);
    if (sort === "name")
      rows.sort((a, b) =>
        productName(a, locale).localeCompare(productName(b, locale)),
      );
    return rows;
  }, [
    products,
    category,
    savedOnly,
    favorites,
    minPrice,
    maxPrice,
    stockOnly,
    sort,
    locale,
  ]);
  const visible =
    showAll || category !== "All" || savedOnly || showFilters
      ? filtered
      : filtered.slice(0, 4);
  const searchResults = useMemo(() => {
    if (overlay !== "search") return [];
    const search = deferredQuery.toLowerCase().trim();
    return products.filter((p) =>
      `${p.name} ${p.nameFr} ${p.nameAr} ${p.category} ${p.color} ${p.subtitle} ${p.localizedDetails?.fr.color ?? ""} ${p.localizedDetails?.ar.color ?? ""}`
        .toLowerCase().includes(search),
    ).slice(0, 8);
  }, [products, overlay, deferredQuery]);
  const money = (n: number) => formatMoney(n, locale);
  const currency = locale === "ar" ? "درهم" : "MAD";
  const HeroHeading = initialProduct ? "h2" : "h1";
  const ProductHeading = initialProduct ? "h1" : "h2";
  const Price = ({ product: p }: { product: Product }) => (
    <span className="product-price">
      {money(p.price)} <small>{currency}</small>
      {p.compareAt && p.compareAt > p.price ? (
        <del>{money(p.compareAt)}</del>
      ) : null}
    </span>
  );
  const Summary = () => (
    <>
      <div className="cart-total-line">
        <span>{t("subtotal")}</span>
        <span>
          {money(subtotal)} {currency}
        </span>
      </div>
      <div className="cart-total-line">
        <span>{t("shippingCost")}</span>
        <span>
          {shipping === 0 ? t("free") : `${money(shipping)} ${currency}`}
        </span>
      </div>
      <div className="cart-total-line total">
        <span>{t("total")}</span>
        <span>
          {money(subtotal + shipping)} {currency}
        </span>
      </div>
    </>
  );
  async function submitOrder(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || invalidCart || !cart.length) return;
    setBusy(true);
    setError("");
    const data = new FormData(e.currentTarget);
    const customer = {
      name: String(data.get("name")).trim(),
      phone: String(data.get("phone")).trim(),
      email: String(data.get("email") || "").trim() || undefined,
      city: String(data.get("city")).trim(),
      address: String(data.get("address")).trim(),
      notes: String(data.get("notes") || "").trim() || undefined,
    };
    const termsAccepted = data.get("termsAccepted") === "on";
    const marketingConsent = data.get("marketingConsent") === "on";
    const payload = JSON.stringify({ customer, items: cart, termsAccepted, termsVersionId, marketingConsent, locale });
    if (idempotency.current?.payload !== payload)
      idempotency.current = { payload, key: crypto.randomUUID() };
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...JSON.parse(payload),
          idempotencyKey: idempotency.current.key,
        }),
      });
      const result = (await response.json()) as Receipt & {
        error?: string;
        code?: string;
      };
      if (!response.ok) {
        const key =
          result.code === "stock_changed"
            ? "stockError"
            : result.code === "invalid_input"
              ? "inputError"
              : result.code === "rate_limited"
                ? "rateError"
                : "orderError";
        throw new Error(t(key));
      }
      setReceipt(result);
      const last = { number: result.order.number, token: result.trackingToken };
      setLastOrder(last);
      try {
        localStorage.setItem("ayoub-last-order", JSON.stringify(last));
      } catch {}
      setCart([]);
      idempotency.current = null;
      setOverlay("success");
      void refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("orderError"));
      void refresh();
    } finally {
      setBusy(false);
    }
  }
  async function findOrder(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setTracked(null);
    try {
      const r = await fetch(
        `/api/orders/track?number=${encodeURIComponent(trackNumber.trim())}&token=${encodeURIComponent(trackToken.trim())}`,
        { cache: "no-store" },
      );
      if (!r.ok) throw new Error(t("trackError"));
      const result = (await r.json()) as { order: TrackedOrder };
      setTracked(result.order);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("trackError"));
    } finally {
      setBusy(false);
    }
  }
  const followReceipt = () => {
    if (receipt) {
      setTrackNumber(receipt.order.number);
      setTrackToken(receipt.trackingToken);
      setTracked(receipt.order);
    }
    open("track");
  };
  const policyTitle =
    overlay === "privacy"
      ? t("privacy")
      : overlay === "terms"
        ? t("terms")
        : overlay === "shipping"
          ? t("shipping")
          : t("story");

  return (
    <div
      ref={rootRef}
      className="storefront"
      dir={locale === "ar" ? "rtl" : "ltr"}
      data-motion={motionPaused ? "paused" : "enabled"}
      data-theme={theme}
      data-radius={storeSettings.appearance.radius}
      style={{ "--shop-primary": storeSettings.appearance.primaryColor, "--shop-secondary": storeSettings.appearance.secondaryColor } as React.CSSProperties}
    >
      <div className="announcement">
        <Truck />
        <span>{t("freeTop")}</span>
        <span>{t("codTop")}</span>
      </div>
      <header className="nav-header" inert={overlay ? true : undefined}>
        <div className="nav container">
          <Brand />
          <nav className="nav-links" aria-label="Main navigation">
            <a href="/" className="active">
              {t("home")}
            </a>
            <button onClick={() => browse()}>{t("watches")}</button>
            <a href="#showroom" className="nav-showroom">
              <Box size={13} />
              {t("showroomNav")}
            </a>
            <button
              onClick={() => {
                setSort("featured");
                browse("New");
              }}
            >
              {t("newArrivals")}
              <span className="new-nav">{t("new")}</span>
            </button>
            <a href="#story">{t("story")}</a>
          </nav>
          <div className="nav-actions">
            <select
              aria-label="Language"
              className="language-control"
              value={locale}
              onChange={(e) => setLocale(e.target.value as Locale)}
            >
              <option value="en">EN</option>
              <option value="fr">FR</option>
              <option value="ar">العربية</option>
            </select>
            <span className="nav-separator" />
            <button
              className="icon-button motion-toggle"
              onClick={() => setMotionPaused((value) => !value)}
              aria-label={t(motionPaused ? "enableMotion" : "pauseMotion")}
              title={t(motionPaused ? "enableMotion" : "pauseMotion")}
              aria-pressed={motionPaused}
            >
              {motionPaused ? <Play /> : <Pause />}
            </button>
            <button
              className="icon-button theme-toggle"
              onClick={() => setTheme((value) => value === "dark" ? "light" : "dark")}
              aria-label={themeLabels[locale][theme === "dark" ? "light" : "dark"]}
              title={themeLabels[locale][theme === "dark" ? "light" : "dark"]}
              aria-pressed={theme === "light"}
            >
              {theme === "dark" ? <Sun /> : <Moon />}
            </button>
            <button
              className="icon-button"
              aria-label={t("search")}
              onClick={() => open("search")}
            >
              <Search />
            </button>
            <button
              className="icon-button nav-wishlist"
              aria-label={t("wishlist")}
              onClick={() => {
                setSavedOnly(true);
                setShowAll(true);
                setCategory("All");
                scrollToSection("collection");
              }}
            >
              <Heart />
              {favorites.length > 0 && (
                <span className="cart-count">{favorites.length}</span>
              )}
            </button>
            <button
              className="icon-button"
              aria-label={`${t("cart")} (${count})`}
              onClick={() => open("cart")}
            >
              <ShoppingBag />
              {count > 0 && <span className="cart-count">{count}</span>}
            </button>
            <button
              className="icon-button mobile-menu"
              aria-label={t("menu")}
              aria-expanded={mobileNav}
              onClick={() => setMobileNav((v) => !v)}
            >
              {mobileNav ? <X /> : <Menu />}
            </button>
          </div>
        </div>
        {mobileNav && (
          <nav className="mobile-nav-panel">
            <button onClick={() => browse()}>{t("watches")}</button>
            <a href="#showroom" onClick={() => setMobileNav(false)}>
              <Box size={15} /> {t("showroomNav")}
            </a>
            <a href="#collections" onClick={() => setMobileNav(false)}>
              {t("collections")}
            </a>
            <button onClick={() => browse("New")}>{t("newArrivals")}</button>
            <a href="#story" onClick={() => setMobileNav(false)}>
              {t("story")}
            </a>
            <button
              onClick={() => {
                setSavedOnly(true);
                setShowAll(true);
                setCategory("All");
                setMobileNav(false);
                scrollToSection("collection");
              }}
            >
              {t("wishlist")} ({favorites.length})
            </button>
            <button onClick={() => open("track")}>{t("track")}</button>
          </nav>
        )}
        <div className="scroll-progress" aria-hidden="true" />
      </header>
      <main inert={overlay ? true : undefined}>
        <section className="hero container" aria-labelledby="hero-title">
          <span className="hero-watermark" aria-hidden="true">
            AYOUB
          </span>
          <div className="hero-copy">
            <div className="hero-badge">
              <span className="blue-dot" />
              {t("heroBadge")}
            </div>
            <HeroHeading id="hero-title" className="hero-title">
              {t("heroLine1")}
              <span>{t("heroLine2")}</span>
            </HeroHeading>
            <p className="hero-description">{t("heroDesc")}</p>
            <div className="hero-ctas">
              <button className="primary-btn" onClick={() => browse()}>
                {t("shopWatches")}
                <ArrowUpRight />
              </button>
              <button
                className="secondary-btn showroom-link"
                onClick={() => scrollToSection("showroom")}
              >
                <Box />
                {t("explore3d")}
              </button>
            </div>
          </div>
          <HeroWatch
            products={products}
            locale={locale}
            copy={d}
            paused={motionPaused || Boolean(overlay)}
            onSelect={selectProduct}
          />
          <a className="hero-scroll" href="#collection">
            <ArrowDown />
            {t("discover")}
          </a>
        </section>
        <div className="signature-marquee" aria-hidden="true">
          <div className="marquee-track">
            {Array.from({ length: 4 }, (_, i) => (
              <span className="marquee-set" key={i}>
                <span>{t("marquee1")}</span>
                <Gem />
                <span>{t("marquee2")}</span>
                <span className="marquee-star">✳</span>
                <span>{t("marquee3")}</span>
                <Gem />
              </span>
            ))}
          </div>
        </div>
        <div className="container">
          <section className="benefit-bar" aria-label={t("help")} data-reveal>
            {[
              [Truck, "delivery", "deliverySub"],
              [Banknote, "payDelivery", "payDeliverySub"],
              [ShieldCheck, "care", "careSub"],
              [PackageCheck, "easyHelp", "easyHelpSub"],
            ].map(([Icon, k, sub]) => {
              const I = Icon as typeof Truck;
              return (
                <div className="benefit" key={String(k)}>
                  <I />
                  <div>
                    <strong>{t(k as TranslationKey)}</strong>
                    <p>{t(sub as TranslationKey)}</p>
                  </div>
                </div>
              );
            })}
          </section>
          <section id="collection" aria-labelledby="collection-title">
            <div className="section-heading" data-reveal>
              <div>
                <div className="eyebrow">
                  <span>01 /</span>
                  {t("collectionTag")}
                </div>
                <h2 id="collection-title">{t("collectionTitle")}</h2>
              </div>
              <button
                className="text-link"
                onClick={() => {
                  resetFilters();
                  setShowAll(true);
                }}
              >
                {t("viewAll")}
                <ArrowUpRight />
              </button>
            </div>
            {catalogError && (
              <div className="error-banner" role="alert">
                {t("catalogError")}
                <button onClick={() => void refresh()}>{t("retry")}</button>
              </div>
            )}
            {savedOnly && (
              <div className="wishlist-banner">
                <span>
                  {t("savedTitle")} · {favorites.length}
                </span>
                <button onClick={() => setSavedOnly(false)}>
                  {t("showAll")}
                </button>
              </div>
            )}
            <div className="catalog-toolbar">
              <div className="tabs" role="group" aria-label={t("collections")}>
                {["All", "Classic", "Sport", "Minimal", "Limited", "New"].map(
                  (c) => (
                    <button
                      key={c}
                      className={`tab ${category === c ? "active" : ""}`}
                      aria-pressed={category === c}
                      onClick={() => {
                        setCategory(c);
                        if (c !== "All") setShowAll(true);
                      }}
                    >
                      {c === "All"
                        ? t("all")
                        : c === "New"
                          ? t("newArrivals")
                          : t(c as TranslationKey)}
                    </button>
                  ),
                )}
              </div>
              <div className="catalog-tools">
                <button
                  className="tool-button"
                  onClick={() => setShowFilters((v) => !v)}
                  aria-expanded={showFilters}
                >
                  <SlidersHorizontal />
                  {t("filters")}
                </button>
                <select
                  value={sort}
                  onChange={(e) => {
                    setSort(e.target.value);
                    setShowAll(true);
                  }}
                  className="sort-control"
                  aria-label={t("featuredSort")}
                >
                  <option value="featured">{t("featuredSort")}</option>
                  <option value="low">{t("priceLow")}</option>
                  <option value="high">{t("priceHigh")}</option>
                  <option value="name">{t("nameSort")}</option>
                </select>
              </div>
            </div>
            {showFilters && (
              <div className="filter-row">
                <label>
                  {t("minPrice")}
                  <input
                    type="number"
                    min="0"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    placeholder="0"
                  />
                </label>
                <label>
                  {t("maxPrice")}
                  <input
                    type="number"
                    min="0"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    placeholder="5000"
                  />
                </label>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={stockOnly}
                    onChange={(e) => setStockOnly(e.target.checked)}
                  />
                  {t("stockOnly")}
                </label>
                <button className="text-link" onClick={resetFilters}>
                  <RotateCcw />
                  {t("reset")}
                </button>
              </div>
            )}
            {(minPrice || maxPrice || stockOnly) && (
              <div className="filter-chips" aria-label={t("filters")}>
                {minPrice && (
                  <button onClick={() => setMinPrice("")}>
                    {t("minPrice")}: {money(Number(minPrice))}
                    <X size={12} />
                  </button>
                )}
                {maxPrice && (
                  <button onClick={() => setMaxPrice("")}>
                    {t("maxPrice")}: {money(Number(maxPrice))}
                    <X size={12} />
                  </button>
                )}
                {stockOnly && (
                  <button onClick={() => setStockOnly(false)}>
                    {t("stockOnly")}
                    <X size={12} />
                  </button>
                )}
                <button onClick={resetFilters}>{t("reset")}</button>
              </div>
            )}
            <div className="product-grid">
              {visible.map((p, index) => (
                <TiltSurface
                  key={p.id}
                  className="product-card"
                  disabled={motionPaused}
                  data-reveal
                  data-reveal-index={index % 4}
                >
                  {p.badge && (
                    <span
                      className={`product-badge ${p.category === "Limited" ? "limited" : ""}`}
                    >
                      {p.category === "Limited"
                        ? t("Limited")
                        : p.badge.toLowerCase() === "new"
                          ? t("new")
                          : p.badge.toLowerCase() === "bestseller"
                            ? t("bestseller")
                            : productDetail(p, locale, "badge")}
                    </span>
                  )}
                  <button
                    className={`icon-button favorite ${favorites.includes(p.id) ? "saved" : ""}`}
                    aria-label={`${t("wishlist")}: ${productName(p, locale)}`}
                    aria-pressed={favorites.includes(p.id)}
                    onClick={() => toggleFavorite(p.id)}
                  >
                    <Heart />
                  </button>
                  <a
                    href={`/products/${p.slug}`}
                    className="product-photo"
                    onClick={(e) => {
                      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
                        return;
                      e.preventDefault();
                      selectProduct(p);
                    }}
                  >
                    <img
                      src={p.images[0] || "/images/watch-hero.webp"}
                      srcSet={productImageSet(
                        p.images[0] || "/images/watch-hero.webp",
                      )}
                      sizes="(max-width: 440px) 168px, (max-width: 760px) 205px, (max-width: 1020px) 290px, (max-width: 1230px) 210px, 234px"
                      alt={productName(p, locale)}
                      width="350"
                      height="350"
                      loading="lazy"
                      decoding="async"
                    />
                    <span className="product-preview-link">
                      {t("exploreDetails")}
                      <ArrowUpRight size={13} />
                    </span>
                  </a>
                  <div className="product-info">
                    <div className="product-category">{t(p.category)}</div>
                    <a
                      href={`/products/${p.slug}`}
                      className="product-title"
                      onClick={(e) => {
                        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
                          return;
                        e.preventDefault();
                        selectProduct(p);
                      }}
                    >
                      {productName(p, locale)}
                    </a>
                    <p className="product-subtitle">
                      {locale === "en"
                        ? productDetail(p, locale, "subtitle")
                        : `${t(p.category)} · ${productDetail(p, locale, "caseSize")}`}
                    </p>
                    <div className="product-bottom">
                      <Price product={p} />
                      <button
                        className="quick-add has-label"
                        onClick={() => add(p)}
                        disabled={!p.stock}
                        aria-label={`${t(p.stock ? "addCart" : "soldOut")}: ${productName(p, locale)}`}
                      >
                        {p.stock ? <Plus /> : <X />}
                        <span>{t(p.stock ? "addCart" : "soldOut")}</span>
                      </button>
                    </div>
                  </div>
                </TiltSurface>
              ))}
              {!visible.length && !catalogError && (
                <div className="empty-state">
                  <Watch />
                  <h3>{t("emptyProducts")}</h3>
                  <p>{t("emptyProductsDesc")}</p>
                  <button className="secondary-btn" onClick={resetFilters}>
                    {t("reset")}
                  </button>
                </div>
              )}
            </div>
            <div className="catalog-result">
              <span>
                {visible.length} / {filtered.length} {t("showing")}
              </span>
              <span>{t("curated")}</span>
            </div>
            {!showAll && filtered.length > 4 && (
              <div className="all-load">
                <button
                  className="secondary-btn"
                  onClick={() => setShowAll(true)}
                >
                  {t("viewMore")}
                  <ArrowRight />
                </button>
              </div>
            )}
          </section>
          <WatchShowroom
            locale={locale}
            paused={motionPaused || Boolean(overlay)}
            onShop={() => browse()}
          />
          <section className="editorial" id="collections" data-reveal>
            <div className="editorial-image">
              <img
                src={editorialAsset.image}
                srcSet={productImageSet(editorialAsset.image)}
                sizes="(max-width: 440px) 450px, (max-width: 760px) 480px, 555px"
                alt={editorialAsset[locale]}
                width="700"
                height="700"
                loading="lazy"
                decoding="async"
              />
              <div className="editorial-caption">
                <div className="eyebrow">{t("editorialTag")}</div>
                <h2>
                  {t("editorialTitle")
                    .split("\n")
                    .map((line, i) => (
                      <span key={i}>
                        {line}
                        {i === 0 && <br />}
                      </span>
                    ))}
                </h2>
                <button className="text-link" onClick={() => browse("Sport")}>
                  {t("editorialLink")}
                  <ArrowUpRight />
                </button>
              </div>
            </div>
            <div className="story" id="story">
              <div className="eyebrow">
                <span className="blue-dot" />
                {t("storyTag")}
              </div>
              <h2>{t("storyTitle")}</h2>
              <p>{t("storyText")}</p>
              <button className="text-link" onClick={() => open("story")}>
                {t("storyLink")}
                <ArrowUpRight />
              </button>
            </div>
          </section>
          <section className="values" aria-labelledby="values-title" data-reveal>
            <h2 id="values-title" className="sr-only">{t("thoughtful")}</h2>
            {[
              [Watch, "value1", "value1Desc"],
              [Gem, "value2", "value2Desc"],
              [ShoppingBag, "value3", "value3Desc"],
            ].map(([Icon, k, sub]) => {
              const I = Icon as typeof Watch;
              return (
                <div className="value" key={String(k)}>
                  <span className="value-icon">
                    <I />
                  </span>
                  <div>
                    <h3>{t(k as TranslationKey)}</h3>
                    <p>{t(sub as TranslationKey)}</p>
                  </div>
                </div>
              );
            })}
          </section>
          <section className="faq-section" data-reveal>
            <div className="faq-header">
              <div className="eyebrow">{t("faqTag")}</div>
              <h2>{t("faqTitle")}</h2>
              <p>{t("faqDesc")}</p>
            </div>
            <div className="faq-list">
              {[1, 2, 3, 4].map((n) => (
                <details key={n}>
                  <summary>
                    {t(`q${n}` as TranslationKey)}
                    <Plus />
                  </summary>
                  <p>{t(`a${n}` as TranslationKey)}</p>
                </details>
              ))}
            </div>
          </section>
        </div>
      </main>
      <footer className="footer" inert={overlay ? true : undefined}>
        <div className="container">
          <div className="footer-grid">
            <div className="footer-about">
              <Brand />
              <p>{t("footerDesc")}</p>
            </div>
            <div>
              <h2>{t("shop")}</h2>
              <div className="footer-links">
                <button onClick={() => browse()}>{t("all")}</button>
                <button onClick={() => browse("Classic")}>
                  {t("Classic")}
                </button>
                <button onClick={() => browse("Sport")}>{t("Sport")}</button>
                <button onClick={() => browse("Limited")}>
                  {t("Limited")}
                </button>
              </div>
            </div>
            <div>
              <h2>{t("help")}</h2>
              <div className="footer-links">
                <a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer">
                  {t("contact")}
                </a>
                <button onClick={() => open("track")}>{t("track")}</button>
                <a href="/support">{legalPageLabels.contact[locale]}</a>
                <a href="/policies/shipping">{legalPageLabels.shipping[locale]}</a>
                <a href="/policies/returns">{legalPageLabels.returns[locale]}</a>
                <a href="/policies/privacy">{legalPageLabels.privacy[locale]}</a>
                <a href="/policies/cookies">{legalPageLabels.cookies[locale]}</a>
                <a href="/policies/terms">{legalPageLabels.terms[locale]}</a>
                <a href="/policies/legal-notice">{legalPageLabels["legal-notice"][locale]}</a>
                <a href="/admin">{t("admin")}</a>
              </div>
            </div>
            <div className="footer-delivery">
              <h2>{t("morocco")}</h2>
              <p>{t("deliveryText")}</p>
              <span className="cod-pill">
                <Banknote />
                {t("payDelivery")}
              </span>
            </div>
          </div>
          <div className="footer-bottom">
            <p>
              © {new Date().getFullYear()} {t("copyright")}
            </p>
            <a className="hexops-credit" href="https://hexops.pro" target="_blank" rel="noopener noreferrer" aria-label={`${hexopsCredit[locale].label} HexOps — ${hexopsCredit[locale].visit}`}>
              <Image src="/images/hexops-icon.ico" alt="" width={20} height={20} unoptimized />
              <span>{hexopsCredit[locale].label} <strong>HexOps</strong></span>
              <ArrowUpRight size={13} aria-hidden="true" />
            </a>
            <div>
              <span>
                <i className="morocco-dot" /> {t("morocco")}
              </span>
              <button onClick={() => open("terms")}>{t("terms")}</button>
              <span>{currency}</span>
            </div>
          </div>
        </div>
      </footer>
      <div className="floating-socials" inert={overlay ? true : undefined}>
        {socialOpen && <div className="social-links" id="social-contact-menu" aria-label={socialLabels[locale].menu}>
          <a className="social-link facebook" href={FACEBOOK_URL} target="_blank" rel="noopener noreferrer" aria-label={socialLabels[locale].facebook} title="Facebook" onClick={() => setSocialOpen(false)}>
            <FacebookIcon />
          </a>
          <a className="social-link instagram" href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" aria-label={socialLabels[locale].instagram} title="Instagram" onClick={() => setSocialOpen(false)}>
            <InstagramIcon />
          </a>
          <a className="social-link whatsapp" href={SUPPORT_URL} target="_blank" rel="noopener noreferrer" aria-label={socialLabels[locale].whatsapp} title="WhatsApp" onClick={() => setSocialOpen(false)}>
            <MessageCircle aria-hidden="true" />
          </a>
        </div>}
        <button
          className={`social-trigger${socialOpen ? " active" : ""}`}
          type="button"
          aria-expanded={socialOpen}
          aria-controls="social-contact-menu"
          aria-label={socialOpen ? socialLabels[locale].close : socialLabels[locale].open}
          title={socialLabels[locale].menu}
          onClick={() => setSocialOpen((value) => !value)}
        >
          {socialOpen ? <X aria-hidden="true" /> : <MessageCircle aria-hidden="true" />}
        </button>
        <a className="hexops-float" href="https://hexops.pro" target="_blank" rel="noopener noreferrer" aria-label={hexopsCredit[locale].visit} title="HexOps">
          <Image src="/images/hexops-icon.ico" alt="" width={27} height={27} unoptimized />
        </a>
      </div>

      {overlay === "cart" && (
        <Modal
          title={
            <>
              {t("yourBag")}
              <span>{count}</span>
            </>
          }
          onClose={close}
          className="drawer"
          closeLabel={t("close")}
        >
          <div className="modal-body">
            {!cart.length ? (
              <div className="empty-state">
                <ShoppingBag />
                <h3>{t("emptyCart")}</h3>
                <p>{t("emptyCartDesc")}</p>
                <button
                  className="primary-btn"
                  onClick={() => {
                    close();
                    browse();
                  }}
                >
                  {t("shopWatches")}
                  <ArrowUpRight />
                </button>
              </div>
            ) : (
              <>
                <div className="shipping-message">
                  {subtotal >= 1000
                    ? t("freeReached")
                    : `${money(1000 - subtotal)} ${currency} ${t("freeRemaining")}`}
                  <div className="shipping-progress">
                    <span
                      style={{ width: `${Math.min(100, subtotal / 10)}%` }}
                    />
                  </div>
                </div>
                {cartLines.map(({ item, product: p }) => (
                  <div className="cart-line" key={item.productId}>
                    <div className="cart-image">
                      <img
                        src={productThumbnail(
                          p?.images[0] || "/images/watch-hero.webp",
                        )}
                        alt={p ? productName(p, locale) : t("soldOut")}
                        width="70"
                        height="88"
                      />
                    </div>
                    <div>
                      <h3>{p ? productName(p, locale) : t("soldOut")}</h3>
                      <p>
                        {p ? productDetail(p, locale, "caseSize") : ""} · {p ? t(p.category) : ""}
                      </p>
                      {(!p || item.quantity > p.stock) && (
                        <p className="cart-warning">{t("cartStock")}</p>
                      )}
                      <div className="quantity">
                        <button
                          onClick={() =>
                            updateQty(item.productId, item.quantity - 1)
                          }
                          aria-label={`${t("quantity")} −`}
                        >
                          <Minus />
                        </button>
                        <span>{item.quantity}</span>
                        <button
                          onClick={() =>
                            updateQty(item.productId, item.quantity + 1)
                          }
                          disabled={
                            !p || item.quantity >= Math.min(p.stock, 10)
                          }
                          aria-label={`${t("quantity")} +`}
                        >
                          <Plus />
                        </button>
                      </div>
                    </div>
                    <div className="cart-line-price">
                      {money((p?.price || 0) * item.quantity)} {currency}
                      <button
                        className="icon-button"
                        aria-label={t("remove")}
                        onClick={() => updateQty(item.productId, 0)}
                      >
                        <Trash2 />
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
          {cart.length > 0 && (
            <div className="drawer-footer">
              <Summary />
              {catalogError && (
                <p className="form-error">{t("catalogError")}</p>
              )}
              <button
                className="primary-btn"
                disabled={invalidCart || catalogError}
                onClick={() => open("checkout")}
              >
                {t("checkout")}
                <ArrowRight />
              </button>
              <p className="secure-note">
                <LockKeyhole />
                {t("secure")}
              </p>
            </div>
          )}
        </Modal>
      )}

      {overlay === "product" && selected && (
        <Modal
          title={t("productDetails")}
          onClose={close}
          className="product-modal"
          closeLabel={t("close")}
          titleAs="p"
          labelledBy="detail-product-title"
        >
          <div className="product-detail">
            <div>
              <div className="detail-image">
                <img
                  src={selected.images[imageIndex] || "/images/watch-hero.webp"}
                  srcSet={productImageSet(
                    selected.images[imageIndex] || "/images/watch-hero.webp",
                  )}
                  sizes="(max-width: 760px) 255px, 340px"
                  fetchPriority="high"
                  alt={productName(selected, locale)}
                  width="500"
                  height="500"
                />
              </div>
              {selected.images.length > 1 && (
                <div className="detail-thumbnails">
                  {selected.images.map((src, i) => (
                    <button
                      className={i === imageIndex ? "active" : ""}
                      key={src + i}
                      onClick={() => setImageIndex(i)}
                      aria-label={`${t("productDetails")} ${i + 1}`}
                    >
                      <img
                        src={productThumbnail(src)}
                        alt=""
                        width="55"
                        height="55"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="detail-copy">
              <div className="eyebrow">
                <span className="blue-dot" />
                {t(selected.category)}
              </div>
              <ProductHeading id="detail-product-title" className="detail-product-title">
                {productName(selected, locale)}
              </ProductHeading>
              <p className="product-subtitle">
                {locale === "en"
                  ? productDetail(selected, locale, "subtitle")
                  : `${t(selected.category)} · ${productDetail(selected, locale, "caseSize")}`}
              </p>
              <Price product={selected} />
              <p className="detail-description">
                {productDescription(selected, locale)}
              </p>
              <p className="stock-note">
                <i />
                {selected.stock
                  ? `${t("inStock")} · ${selected.stock} ${t("remaining")}`
                  : t("soldOut")}
              </p>
              <div className="detail-actions">
                <div className="quantity">
                  <button
                    onClick={() => setDetailQty((v) => Math.max(1, v - 1))}
                    disabled={detailQty <= 1}
                    aria-label={`${t("quantity")} −`}
                  >
                    <Minus />
                  </button>
                  <span>{detailQty}</span>
                  <button
                    onClick={() =>
                      setDetailQty((v) => Math.min(selected.stock, 10, v + 1))
                    }
                    disabled={detailQty >= Math.min(selected.stock, 10)}
                    aria-label={`${t("quantity")} +`}
                  >
                    <Plus />
                  </button>
                </div>
                <button
                  className="primary-btn"
                  disabled={!selected.stock}
                  onClick={() => add(selected, detailQty)}
                >
                  <ShoppingBag />
                  {t(selected.stock ? "addCart" : "soldOut")}
                </button>
                <button
                  className={`icon-button favorite-detail ${favorites.includes(selected.id) ? "saved" : ""}`}
                  onClick={() => toggleFavorite(selected.id)}
                  aria-label={t("wishlist")}
                  aria-pressed={favorites.includes(selected.id)}
                >
                  <Heart />
                </button>
              </div>
              <dl className="detail-specs">
                {[
                  ["movement", productDetail(selected, locale, "movement")],
                  ["caseSize", productDetail(selected, locale, "caseSize")],
                  ["waterResistance", productDetail(selected, locale, "waterResistance")],
                  ["material", productDetail(selected, locale, "material")],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt>{t(k as TranslationKey)}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="detail-promise">
                <ShieldCheck />
                {t("detailPromise")}
              </p>
            </div>
          </div>
        </Modal>
      )}

      {overlay === "checkout" && (
        <Modal
          title={t("checkoutTitle")}
          onClose={() => {
            if (!busy) open("cart");
          }}
          className="checkout-modal"
          closeLabel={t("close")}
        >
          <div className="modal-body checkout-layout">
            <form onSubmit={submitOrder}>
              <h3 className="form-step">
                <span>01</span>
                {t("customerDetails")}
              </h3>
              <div className="form-grid">
                <label className="full">
                  {t("name")}
                  <input
                    name="name"
                    autoComplete="name"
                    required
                    minLength={2}
                    maxLength={100}
                    placeholder={t("namePlaceholder")}
                  />
                </label>
                <label>
                  {t("phone")}
                  <input
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    required
                    pattern={"(?:[+]212|0)[0-9 ]{8,14}"}
                    maxLength={20}
                    placeholder="06 12 34 56 78"
                    dir="ltr"
                    title="06 12 34 56 78 / +212 612345678"
                  />
                </label>
                <label>
                  {t("city")}
                  <input
                    name="city"
                    list="moroccan-cities"
                    required
                    minLength={2}
                    maxLength={80}
                    autoComplete="address-level2"
                    placeholder={t("selectCity")}
                  />
                  <datalist id="moroccan-cities">
                    {storeSettings.shipping.cities.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </label>
                <label className="full">
                  {t("address")}
                  <textarea
                    name="address"
                    autoComplete="street-address"
                    required
                    minLength={8}
                    maxLength={300}
                    placeholder={t("addressPlaceholder")}
                  />
                </label>
                <label className="full">
                  {t("email")}
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    maxLength={200}
                    placeholder="you@example.com"
                    dir="ltr"
                  />
                </label>
                <label className="full">
                  {t("notes")}
                  <textarea
                    name="notes"
                    maxLength={500}
                    placeholder={t("notesPlaceholder")}
                    rows={2}
                  />
                </label>
              </div>
              <div className="cod-card">
                <Banknote />
                <div>
                  <h4>{t("payDelivery")}</h4>
                  <p>{t("codDescription")}</p>
                </div>
                <Check size={16} />
              </div>
              {storeSettings.checkout.instructions && <p className="checkout-instructions">{storeSettings.checkout.instructions}</p>}
              <p className="checkout-review-note"><ShieldCheck size={15} />{legalCheckoutCopy[locale].review}</p>
              <label className="checkout-consent required-consent">
                <input name="termsAccepted" type="checkbox" required />
                <span>{legalCheckoutCopy[locale].accept} <a href="/policies/terms" target="_blank" rel="noopener">{t("terms")}</a>.</span>
              </label>
              {storeSettings.checkout.marketingEnabled && <label className="checkout-consent">
                <input name="marketingConsent" type="checkbox" />
                <span>{legalCheckoutCopy[locale].marketing}</span>
              </label>}
              {!termsVersionId && <div className="form-error" role="alert">{legalCheckoutCopy[locale].unavailable}</div>}
              {error && (
                <div className="form-error" role="alert">
                  {error}
                </div>
              )}
              {invalidCart && (
                <div className="form-error" role="alert">
                  {t("cartStock")}
                </div>
              )}
              <button
                className="primary-btn checkout-submit"
                type="submit"
                disabled={busy || invalidCart || !cart.length || catalogError || !termsVersionId || !storeSettings.shipping.codEnabled}
              >
                {busy ? (
                  <>
                    <span className="loading-spinner" />
                    {t("placing")}
                  </>
                ) : (
                  <>
                    {t("placeOrder")}
                    <ArrowRight />
                  </>
                )}
              </button>
              <p className="form-footnote">
                {t("agree")}{" "}
                <a href="/policies/terms" target="_blank" rel="noopener">
                  {t("terms")}
                </a>{" "}
                {t("and")}{" "}
                <a href="/policies/privacy" target="_blank" rel="noopener">
                  {t("privacy")}
                </a>
                .
              </p>
            </form>
            <aside className="checkout-summary">
              <h3>
                {t("orderSummary")} ({count})
              </h3>
              {activeLines.map(({ item, product: p }) => (
                <div className="summary-item" key={p.id}>
                  <img
                    src={productThumbnail(p.images[0])}
                    alt=""
                    width="37"
                    height="49"
                  />
                  <div>
                    <strong>{productName(p, locale)}</strong>
                    <span>
                      {t("quantity")}: {item.quantity}
                    </span>
                  </div>
                  <b>
                    {money(p.price * item.quantity)} {currency}
                  </b>
                </div>
              ))}
              <div className="summary-totals">
                <Summary />
              </div>
              <p className="secure-note">
                <ShieldCheck />
                {t("secure")}
              </p>
            </aside>
          </div>
        </Modal>
      )}

      {overlay === "success" && receipt && (
        <Modal
          title="AYOUB SHOP"
          onClose={close}
          className="modal-narrow"
          closeLabel={t("close")}
        >
          <div className="success-view">
            <div className="success-icon">
              <Check />
            </div>
            <h2>{t("thankYou")}</h2>
            <p>{t("orderSuccess")}</p>
            <div className="order-receipt">
              <p>
                <span>{t("orderNumber")}</span>
                <strong>{receipt.order.number}</strong>
              </p>
              <p>
                <span>{t("total")}</span>
                <strong>
                  {money(receipt.order.total)} {currency}
                </strong>
              </p>
              <p>
                <span>{t("payment")}</span>
                <strong>{t("payDelivery")}</strong>
              </p>
              <p>
                <span>{t("trackingCode")}</span>
                <strong className="tracking-secret" dir="ltr">
                  {receipt.trackingToken}
                </strong>
              </p>
            </div>
            <p className="token-warning">{t("keepCode")}</p>
            <button
              className="text-link"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    `${receipt.order.number}\n${receipt.trackingToken}`,
                  );
                  notify(t("copied"));
                } catch {
                  notify(t("copyFail"));
                }
              }}
            >
              <Copy />
              {t("copy")}
            </button>
            <div className="success-actions">
              <button className="primary-btn" onClick={followReceipt}>
                {t("track")}
                <ArrowRight />
              </button>
              <button className="secondary-btn" onClick={close}>
                {t("continueShopping")}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {overlay === "track" && (
        <Modal
          title={t("trackTitle")}
          onClose={close}
          className="modal-narrow"
          closeLabel={t("close")}
        >
          <div className="modal-body">
            <p className="policy-copy" style={{ marginBottom: 22 }}>
              {t("trackDesc")}
            </p>
            <form className="track-form" onSubmit={findOrder}>
              <label>
                {t("orderNumber")}
                <input
                  value={trackNumber}
                  onChange={(e) => setTrackNumber(e.target.value)}
                  required
                  maxLength={50}
                  placeholder="AY-…"
                  dir="ltr"
                />
              </label>
              <label>
                {t("trackingCode")}
                <input
                  value={trackToken}
                  onChange={(e) => setTrackToken(e.target.value)}
                  required
                  maxLength={150}
                  autoComplete="off"
                  dir="ltr"
                />
              </label>
              {lastOrder && (
                <button
                  type="button"
                  className="text-link"
                  onClick={() => {
                    setTrackNumber(lastOrder.number);
                    setTrackToken(lastOrder.token);
                    setTracked(null);
                  }}
                >
                  <Clock3 />
                  {t("recentOrder")}
                </button>
              )}
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <button className="primary-btn" disabled={busy}>
                {busy ? (
                  <>
                    <span className="loading-spinner" />
                    {t("finding")}
                  </>
                ) : (
                  <>
                    {t("trackButton")}
                    <ArrowRight />
                  </>
                )}
              </button>
            </form>
            {tracked && (
              <div className="track-result" aria-live="polite">
                <div className="cart-total-line">
                  <strong>{tracked.number}</strong>
                  <span className="status-pill">{t(tracked.status)}</span>
                </div>
                {tracked.status !== "cancelled" && (
                  <div className="track-steps">
                    {(
                      ["pending", "confirmed", "shipped", "delivered"] as const
                    ).map((s, i) => (
                      <div
                        key={s}
                        className={`track-step ${i <= ["pending", "confirmed", "shipped", "delivered"].indexOf(tracked.status) ? "done" : ""}`}
                      >
                        <i>
                          {i <
                          [
                            "pending",
                            "confirmed",
                            "shipped",
                            "delivered",
                          ].indexOf(tracked.status)
                            ? "✓"
                            : i + 1}
                        </i>
                        <span>{t(s)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {tracked.items.map((item, i) => (
                  <div className="summary-item" key={i}>
                    <div>
                      <strong>{item.name}</strong>
                      <span>
                        {t("quantity")}: {item.quantity}
                      </span>
                    </div>
                    <b>
                      {money(item.price * item.quantity)} {currency}
                    </b>
                  </div>
                ))}
                <div className="cart-total-line total">
                  <span>{t("total")}</span>
                  <span>
                    {money(tracked.total)} {currency}
                  </span>
                </div>
                <p className="form-footnote">
                  {t("orderDate")}:{" "}
                  {new Date(tracked.createdAt).toLocaleDateString(
                    locale === "ar"
                      ? "ar-MA"
                      : locale === "fr"
                        ? "fr-MA"
                        : "en-GB",
                  )}
                </p>
                <a
                  className="text-link"
                  style={{ marginTop: 20, fontSize: 11 }}
                  href={`${SUPPORT_URL}?text=${encodeURIComponent(`Hello Ayoub Shop, I need help with order ${tracked.number}.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle size={15} />
                  {t("contactOrder")}
                </a>
              </div>
            )}
          </div>
        </Modal>
      )}

      {overlay === "search" && (
        <Modal
          title={t("search")}
          onClose={close}
          className="search-dialog"
          closeLabel={t("close")}
        >
          <div className="search-input-wrap">
            <Search />
            <input
              placeholder={t("searchPlaceholder")}
              aria-label={t("search")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                className="icon-button"
                aria-label={t("reset")}
                onClick={() => setQuery("")}
              >
                <X />
              </button>
            )}
          </div>
          <p className="search-hint">{t("searchHint")}</p>
          <p className="search-shortcut">{t("searchShortcut")}</p>
          <div className="search-results" aria-busy={query !== deferredQuery}>
            {searchResults.map((p) => (
              <button
                className="search-hit"
                key={p.id}
                onClick={() => selectProduct(p)}
              >
                <img
                  src={productThumbnail(p.images[0])}
                  alt=""
                  width="45"
                  height="60"
                />
                <div>
                  <h3>{productName(p, locale)}</h3>
                  <p>
                    {t(p.category)} · {productDetail(p, locale, "caseSize")}
                  </p>
                </div>
                <span>
                  {money(p.price)} {currency}
                </span>
                <ChevronRight size={15} />
              </button>
            ))}
            {!searchResults.length && (
              <p className="search-hint">{t("noSearch")}</p>
            )}
          </div>
        </Modal>
      )}
      {["privacy", "terms", "shipping", "story"].includes(overlay || "") && (
        <Modal
          title={policyTitle}
          onClose={close}
          className="modal-narrow"
          closeLabel={t("close")}
        >
          <div className="modal-body policy-copy">
            <p>{t(`${overlay}Policy` as TranslationKey)}</p>
            <a
              className="text-link"
              href={SUPPORT_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{ marginTop: 24 }}
            >
              <MessageCircle size={16} />
              {t("contact")}
            </a>
          </div>
        </Modal>
      )}
      {toast && (
        <div
          className="toast-stack"
          role="status"
          onMouseEnter={holdToast}
          onMouseLeave={resumeToast}
          onFocusCapture={holdToast}
          onBlurCapture={() => {
            toastTimer.current = setTimeout(() => setToast(""), 3300);
          }}
        >
          <Check />
          {toast}
          {toast === t("added") && (
            <button onClick={() => open("cart")}>
              {t("viewBag")}
              <ArrowRight size={13} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
