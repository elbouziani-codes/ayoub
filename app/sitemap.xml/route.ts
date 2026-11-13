import { listProducts } from "@/lib/server/catalog";
import { SITE_URL } from "@/lib/shop-config";
import { legalPageSlugs } from "@/lib/legal";

export const dynamic = "force-dynamic";

const escapeXml = (value: string) => value.replace(/[<>&'\"]/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '\"': "&quot;" })[character]!);

export async function GET() {
  const products = await listProducts();
  const paths: { path: string; updatedAt?: string }[] = [
    { path: "/" },
    { path: "/support" },
    ...legalPageSlugs.map((slug) => ({ path: `/policies/${slug}` })),
    ...products.map((product) => ({ path: `/products/${encodeURIComponent(product.slug)}`, updatedAt: product.updatedAt })),
  ];
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map(({ path, updatedAt }) => {
      const modified = updatedAt && Number.isFinite(Date.parse(updatedAt)) ? `<lastmod>${new Date(updatedAt).toISOString()}</lastmod>` : "";
      return `<url><loc>${escapeXml(new URL(path, SITE_URL).href)}</loc>${modified}</url>`;
    }).join("")}</urlset>`,
    {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    },
  );
}
