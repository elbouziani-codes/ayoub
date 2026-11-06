# Ayoub Shop

A working multilingual watch store for Morocco. The application includes a responsive dark storefront, searchable and filterable catalog, product pages, saved watches, a persistent shopping bag, cash-on-delivery checkout, private order tracking, and protected administration.

## Run locally

Requires Node.js 24 (the test suite uses built-in TypeScript stripping and SQLite), npm, and a local port.

```sh
npm run install:ci
npm run build
```

Apply the initial migration **once** to a fresh local database:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_huge_captain_marvel.sql
```

Create an ignored `.dev.vars` for the local mock sign-in:

```text
ADMIN_EMAILS="seedy@sites.test"
```

```sh
npm run dev -- --port 5173
```

Open the URL printed by the server. The portable development integration signs in as `seedy@sites.test`; use the sign-in link at `/admin`. This identity simulation is excluded from production. Development and production databases and image storage are separate.

## Architecture

- **UI:** React 19, TypeScript, Vinext/Next-compatible App Router, Lucide icons, responsive liquid glass surfaces, pointer lighting, reveal transitions, and keyboard-accessible dialogs with inert backgrounds.
- **3D atelier:** A procedural Three.js watch design study with three finishes, dial/profile/caseback views, drag, zoom, reset, and keyboard controls. It is clearly distinguished from actual catalog products. The renderer loads near the viewport, caps pixel ratio and frame rate, pauses offscreen or in hidden tabs, disposes resources, and falls back to a product image when WebGL is unavailable. System reduced-motion preferences and a persistent global motion switch stop animation while keeping manual inspection available.
- **Backend:** Cloudflare Workers with server-side API authorization and Zod validation.
- **Records:** Cloudflare D1, schema in `db/schema.ts`, generated SQL in `drizzle/`.
- **Uploads:** Cloudflare R2; up to eight PNG/JPEG/WebP images per product, each at most 5 MiB. The admin browser decodes photos, preserves their aspect ratio, caps the longest edge at 1600 px, and encodes WebP at quality 0.85. A smaller original is retained only when it already meets the dimension limit. Browsers without WebP encoding use a resized PNG fallback; when image encoding is unavailable, only an original already within the dimension and size limits can be uploaded. Filenames are preserved and server-side MIME/signature checks and the 5 MiB limit still apply. SVG and remote image URLs are rejected. Gallery images can be reordered or removed without breaking historical order snapshots. Existing uploads are unchanged.
- **Authentication:** Sites gateway sign-in, plus a server-side `ADMIN_EMAILS` allowlist. An empty allowlist denies all administration. There are no default production passwords and no first-user ownership claims.
- **Locales:** English, French, Arabic with RTL. Language persists in a cookie and local storage; initial storefront rendering honors the cookie. Product translations can be edited in administration.
- **SEO:** Localized server-rendered catalog/product content, individual canonical URLs, localized social metadata, OnlineStore/Product/Offer/Breadcrumb JSON-LD using actual catalog prices and inventory, sitemap dates, and robots rules. Administration and general APIs are excluded from crawling; product image endpoints remain crawlable. Cookie-selected translations share URLs, so hreflang alternatives are deliberately omitted.
- **Performance:** Self-hosted variable WOFF2 fonts, responsive 400/800/1100px product images, 80px thumbnails, lazy images below the eager hero, deferred 3D code, immutable caching for uploads, and protected dynamic HTML caching. The four 400px catalog images total 95,886 bytes versus 638,304 bytes for their previous 1100px WebP originals (84.98% smaller). This is an asset comparison, not a Lighthouse or page-speed score.

### Source map

| Location | Purpose |
| --- | --- |
| `components/storefront.tsx` | Storefront, catalog interactions, dialogs, bag, checkout, tracking |
| `app/globals.css` | Visual tokens, liquid glass, responsive/RTL/reduced-motion styles |
| `app/upgrade.css` | Cinematic hero, navigation, catalog, and commerce styling |
| `components/watch-showroom.tsx`, `components/watch-scene.ts` | Accessible 3D controls and deferred WebGL renderer |
| `hooks/use-store-motion.ts` | Visibility-aware reveals, scroll progress, pointer lighting |
| `app/admin/` | Protected dashboard, products, inventory, images, order management |
| `app/api/` | Validated catalog, checkout, tracking, administration and images |
| `lib/server/` | Authentication, database access, commerce logic, rate limiting, transactions |
| `lib/catalog.ts` | One-time initial catalog data |
| `lib/i18n.ts` | Storefront translations and localized formatting |
| `lib/shop-config.ts` | Public shop origin and WhatsApp support number |
| `lib/seo.ts`, `lib/product-images.ts` | Server metadata/structured data and responsive image URLs |
| `db/`, `drizzle/` | Database schema and versioned schema-only migrations |
| `tests/` | Commerce, transaction, concurrency and live local API verification |

## Commerce behavior

Prices are integer MAD. Delivery is 35 MAD and becomes free at a product subtotal of 1,000 MAD. These defaults are implemented in the server's `calculateTotals` and mirrored in checkout. Payment is cash on delivery; no card or payment provider is required.

Checkout recomputes all prices from D1 and ignores client prices. Each submission uses a random UUID idempotency key bound to its normalized contents. Retrying an identical request returns the same order and tracking code. A different payload with the same key is rejected.

Orders and stock reservations commit in one D1 batch transaction. Database constraints roll back the entire cart if any product is unavailable or its quoted price changed. Stock cannot go negative. Stock edits require an `updatedAt` concurrency token, so a stale admin form cannot overwrite a checkout decrement.

The fulfillment sequence is `pending → confirmed → shipped → delivered`. Pending or confirmed orders can be cancelled, restoring reserved inventory exactly once. Terminal statuses cannot be reopened. Archiving a product hides it from shoppers and preserves order history. Administrator order history uses cursor pagination; the dashboard loads all pages for complete totals. Revenue means delivered cash-on-delivery orders only.

Tracking requires both the order number and a strong private code. Only the code's hash is stored in D1. Public tracking responses exclude name, phone, email, address and notes. Customers can open WhatsApp support from tracking without sharing their private code.

## Validate

```sh
npm run typecheck
npm test
npm run test:integration -- http://127.0.0.1:5173
node tests/seo.test.mjs http://127.0.0.1:5173
npm run build
```

The 16 commerce/SQLite tests cover Moroccan phone validation, shipping, input bounds, idempotency, CSRF checks, transaction rollback, stale catalog/price checks, exactly-once restocking, optimistic stock editing and eight concurrent buyers competing for three units.

The 13 live local integration checks exercise real development authentication cookies, D1, R2 uploads and retrieval, ETags, product CRUD and image ordering, stale-version rejection, checkout, replay conflicts, privacy-safe tracking, order transitions, cancellation, pagination and archival. The script refuses non-loopback URLs. It creates clearly marked local fixtures, archives its product, and retains local test orders for auditing.

Browser QA also covered a real local checkout and receipt, private tracking, admin sign-in and cancellation, Arabic RTL, and a 390-pixel mobile viewport. Test data never needs to be copied to the hosted database.

The nine read-only rendered SEO checks verify server-rendered content, canonical uniqueness, live offers, French/Arabic metadata, policy pages, missing-page noindex, crawl rules, and sitemap dates. A private hosting gate prevents public search indexing regardless of the application metadata. Lighthouse and real-user Core Web Vitals must be measured on the deployed public store before claiming a numeric performance or SEO score.

## Hosting and merchant settings

`.openai/hosting.json` identifies the private Sites deployment and declares D1 `DB` and R2 `BUCKET`. Publish with the Sites workflow so migrations apply before the Worker is uploaded. Never edit already-applied migrations; generate a new migration for future schema changes.

Production `ADMIN_EMAILS` is configured through Sites runtime settings, currently for the email supplied by the merchant. Sign in using that exact ChatGPT account email at `/admin`. Changes to the allowlist take effect after a new deployment. It is separate from the local mock identity.

The application must run behind the trusted Sites authentication gateway, which owns identity headers. Do not expose the raw Worker as an independent public origin. Mutation requests require a same-origin `Origin` header; the local integration tests verify this boundary.

Public WhatsApp support is configured as `+212 789 948 216`. Opening a support link prepares a conversation; the site does not send messages automatically.

The initial eight watches, prices, specifications, compare-at prices, promotional badges and stock are sample merchant-editable catalog data. Images are generated studio renders. Before accepting real customer orders, replace these with your actual inventory and photos and confirm the displayed delivery charges and store policies. The current Site is private for owner review; public access is a separate hosting audience setting. This app stores orders and supports manual fulfillment; it does not automatically dispatch a courier or send SMS/email notifications. Administrators update status in the dashboard.

Customer order records are retained until the merchant implements its chosen retention process. Keep runtime secrets in Sites settings or ignored local environment files; no credentials belong in source control.
