import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import Storefront from "@/components/storefront";
import { listProducts, getProductBySlug } from "@/lib/server/catalog";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProductBySlug(slug);
  if (!p) return { title: "Watch not found", robots: { index: false } };
  return {
    title: p.name,
    description: p.description,
    alternates: { canonical: `/products/${p.slug}` },
    openGraph: {
      title: p.name,
      description: p.description,
      images: p.images.map((url) => ({ url, alt: p.name })),
    },
  };
}
export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();
  const saved = (await cookies()).get("ayoub-language")?.value;
  const locale = saved === "fr" || saved === "ar" ? saved : "en";
  const structured = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: product.images.map(
      (p) =>
        new URL(
          p,
          "https://ayoub-shop-watches.splendidelderberry1.chatgpt.site",
        ).href,
    ),
    sku: product.id,
    brand: { "@type": "Brand", name: "Ayoub Shop" },
    offers: {
      "@type": "Offer",
      price: product.price,
      priceCurrency: "MAD",
      availability: product.stock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      url: `https://ayoub-shop-watches.splendidelderberry1.chatgpt.site/products/${product.slug}`,
    },
  };
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structured).replace(/</g, "\\u003c"),
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
