import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import Storefront from "@/components/storefront";
import { listProducts, getProductBySlug } from "@/lib/server/catalog";
import { localizedDictionary, productDescription, productName } from "@/lib/i18n";
import { getRequestLocale, pageMetadata, productPath, productStructuredData, serializeJsonLd } from "@/lib/seo";
import { getContentOverrides, getEditorialAsset } from "@/lib/server/content";
import { getPublishedLegalPage } from "@/lib/server/legal";
import { getStoreSettings } from "@/lib/server/store-settings";
export const dynamic = "force-dynamic";
const findProduct = cache(getProductBySlug);
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const [product, locale] = await Promise.all([findProduct(slug), getRequestLocale()]);
  if (!product) return { title: localizedDictionary(locale, await getContentOverrides()).seoNotFound, robots: { index: false, follow: true } };
  return pageMetadata({
    locale,
    title: productName(product, locale),
    description: productDescription(product, locale),
    path: productPath(product.slug),
    images: product.images.map((url) => ({ url, alt: productName(product, locale) })),
  });
}
export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [product, locale, contentOverrides, editorialAsset, storeSettings, terms] = await Promise.all([findProduct(slug), getRequestLocale(), getContentOverrides(), getEditorialAsset(), getStoreSettings(), getPublishedLegalPage("terms")]);
  if (!product) notFound();
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(productStructuredData(product, locale, contentOverrides)),
        }}
      />
      <Storefront
        initialProducts={await listProducts()}
        initialProduct={product}
        initialLocale={locale}
        contentOverrides={contentOverrides}
        editorialAsset={editorialAsset}
        storeSettings={storeSettings}
        termsVersionId={terms?.id ?? null}
      />
    </>
  );
}
