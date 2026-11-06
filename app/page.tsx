import Storefront from "@/components/storefront";
import { listProducts } from "@/lib/server/catalog";
import { getRequestLocale, homeStructuredData, serializeJsonLd } from "@/lib/seo";
import type { Product } from "@/lib/types";
export const dynamic = "force-dynamic";
export default async function Home() {
  const locale = await getRequestLocale();
  let products: Product[] = [];
  let catalogUnavailable = false;
  try {
    products = await listProducts();
  } catch {
    catalogUnavailable = true;
  }
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(homeStructuredData(products, locale)) }} />
      <Storefront initialProducts={products} catalogUnavailable={catalogUnavailable} initialLocale={locale} />
    </>
  );
}
