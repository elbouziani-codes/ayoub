import { listProducts } from "@/lib/server/catalog";
export async function GET() {
  const base = "https://ayoub-shop-watches.splendidelderberry1.chatgpt.site";
  const products = await listProducts();
  const paths = [
    "/",
    "/policies/shipping",
    "/policies/privacy",
    "/policies/terms",
    ...products.map((p) => `/products/${p.slug}`),
  ];
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((path) => `<url><loc>${base}${path}</loc></url>`).join("")}</urlset>`,
    {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    },
  );
}
