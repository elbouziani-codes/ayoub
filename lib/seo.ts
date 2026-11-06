import { cache } from "react";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { dictionaries, productDescription, productName, type Locale } from "./i18n";
import { SHOP_COUNTRY, SHOP_CURRENCY, SITE_NAME, SITE_URL, SUPPORT_URL, SUPPORT_WHATSAPP } from "./shop-config";
import type { Product } from "./types";

export const SEO_COPY = {
  en: {
    title: "Ayoub Shop | Premium Watches & Accessories",
    description: "Discover modern watches at Ayoub Shop. Browse the collection, shop in Moroccan dirhams, and pay cash on delivery across Morocco.",
    collection: "Premium watches in Morocco",
    notFound: "Watch not found",
    openGraphLocale: "en_MA",
  },
  fr: {
    title: "Ayoub Shop | Montres et accessoires premium",
    description: "Découvrez les montres modernes d’Ayoub Shop. Explorez la collection, achetez en dirhams marocains et payez en espèces à la livraison au Maroc.",
    collection: "Montres premium au Maroc",
    notFound: "Montre introuvable",
    openGraphLocale: "fr_MA",
  },
  ar: {
    title: "أيوب شوب | ساعات وإكسسوارات راقية",
    description: "اكتشف الساعات العصرية من أيوب شوب. تصفح المجموعة وتسوق بالدرهم المغربي مع الدفع نقداً عند الاستلام في جميع أنحاء المغرب.",
    collection: "ساعات راقية في المغرب",
    notFound: "الساعة غير موجودة",
    openGraphLocale: "ar_MA",
  },
} as const;

/** Bots without a language cookie consistently receive the English URL content. */
export const getRequestLocale = cache(async (): Promise<Locale> => {
  const saved = (await cookies()).get("ayoub-language")?.value;
  return saved === "fr" || saved === "ar" ? saved : "en";
});

export const absoluteUrl = (path = "/") => new URL(path, SITE_URL).href;
export const productPath = (slug: string) => `/products/${encodeURIComponent(slug)}`;
export const productUrl = (slug: string) => absoluteUrl(productPath(slug));

export const metaDescription = (text: string) => {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= 165) return compact;
  return `${compact.slice(0, 162).replace(/\s+\S*$/, "")}…`;
};

/** The replacement prevents merchant-entered text from closing a JSON-LD script. */
export const serializeJsonLd = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");

export function pageMetadata({
  locale,
  title,
  description,
  path,
  images = [{ url: "/images/watch-hero.webp", width: 1100, height: 1100, alt: "Ayoub Shop Eclipse Chronograph" }],
}: {
  locale: Locale;
  title: string;
  description: string;
  path: string;
  images?: { url: string; alt: string; width?: number; height?: number }[];
}): Metadata {
  const canonical = absoluteUrl(path);
  const summary = metaDescription(description);
  return {
    title,
    description: summary,
    alternates: { canonical },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: SEO_COPY[locale].openGraphLocale,
      url: canonical,
      title,
      description: summary,
      images: images.map((image) => ({ ...image, url: absoluteUrl(image.url) })),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: summary,
      images: images.map((image) => ({ url: absoluteUrl(image.url), alt: image.alt })),
    },
  };
}

function organization() {
  return {
    "@type": "OnlineStore",
    "@id": absoluteUrl("/#organization"),
    name: SITE_NAME,
    url: absoluteUrl(),
    logo: absoluteUrl("/favicon.svg"),
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      telephone: `+${SUPPORT_WHATSAPP}`,
      url: SUPPORT_URL,
      areaServed: SHOP_COUNTRY,
      availableLanguage: ["English", "French", "Arabic"],
    },
  };
}

export function homeStructuredData(products: Product[], locale: Locale) {
  // Match the initial, featured-first storefront selection rather than hidden items.
  const visibleProducts = [...products].sort((a, b) => Number(b.featured) - Number(a.featured)).slice(0, 4);
  return {
    "@context": "https://schema.org",
    "@graph": [
      organization(),
      {
        "@type": "WebSite",
        "@id": absoluteUrl("/#website"),
        url: absoluteUrl(),
        name: SITE_NAME,
        publisher: { "@id": absoluteUrl("/#organization") },
        inLanguage: ["en-MA", "fr-MA", "ar-MA"],
      },
      {
        "@type": "CollectionPage",
        "@id": absoluteUrl("/#webpage"),
        url: absoluteUrl(),
        name: SEO_COPY[locale].collection,
        description: SEO_COPY[locale].description,
        inLanguage: `${locale}-MA`,
        isPartOf: { "@id": absoluteUrl("/#website") },
        ...(visibleProducts.length ? {
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: visibleProducts.length,
            itemListElement: visibleProducts.map((product, index) => ({
              "@type": "ListItem",
              position: index + 1,
              name: productName(product, locale),
              url: productUrl(product.slug),
            })),
          },
        } : {}),
      },
    ],
  };
}

export function productStructuredData(product: Product, locale: Locale) {
  const url = productUrl(product.slug);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        "@id": `${url}#product`,
        url,
        name: productName(product, locale),
        description: productDescription(product, locale),
        image: product.images.map(absoluteUrl),
        sku: product.id,
        brand: { "@type": "Brand", name: SITE_NAME },
        category: product.category,
        color: product.color,
        material: product.material,
        offers: {
          "@type": "Offer",
          url,
          price: product.price,
          priceCurrency: SHOP_CURRENCY,
          availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          seller: { "@type": "Organization", "@id": absoluteUrl("/#organization"), name: SITE_NAME, url: absoluteUrl() },
        },
        additionalProperty: [
          { "@type": "PropertyValue", name: "Movement", value: product.movement },
          { "@type": "PropertyValue", name: "Case size", value: product.caseSize },
          { "@type": "PropertyValue", name: "Water resistance", value: product.waterResistance },
        ],
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: dictionaries[locale].home, item: absoluteUrl() },
          { "@type": "ListItem", position: 2, name: productName(product, locale), item: url },
        ],
      },
    ],
  };
}
