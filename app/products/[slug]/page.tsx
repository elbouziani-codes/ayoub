import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import Storefront from "@/components/storefront";
import { listProducts, getProductBySlug } from "@/lib/server/catalog";
import { productDescription, productName } from "@/lib/i18n";
import { getRequestLocale, pageMetadata, productPath, productStructuredData, SEO_COPY, serializeJsonLd } from "@/lib/seo";
export const dynamic = "force-dynamic";
const findProduct = cache(getProductBySlug);
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const [product, locale] = await Promise.all([findProduct(slug), getRequestLocale()]);
  if (!product) return { title: SEO_COPY[locale].notFound, robots: { index: false, follow: true } };
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
  const [product, locale] = await Promise.all([findProduct(slug), getRequestLocale()]);
  if (!product) notFound();
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(productStructuredData(product, locale)),
        }}
      />
      <Storefront
        initialProducts={await listProducts()}
        initialProduct={product}
        initialLocale={locale}
      />
    </>
  );
}
