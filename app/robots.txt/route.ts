import { SITE_URL } from "@/lib/shop-config";

export function GET() {
  return new Response(
    ["User-agent: *", "Allow: /", "Allow: /api/images/", "Disallow: /admin", "Disallow: /api/", "", `Sitemap: ${SITE_URL}/sitemap.xml`, ""].join("\n"),
    { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } },
  );
}
