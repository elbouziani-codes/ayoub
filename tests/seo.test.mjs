/** Read-only checks against rendered server HTML and the live catalog.
 * Usage: node tests/seo.test.mjs http://127.0.0.1:5173
 */
import assert from "node:assert/strict";

const base = new URL(process.argv[2] || "http://127.0.0.1:5173");
if (!["http:", "https:"].includes(base.protocol) || base.username || base.password) throw new Error("Provide an HTTP(S) site URL without credentials.");
let passed = 0;
const decode = (value = "") => value.replace(/&(?:amp|quot|apos|lt|gt|#(\d+)|#x([a-f\d]+));/gi, (entity, decimal, hex) => {
  if (decimal || hex) return String.fromCodePoint(Number.parseInt(decimal || hex, decimal ? 10 : 16));
  return { "&amp;": "&", "&quot;": '\"', "&apos;": "'", "&lt;": "<", "&gt;": ">" }[entity.toLowerCase()] || entity;
});
const attributes = (tag) => Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map((match) => [match[1].toLowerCase(), decode(match[2] ?? match[3])]));
const tags = (html, name) => [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, "gi"))].map(([tag]) => attributes(tag));
const documentHead = (html) => html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] || "";
const metadata = (html, name) => tags(documentHead(html), "meta").find((tag) => tag.name === name || tag.property === name)?.content;
const canonical = (html) => {
  const values = tags(documentHead(html), "link").filter((tag) => tag.rel === "canonical");
  assert.equal(values.length, 1, "Exactly one canonical URL must be rendered");
  return new URL(values[0].href).href;
};
const graph = (html) => [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)].flatMap(([, text]) => {
  const data = JSON.parse(text);
  return data["@graph"] || [data];
});
// Keep the English fixtures explicit, independent of the store's default locale.
const browserUserAgent = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
async function request(path, locale = "en", userAgent = browserUserAgent) {
  const response = await fetch(new URL(path, base), { headers: { "User-Agent": userAgent, ...(locale ? { Cookie: `ayoub-language=${locale}` } : {}) }, signal: AbortSignal.timeout(30000) });
  const html = await response.text();
  return { response, html };
}
async function check(name, run) {
  await run();
  passed += 1;
  console.log(`✓ ${name}`);
}

const home = await request("/");
assert.equal(home.response.status, 200);
const site = new URL(canonical(home.html));
assert.equal(site.pathname, "/");

await check("Homepage renders one canonical, descriptive title, and server metadata", () => {
  assert.match(home.html, /<title>Ayoub Shop[^<]*<\/title>/);
  assert.ok(metadata(home.html, "description")?.length > 70);
  assert.equal(new URL(metadata(home.html, "og:url")).href, site.href);
  assert.equal(metadata(home.html, "og:image:width"), "1100");
  assert.equal(metadata(home.html, "og:image:height"), "1100");
  assert.equal(tags(home.html, "html")[0]?.lang, "en");
});
await check("Browsers and Lighthouse receive one localized description in the initial HTML head", async () => {
  for (const userAgent of [browserUserAgent, `${browserUserAgent} Chrome-Lighthouse`]) {
    for (const locale of ["en", "fr", "ar"]) {
      const { html } = await request("/", locale, userAgent);
      const descriptions = tags(documentHead(html), "meta").filter((tag) => tag.name === "description");
      assert.equal(descriptions.length, 1);
      assert.ok(descriptions[0].content?.length > 70);
      assert.equal(tags(html, "html")[0]?.lang, locale);
    }
  }
});
await check("Business identity and visible catalog are available without executing JavaScript", () => {
  const data = graph(home.html);
  const organization = data.find((item) => item["@type"] === "OnlineStore");
  assert.equal(organization?.name, "Ayoub Shop");
  assert.equal(organization.contactPoint.areaServed, "MA");
  assert.equal(organization.contactPoint.telephone, "+212789948216");
  assert.ok(data.some((item) => item["@type"] === "WebSite"));
  assert.ok(data.some((item) => item["@type"] === "CollectionPage"));
});
await check("Homepage headings begin with one h1 and do not skip heading levels", () => {
  const markup = home.html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  const levels = [...markup.matchAll(/<h([1-6])\b[^>]*>/gi)].map((match) => Number(match[1]));
  assert.equal(levels[0], 1);
  assert.equal(levels.filter((level) => level === 1).length, 1);
  for (let index = 1; index < levels.length; index++) {
    assert.ok(levels[index] <= levels[index - 1] + 1, `Heading skips from h${levels[index - 1]} to h${levels[index]}`);
  }
});

const catalog = await request("/api/products");
assert.equal(catalog.response.status, 200);
const { products } = JSON.parse(catalog.html);
assert.ok(products.length, "A live catalog product is required for product SEO verification");
const product = products[0];
const path = `/products/${encodeURIComponent(product.slug)}`;
const page = await request(path);
assert.equal(page.response.status, 200);
await check("Product URL has its own canonical and metadata, rather than inheriting the homepage", () => {
  assert.equal(canonical(page.html), new URL(path, site).href);
  assert.equal(metadata(page.html, "og:url"), new URL(path, site).href);
  assert.ok(decode(page.html.match(/<title>([^<]*)<\/title>/)?.[1]).includes(product.name));
  assert.ok(metadata(page.html, "description"));
  assert.ok(tags(page.html, "meta").some((tag) => tag.name === "twitter:card" && tag.content === "summary_large_image"));
});
await check("Server-rendered Product offers match live catalog price, stock, and MAD currency", () => {
  const data = graph(page.html);
  const structured = data.find((item) => item["@type"] === "Product");
  assert.ok(structured, "Product JSON-LD must be present in the server response");
  assert.equal(structured.name, product.name);
  assert.equal(structured.sku, product.id);
  assert.equal(Number(structured.offers.price), product.price);
  assert.equal(structured.offers.priceCurrency, "MAD");
  assert.equal(structured.offers.availability, `https://schema.org/${product.stock > 0 ? "InStock" : "OutOfStock"}`);
  assert.equal(structured.offers.url, canonical(page.html));
  assert.ok(structured.image.length && structured.image.every((url) => new URL(url).protocol === "https:"));
  assert.equal(data.find((item) => item["@type"] === "BreadcrumbList")?.itemListElement.at(-1)?.item, canonical(page.html));
});
await check("French and Arabic server content, document language, and metadata remain consistent", async () => {
  const french = await request("/", "fr");
  assert.equal(tags(french.html, "html")[0]?.lang, "fr");
  assert.equal(metadata(french.html, "og:locale"), "fr_MA");
  assert.equal(canonical(french.html), site.href);
  const arabic = await request(path, "ar");
  assert.equal(tags(arabic.html, "html")[0]?.lang, "ar");
  assert.equal(tags(arabic.html, "html")[0]?.dir, "rtl");
  assert.equal(metadata(arabic.html, "og:locale"), "ar_MA");
  assert.equal(graph(arabic.html).find((item) => item["@type"] === "Product")?.name, product.nameAr || product.name);
  const arabicFont = tags(arabic.html, "link").find((tag) => tag.rel === "preload" && tag.href === "/fonts/noto-sans-arabic-arabic.woff2");
  assert.equal(arabicFont?.as, "font");
});
await check("Policy pages render their own canonical and description", async () => {
  for (const policy of ["legal-notice", "terms", "privacy", "returns", "shipping", "cookies", "contact"]) {
    const result = await request(`/policies/${policy}`);
    assert.equal(result.response.status, 200);
    assert.equal(canonical(result.html), new URL(`/policies/${policy}`, site).href);
    assert.ok(metadata(result.html, "description")?.length > 50);
  }
});
await check("Missing product and policy pages explicitly prevent indexing", async () => {
  for (const missing of ["/products/seo-missing-watch-not-in-catalog", "/policies/seo-missing-policy"]) {
    const result = await request(missing);
    assert.ok([200, 404].includes(result.response.status));
    assert.match(metadata(result.html, "robots") || "", /noindex/);
  }
});
await check("Robots keeps admin and API private while permitting product image crawling", async () => {
  const result = await request("/robots.txt");
  assert.equal(result.response.status, 200);
  assert.match(result.html, /^Disallow: \/admin$/m);
  assert.match(result.html, /^Disallow: \/api\/$/m);
  assert.match(result.html, /^Allow: \/api\/images\/$/m);
  assert.ok(result.html.includes(`Sitemap: ${new URL("/sitemap.xml", site).href}`));
});
await check("Sitemap lists canonical public URLs and real product modification dates", async () => {
  const result = await request("/sitemap.xml");
  assert.equal(result.response.status, 200);
  assert.match(result.response.headers.get("content-type"), /application\/xml/);
  const urls = [...result.html.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, value]) => new URL(decode(value)));
  assert.ok(urls.some((url) => url.href === site.href));
  assert.ok(urls.some((url) => url.href === new URL(path, site).href));
  assert.ok(urls.every((url) => url.origin === site.origin && !/^\/(admin|api)(\/|$)/.test(url.pathname)));
  assert.doesNotMatch(result.html, /<loc>[^<]*&(?!amp;|apos;|quot;|lt;|gt;)/);
  if (product.updatedAt) assert.ok(result.html.includes(`<lastmod>${new Date(product.updatedAt).toISOString()}</lastmod>`));
});
console.log(`\n${passed} read-only rendered SEO checks passed.`);
