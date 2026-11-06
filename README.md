# Ayoub Shop

A working multilingual watch store for Morocco. The application includes a responsive dark storefront, searchable and filterable catalog, product pages, saved watches, a persistent shopping bag, cash-on-delivery checkout, private order tracking, and protected administration.

## Run locally

Requires Node.js 24 (the test suite uses built-in TypeScript stripping and SQLite), npm, and a local port.

```sh
npm run install:ci
npm run build
```

Apply each migration **once**, in filename order, to a fresh local database (existing databases need only pending migrations):

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_huge_captain_marvel.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_pale_pandemic.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0002_skinny_queen_noir.sql
```

Create an ignored `.dev.vars`. Legacy gateway-only development can use:

```text
ADMIN_EMAILS="seedy@sites.test"
```

```sh
npm run dev -- --port 5173
```

Open the URL printed by the server. Administration starts at `/admin/login`; `/admin` redirects there unless authorized. The portable gateway simulation signs in as `seedy@sites.test` and is excluded from production. Development and production databases and image storage are separate.

For password administration, configure `ADMIN_LOGIN_EMAIL` and `ADMIN_PASSWORD_HASH` in the ignored `.dev.vars` locally and as secret runtime values in Sites for hosting. `ADMIN_PASSWORD_HASH` uses `pbkdf2-sha256$100000$<32-character salt hex>$<64-character digest hex>`; generate it with `hashPassword()` in `lib/server/admin-credentials.ts`, never use a plaintext password as the hash. A random strong password and the owner's email are provisioned for this deployment; the private local handoff is `outputs/admin-login.txt` (excluded from Git and deployment). No credential is embedded in application source.

When either password setting is present, password authorization takes precedence over the legacy gateway allowlist. Missing or malformed settings fail closed. With both settings absent, the original Sites sign-in plus `ADMIN_EMAILS` allowlist remains available. The private hosting gate still applies to the entire Site.

## Architecture

- **UI:** React 19, TypeScript, Vinext/Next-compatible App Router, Lucide icons, responsive liquid glass surfaces, pointer lighting, reveal transitions, and keyboard-accessible dialogs with inert backgrounds.
- **3D atelier:** A procedural Three.js watch design study with three finishes, dial/profile/caseback views, drag, zoom, reset, and keyboard controls. It is clearly distinguished from actual catalog products. The renderer loads near the viewport, caps pixel ratio and frame rate, pauses offscreen or in hidden tabs, disposes resources, and falls back to a product image when WebGL is unavailable. System reduced-motion preferences and a persistent global motion switch stop animation while keeping manual inspection available.
- **Backend:** Cloudflare Workers with server-side API authorization and Zod validation.
- **Records:** Cloudflare D1, schema in `db/schema.ts`, generated SQL in `drizzle/`.
- **Uploads:** Cloudflare R2; up to eight PNG/JPEG/WebP images per product, each at most 5 MiB. The admin browser decodes photos, preserves their aspect ratio, caps the longest edge at 1600 px, and encodes WebP at quality 0.85. A smaller original is retained only when it already meets the dimension limit. Browsers without WebP encoding use a resized PNG fallback; when image encoding is unavailable, only an original already within the dimension and size limits can be uploaded. Filenames are preserved and server-side MIME/signature checks and the 5 MiB limit still apply. SVG and remote image URLs are rejected. Gallery images can be reordered or removed without breaking historical order snapshots. Existing uploads are unchanged.
- **Authentication:** Explicitly provisioned email/password administrator with PBKDF2-SHA256, a random salt, and opaque 256-bit sessions. D1 stores only session-token hashes with an eight-hour expiry and a credential-version binding. Cookies are HttpOnly, SameSite=Strict and Secure with a `__Host-` name on HTTPS. Logout revokes the database session and clears both cookie variants; a new login rotates its prior session. Changing the login email or password invalidates all existing password sessions. Mutable account credentials are stored in D1; secret runtime values bootstrap the account and can deliberately override it when changed. Sites retains its private audience boundary; legacy `ADMIN_EMAILS` gateway authorization is available only when password mode is unconfigured. No public registration, default production password or first-user ownership claim exists.
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
ADMIN_TEST_EMAIL="your-configured-email" ADMIN_TEST_PASSWORD="your-local-test-password" npm run test:integration -- http://127.0.0.1:5173
node tests/seo.test.mjs http://127.0.0.1:5173
npm run build
```

The 36 unit/SQLite tests cover account bootstrap persistence and explicit override, immutable recovery ownership, optimistic concurrent credential updates, atomic session revocation and rollback, corrupt-account rejection, and password derivation, session expiry, revocation, rotation, credential changes, limiter privacy, twelve concurrent login clients sharing five permits, and Moroccan phone validation, shipping, input bounds, idempotency, CSRF checks, transaction rollback, stale catalog/price checks, exactly-once restocking, optimistic stock editing and eight concurrent buyers competing for three units.

The 17 live local integration checks in password mode exercise real credential cookies, gateway-bypass rejection, login/logout CSRF protection, logout replay rejection, the sixth-attempt lockout with Retry-After, D1, R2 uploads and retrieval, ETags, product CRUD and image ordering, stale-version rejection, checkout, replay conflicts, privacy-safe tracking, order transitions, cancellation, pagination and archival. Password credentials come only from `ADMIN_TEST_EMAIL` and `ADMIN_TEST_PASSWORD`; legacy gateway-only mode retains 13 checks. A complete password-mode run deliberately exhausts its local login window, so wait 15 minutes before rerunning or clear only local test rate-limit records. The script refuses non-loopback URLs. It creates clearly marked local fixtures, archives its product, and retains local test orders for auditing.

Browser QA also covered a real local checkout and receipt, private tracking, admin sign-in and cancellation, Arabic RTL, and a 390-pixel mobile viewport. Test data never needs to be copied to the hosted database.

The nine read-only rendered SEO checks verify server-rendered content, canonical uniqueness, live offers, French/Arabic metadata, policy pages, missing-page noindex, crawl rules, and sitemap dates. A private hosting gate prevents public search indexing regardless of the application metadata. Lighthouse and real-user Core Web Vitals must be measured on the deployed public store before claiming a numeric performance or SEO score.

## Hosting and merchant settings

`.openai/hosting.json` identifies the private Sites deployment and declares D1 `DB` and R2 `BUCKET`. Publish with the Sites workflow so migrations apply before the Worker is uploaded. Never edit already-applied migrations; generate a new migration for future schema changes.

Production password administration is provisioned through the Sites runtime secrets `ADMIN_LOGIN_EMAIL` and `ADMIN_PASSWORD_HASH`. Open `/admin/login` and use the provisioned credentials. The first password-mode request provisions the singleton account in D1. Subsequent logins preserve changes saved through the dashboard; they do not reseed the original password or email. A deliberate change to the bootstrap secrets followed by redeployment overrides saved credentials and revokes previous sessions.

In **Administration → Account**, change the login email, password, or both. The current password is always required. New passwords must contain 12–256 characters and match their confirmation. Changes commit atomically and sign out all devices, including the current session. Requests use optimistic comparison so a stale request cannot overwrite a newer change or revoke its newly issued session. The login page confirms a successful update after redirect.

**Forgot password** opens `/admin/reset-password`. Recovery requires the verified Sites/ChatGPT identity of the original owner. `ADMIN_RECOVERY_EMAIL` may explicitly configure that identity; otherwise the bootstrap `ADMIN_LOGIN_EMAIL` is used. Editing the login email in the dashboard does not change recovery ownership or Sites audience permissions. The reset flow preserves the current login email, requires matching 12–256-character passwords, revokes all administrator sessions and returns to password sign-in. No email delivery service is configured, and the interface does not claim to send reset email. Gateway identities from other accounts and password sessions alone cannot authorize recovery.

For emergency runtime rotation, generate a new salted hash with `hashPassword()`, replace `ADMIN_PASSWORD_HASH` through Sites runtime settings, and redeploy; the next account request applies the override. The local credentials handoff file contains the originally provisioned values and does not automatically change after edits in the dashboard. The legacy `ADMIN_EMAILS` value is preserved for gateway-only configurations and has no authority while password mode is configured. Runtime changes take effect after deployment.

Login allows 5 attempts per trusted client IP per 15-minute window, plus 20 attempts per normalized email per 15 minutes across addresses. Windows start with the first attempt, and atomic D1 counters are shared by all Workers. The address limit is charged before body parsing or password derivation. Rejected attempts return HTTP 429, a `Retry-After` header and `retryAfter` JSON; the login page displays a countdown. Counters contain only hashed IP/email identifiers, and expired entries are cleaned in bounded batches. Account updates have separate IP and recovery-owner limits of 10 attempts per 15 minutes. Recovery allows 5 attempts per IP and verified owner per 15 minutes. Account and recovery mutations enforce same-origin requests. Checkout (12/hour) and tracking retain their separate limits.

The application must run behind the trusted Sites authentication gateway, which owns identity headers. Do not expose the raw Worker as an independent public origin. Mutation requests require a same-origin `Origin` header; the local integration tests verify this boundary.

Public WhatsApp support is configured as `+212 789 948 216`. Opening a support link prepares a conversation; the site does not send messages automatically.

The initial eight watches, prices, specifications, compare-at prices, promotional badges and stock are sample merchant-editable catalog data. Images are generated studio renders. Before accepting real customer orders, replace these with your actual inventory and photos and confirm the displayed delivery charges and store policies. The current Site is private for owner review; public access is a separate hosting audience setting. This app stores orders and supports manual fulfillment; it does not automatically dispatch a courier or send SMS/email notifications. Administrators update status in the dashboard.

Customer order records are retained until the merchant implements its chosen retention process. Keep runtime secrets in Sites settings or ignored local environment files; no credentials belong in source control.

### Account lifecycle checks

`node tests/account-integration.mjs http://127.0.0.1:5173` uses `ADMIN_TEST_EMAIL` and `ADMIN_TEST_PASSWORD`, runs seven checks with five login attempts, temporarily edits only the local administrator account, and restores its original email/password. It verifies anonymous rejection, current-password and CSRF checks, wrong recovery-owner rejection, durable changes, old-password rejection and session invalidation. Use a fresh local rate-limit window for each suite.

`node tests/recovery-integration.mjs http://127.0.0.1:5173` additionally tests successful recovery using the real portable gateway cookie. For this local fixture only, set `ADMIN_RECOVERY_EMAIL="seedy@sites.test"`, restart development, and use the original bootstrap test credentials. It checks that a password session alone cannot reset access, weak/mismatched passwords preserve access, successful recovery revokes old sessions and preserves the email, and the original password is restored. Restore the normal local recovery setting afterwards; these fixture settings must never be copied into hosting secrets. Both scripts reject non-loopback targets.
