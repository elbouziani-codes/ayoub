export function GET() {
  return new Response(
    "User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nSitemap: https://ayoub-shop-watches.splendidelderberry1.chatgpt.site/sitemap.xml",
    { headers: { "Content-Type": "text/plain; charset=utf-8" } },
  );
}
