import Storefront from "@/components/storefront";
import { listProducts } from "@/lib/server/catalog";
import { getRequestLocale, homeStructuredData, serializeJsonLd } from "@/lib/seo";
import { getContentOverrides, getEditorialAsset } from "@/lib/server/content";
export const dynamic = "force-dynamic";
export default async function Home() {
  const [locale, contentOverrides, editorialAsset, catalogProducts] = await Promise.all([
    getRequestLocale(),
    getContentOverrides(),
    getEditorialAsset(),
    listProducts().catch(() => null),
  ]);
  const products = catalogProducts ?? [];
  const catalogUnavailable = catalogProducts === null;
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(homeStructuredData(products, locale, contentOverrides)) }} />
      <Storefront initialProducts={products} catalogUnavailable={catalogUnavailable} initialLocale={locale} contentOverrides={contentOverrides} editorialAsset={editorialAsset} />
    </>
  );
}
