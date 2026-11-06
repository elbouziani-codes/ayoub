/**
 * End-to-end API smoke checks against LOCAL development only.
 * Run a local Vite server with a configured password administrator, then:
 *   ADMIN_TEST_EMAIL=... ADMIN_TEST_PASSWORD=... node tests/integration.mjs http://127.0.0.1:5173
 * The legacy gateway-only configuration uses ADMIN_EMAILS=seedy@sites.test:
 *   node tests/integration.mjs http://127.0.0.1:5173
 * Uses the actual local sign-in cookie, D1 and R2 bindings; no fabricated identity
 * headers. Fixtures are clearly labelled and products are archived on completion.
 */
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const base = new URL(process.argv[2] || "http://127.0.0.1:5173");
if (base.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(base.hostname) || base.username || base.password || base.pathname !== "/" || base.search || base.hash) {
  throw new Error("Refusing mutations: integration checks only support a local HTTP development server.");
}
const origin = base.origin;
const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;
const slug = `local-integration-${suffix}`;
let cookie = "";
let createdProduct;
let archived = false;
let passed = 0;
let passwordMode = false;
let loginAttempts = 0;
let loginCredentials;
const fixtures = new Map();

async function check(name, fn) {
  await fn();
  passed += 1;
  console.log(`✓ ${name}`);
}

async function request(path, { method = "GET", data, body, authenticated = false, expected = 200, headers = {}, includeOrigin = true } = {}) {
  const requestHeaders = new Headers(headers);
  if (includeOrigin && method !== "GET" && method !== "HEAD" && !requestHeaders.has("Origin")) requestHeaders.set("Origin", origin);
  if (authenticated) {
    assert.ok(cookie, "Sign in through the local authentication route first");
    requestHeaders.set("Cookie", cookie);
  }
  if (data !== undefined) requestHeaders.set("Content-Type", "application/json");
  const response = await fetch(new URL(path, base), {
    method, headers: requestHeaders, body: data !== undefined ? JSON.stringify(data) : body,
    redirect: "manual", signal: AbortSignal.timeout(30000),
  });
  const contentType = response.headers.get("Content-Type") || "";
  const result = contentType.includes("application/json") ? await response.json() : await response.text();
  assert.equal(response.status, expected, `${method} ${path.split("?")[0]}: expected ${expected}, received ${response.status}${result?.error ? ` (${result.error})` : ""}`);
  return { response, data: result };
}

function responseCookie(response) {
  const setCookies = response.headers.getSetCookie();
  assert.ok(setCookies.length, "Sign-in should set a session cookie");
  return { setCookies, cookie: setCookies.map(value => value.split(";")[0]).join("; ") };
}

async function gatewaySignIn() {
  const { response } = await request("/signin-with-chatgpt?return_to=%2Fadmin", {
    expected: 302, headers: { "Sec-Fetch-Mode": "navigate", "Sec-Fetch-Dest": "document" },
  });
  assert.equal(response.headers.get("Location"), "/admin");
  return responseCookie(response);
}

async function passwordSignIn(data = loginCredentials, expected = 200) {
  loginAttempts += 1;
  return request("/api/admin/login", { method: "POST", data, expected });
}

async function product() {
  const { data } = await request(`/api/products/${slug}`);
  return data.product;
}

async function status(orderId, next, expected = 200) {
  const result = await request(`/api/admin/orders/${orderId}`, { method: "PATCH", authenticated: true, data: { status: next }, expected });
  if (expected === 200) {
    assert.equal(result.data.order.status, next);
    fixtures.set(orderId, next);
  }
  return result.data.order;
}

function checkoutInput(label, quantity = 1) {
  return {
    idempotencyKey: randomUUID(),
    customer: {
      name: `Local integration ${label}`, phone: "0600000000", city: "Casablanca",
      address: "Local integration only, no delivery, 1 Test Street",
      email: "local-integration@example.invalid", notes: "LOCAL DEVELOPMENT TEST — do not fulfill.",
    },
    items: [{ productId: createdProduct.id, quantity, price: 1 }],
    subtotal: 1, shipping: 0, total: 1,
  };
}

try {
  console.log(`Ayoub Shop local integration checks: ${origin}`);

  await check("Anonymous sessions cannot read or mutate administrator data", async () => {
    const { data } = await request("/api/admin/session");
    assert.equal(data.authenticated, false);
    assert.equal(data.isAdmin, false);
    assert.equal(data.user, null);
    passwordMode = data.passwordLoginAvailable === true;
    await request("/api/admin/products", { expected: 401 });
    await request("/api/admin/orders", { expected: 401 });
    await request("/api/admin/products", { method: "POST", data: {}, expected: 401 });
  });

  if (passwordMode) {
    const email = process.env.ADMIN_TEST_EMAIL;
    const password = process.env.ADMIN_TEST_PASSWORD;
    assert.ok(email && password, "Set ADMIN_TEST_EMAIL and ADMIN_TEST_PASSWORD for the local password administrator");
    loginCredentials = { email: email.trim().toLowerCase(), password };

    await check("A gateway sign-in cannot bypass the configured administrator password", async () => {
      const gateway = await gatewaySignIn();
      const { data } = await request("/api/admin/session", { headers: { Cookie: gateway.cookie } });
      assert.equal(data.authenticated, false);
      assert.equal(data.isAdmin, false);
      await request("/api/admin/products", { headers: { Cookie: gateway.cookie }, expected: 401 });
    });

    await check("Password sign-in normalizes email and sets a private eight-hour session cookie", async () => {
      const { response, data } = await passwordSignIn({ ...loginCredentials, email: `  ${email.toUpperCase()}  ` });
      const signedIn = responseCookie(response);
      assert.ok(signedIn.setCookies.every(value => /HttpOnly/i.test(value) && /SameSite=Strict/i.test(value)
        && /(?:^|;)\s*Path=\//i.test(value) && /Max-Age=28800/i.test(value) && !/(?:^|;)\s*Secure(?:;|$)/i.test(value)
        && !/(?:^|;)\s*Domain=/i.test(value)));
      cookie = signedIn.cookie;
      assert.equal(data.authenticated, true);
      assert.equal(data.isAdmin, true);
      assert.equal(data.authMethod, "password");
      assert.equal(data.user.email, loginCredentials.email);
      assert.ok(!JSON.stringify(data).includes(cookie.split("=")[1]), "The bearer token belongs only in the HttpOnly cookie");
      const session = await request("/api/admin/session", { authenticated: true });
      assert.equal(session.data.isAdmin, true);
    });

    await check("Login and logout reject missing or cross-site origins without revoking the active session", async () => {
      for (const path of ["/api/admin/login", "/api/admin/logout"]) {
        const options = { method: "POST", authenticated: true, data: loginCredentials, expected: 403 };
        await request(path, { ...options, includeOrigin: false });
        await request(path, { ...options, headers: { Origin: "https://external.invalid" } });
        await request(path, { ...options, headers: { "Sec-Fetch-Site": "cross-site" } });
      }
      assert.equal((await request("/api/admin/session", { authenticated: true })).data.isAdmin, true);
    });

    await check("Incorrect credentials are generic, and logout revokes the original session before a fresh login", async () => {
      const wrongPassword = password === "invalid-local-password" ? "another-invalid-password" : "invalid-local-password";
      const invalid = await passwordSignIn({ email: loginCredentials.email, password: wrongPassword }, 401);
      assert.deepEqual(invalid.data, { error: "Invalid email or password.", code: "invalid_credentials" });
      assert.equal(invalid.response.headers.get("Set-Cookie"), null);
      const originalCookie = cookie;
      const logout = await request("/api/admin/logout", { method: "POST", authenticated: true });
      assert.ok(logout.response.headers.getSetCookie().some(value => /Max-Age=0(?:;|$)/i.test(value)));
      const revoked = await request("/api/admin/session", { headers: { Cookie: originalCookie } });
      assert.equal(revoked.data.authenticated, false);
      await request("/api/admin/products", { headers: { Cookie: originalCookie }, expected: 401 });
      const fresh = await passwordSignIn();
      cookie = responseCookie(fresh.response).cookie;
      assert.notEqual(cookie, originalCookie);
      assert.equal((await request("/api/admin/session", { authenticated: true })).data.isAdmin, true);
    });
  } else {
    await check("Local gateway sign-in establishes an HttpOnly cookie and an allowlisted session", async () => {
      const signedIn = await gatewaySignIn();
      assert.ok(signedIn.setCookies.every(value => /HttpOnly/i.test(value) && /SameSite=Lax/i.test(value)));
      cookie = signedIn.cookie;
      const { data } = await request("/api/admin/session", { authenticated: true });
      assert.equal(data.authenticated, true);
      assert.equal(data.isAdmin, true, "Set ADMIN_EMAILS=seedy@sites.test in local .env");
      assert.equal(data.user.email, "seedy@sites.test");
    });
  }
  const catalog = await request("/api/admin/products", { authenticated: true });
  assert.ok(Array.isArray(catalog.data.products));

  await check("Content editing requires all three languages and appears in the selected visitor language", async () => {
    await request("/api/admin/content", { expected: 401 });
    await request("/api/admin/content", { method: "PUT", data: { key: "freeTop", en: "One", fr: "Un", ar: "واحد" }, expected: 401 });
    const content = await request("/api/admin/content", { authenticated: true });
    const previous = content.data.overrides.freeTop || {
      en: content.data.defaults.en.freeTop, fr: content.data.defaults.fr.freeTop, ar: content.data.defaults.ar.freeTop,
    };
    await request("/api/admin/content", { method: "PUT", authenticated: true, data: { key: "freeTop", en: "Local English test", fr: "Test français local", ar: "اختبار عربي محلي" }, expected: 200 });
    await request("/api/admin/content", { method: "PUT", authenticated: true, data: { key: "freeTop", en: "Incomplete", fr: "", ar: "ناقص" }, expected: 400 });
    await request("/api/admin/content", { method: "PUT", authenticated: true, data: { key: "freeTop", en: "Only English changed", fr: "Test français local", ar: "اختبار عربي محلي" }, expected: 400 });
    await request("/api/admin/content", { method: "PUT", authenticated: true, data: { key: "not_a_real_key", en: "One", fr: "Un", ar: "واحد" }, expected: 400 });
    const french = await request("/");
    assert.match(french.data, /<html[^>]*lang="fr"/);
    assert.ok(french.data.includes("Test français local"));
    const arabic = await request("/", { headers: { Cookie: "ayoub-language=ar" } });
    assert.ok(arabic.data.includes("اختبار عربي محلي"));
    const english = await request("/", { headers: { Cookie: "ayoub-language=en" } });
    assert.ok(english.data.includes("Local English test"));
    const beforeImage = content.data.editorialAsset;
    await request("/api/admin/content", { method: "PUT", authenticated: true, data: { type: "image", slot: "editorialImage", image: "/images/watch-silver.webp", en: "Local silver watch", fr: "Montre argentée locale", ar: "ساعة فضية محلية" } });
    const imagePage = await request("/");
    assert.ok(imagePage.data.includes("/images/watch-silver.webp"));
    assert.ok(imagePage.data.includes("Montre argentée locale"));
    await request("/api/admin/content", { method: "PUT", authenticated: true, data: { type: "image", slot: "editorialImage", image: "/images/watch-gold.webp", en: "Local silver watch", fr: "Montre argentée locale", ar: "ساعة فضية محلية" }, expected: 400 });
    await request("/api/admin/content", { method: "PUT", authenticated: true, data: { type: "image", ...beforeImage } });
    await request("/api/admin/content", { method: "PUT", authenticated: true, data: { key: "freeTop", ...previous } });
  });

  let uploadedImage;
  await check("A real PNG uploads to R2 and is served byte-for-byte with immutable caching", async () => {
    const bytes = await readFile(new URL("../public/images/watch-hero.png", import.meta.url));
    assert.ok(bytes.byteLength > 8 && bytes.byteLength <= 5 * 1024 * 1024);
    const form = new FormData();
    form.append("file", new Blob([bytes], { type: "image/png" }), "local-integration.png");
    const { data } = await request("/api/admin/uploads", { method: "POST", body: form, authenticated: true, expected: 201 });
    assert.match(data.url, /^\/api\/images\/[a-f0-9-]+\.png$/);
    uploadedImage = data.url;
    const response = await fetch(new URL(uploadedImage, base), { redirect: "manual", signal: AbortSignal.timeout(30000) });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Content-Type"), "image/png");
    assert.match(response.headers.get("Cache-Control"), /immutable/);
    assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
    const served = Buffer.from(await response.arrayBuffer());
    assert.equal(createHash("sha256").update(served).digest("hex"), createHash("sha256").update(bytes).digest("hex"));
    const cached = await fetch(new URL(uploadedImage, base), { headers: { "If-None-Match": response.headers.get("ETag") }, redirect: "manual" });
    assert.equal(cached.status, 304);
  });

  await check("Product creation persists inventory, translations and uploaded photography", async () => {
    const input = {
      slug, name: "Local integration watch", subtitle: "Development verification only",
      description: "A local integration fixture used to verify the complete product lifecycle.",
      nameFr: "Montre de test local", nameAr: "ساعة للاختبار المحلي",
      descriptionFr: "Produit local de vérification du catalogue.", descriptionAr: "منتج محلي للتحقق من وظائف المتجر.",
      localizedDetails: { fr: { subtitle: "Vérification locale uniquement", badge: "Test local", color: "Noir", movement: "Quartz", caseSize: "40 mm", waterResistance: "3 ATM", material: "Acier inoxydable" }, ar: { subtitle: "للتحقق المحلي فقط", badge: "اختبار محلي", color: "أسود", movement: "كوارتز", caseSize: "40 مم", waterResistance: "3 ATM", material: "فولاذ مقاوم للصدأ" } },
      price: 680, compareAt: 990, category: "Classic", color: "Black", movement: "Quartz",
      caseSize: "40 mm", waterResistance: "3 ATM", material: "Stainless steel", stock: 8,
      images: [uploadedImage, "/images/watch-blue.png"], featured: false, badge: "Local test",
    };
    const { data } = await request("/api/admin/products", { method: "POST", data: input, authenticated: true, expected: 201 });
    createdProduct = data.product;
    assert.ok(createdProduct.id);
    assert.equal(createdProduct.slug, slug);
    assert.equal(createdProduct.stock, 8);
    const publicProduct = await product();
    assert.equal(publicProduct.nameAr, input.nameAr);
    assert.deepEqual(publicProduct.images, input.images);
  });

  await check("Product edits update price, stock and image order; invalid or cross-origin writes fail", async () => {
    const { data } = await request(`/api/admin/products/${createdProduct.id}`, {
      method: "PATCH", authenticated: true,
      data: { price: 725, stock: 10, updatedAt: createdProduct.updatedAt, images: ["/images/watch-blue.png", uploadedImage] },
    });
    assert.equal(data.product.price, 725);
    assert.equal(data.product.stock, 10);
    assert.deepEqual(data.product.images, ["/images/watch-blue.png", uploadedImage]);
    await request(`/api/admin/products/${createdProduct.id}`, { method: "PATCH", authenticated: true, data: { stock: -1 }, expected: 400 });
    await request(`/api/admin/products/${createdProduct.id}`, { method: "PATCH", authenticated: true, data: { price: 1 }, headers: { Origin: "https://external.invalid" }, expected: 403 });
    const current = await product();
    assert.equal(current.price, 725);
    assert.equal(current.stock, 10);
  });

  let staleProductSnapshot;
  let firstOrder;
  let firstInput;
  let firstToken;
  await check("Checkout uses authoritative prices and delivery fees while reserving stock", async () => {
    staleProductSnapshot = await product();
    firstInput = checkoutInput("delivery verification");
    const { data } = await request("/api/orders", { method: "POST", data: firstInput, expected: 201 });
    firstOrder = data.order;
    firstToken = data.trackingToken;
    fixtures.set(firstOrder.id, firstOrder.status);
    assert.equal(firstOrder.status, "pending");
    assert.equal(firstOrder.items[0].price, 725);
    assert.equal(firstOrder.subtotal, 725);
    assert.equal(firstOrder.shipping, 35);
    assert.equal(firstOrder.total, 760);
    assert.match(firstToken, /^[a-f0-9]{64}$/);
    assert.equal((await product()).stock, 9);
  });

  await check("Stale product editors cannot overwrite stock reserved by a checkout", async () => {
    assert.ok(staleProductSnapshot.updatedAt, "Product reads must include an optimistic concurrency token");
    await request(`/api/admin/products/${createdProduct.id}`, { method: "PATCH", authenticated: true, data: { ...staleProductSnapshot, name: "Stale local integration edit" }, expected: 409 });
    assert.equal((await product()).stock, 9);
  });

  await check("Identical checkout replays return one order and token; changed payloads return 409", async () => {
    const { data } = await request("/api/orders", { method: "POST", data: firstInput });
    assert.equal(data.order.id, firstOrder.id);
    assert.equal(data.trackingToken, firstToken);
    assert.equal((await product()).stock, 9);
    await request("/api/orders", { method: "POST", data: { ...firstInput, items: [{ productId: createdProduct.id, quantity: 2 }] }, expected: 409 });
    assert.equal((await product()).stock, 9);
  });

  await check("Tracking needs the private token and never returns customer personal data", async () => {
    const query = new URLSearchParams({ number: firstOrder.number, token: firstToken });
    const { data } = await request(`/api/orders/track?${query}`);
    assert.equal(data.order.id, firstOrder.id);
    assert.equal(data.order.status, "pending");
    assert.ok(!("customer" in data.order));
    const serialized = JSON.stringify(data.order);
    for (const value of Object.values(firstInput.customer)) assert.ok(!serialized.includes(value), "Tracking must omit every personal delivery field");
    await request(`/api/orders/track?${new URLSearchParams({ number: firstOrder.number, token: "0".repeat(64) })}`, { expected: 404 });
    await request(`/api/orders/track?${new URLSearchParams({ number: firstOrder.number })}`, { expected: 404 });
  });

  await check("Orders follow the fulfillment sequence and delivered orders cannot be cancelled", async () => {
    await status(firstOrder.id, "delivered", 409);
    await status(firstOrder.id, "confirmed");
    await status(firstOrder.id, "shipped");
    await status(firstOrder.id, "cancelled", 409);
    await status(firstOrder.id, "delivered");
    await status(firstOrder.id, "cancelled", 409);
    assert.equal((await product()).stock, 9);
  });

  let secondOrder;
  await check("Free delivery applies above the threshold, and cancellation restores stock exactly once", async () => {
    const { data } = await request("/api/orders", { method: "POST", data: checkoutInput("cancellation verification", 2), expected: 201 });
    secondOrder = data.order;
    fixtures.set(secondOrder.id, secondOrder.status);
    assert.equal(secondOrder.subtotal, 1450);
    assert.equal(secondOrder.shipping, 0);
    assert.equal(secondOrder.total, 1450);
    assert.equal((await product()).stock, 7);
    await status(secondOrder.id, "cancelled");
    assert.equal((await product()).stock, 9);
    await status(secondOrder.id, "cancelled");
    assert.equal((await product()).stock, 9);
    await status(secondOrder.id, "confirmed", 409);
  });

  await check("Administrator order pagination advances without omitting or repeating orders", async () => {
    const firstPage = await request("/api/admin/orders?limit=1", { authenticated: true });
    assert.equal(firstPage.data.orders.length, 1);
    assert.equal(typeof firstPage.data.nextCursor, "string");
    const secondPage = await request(`/api/admin/orders?${new URLSearchParams({ limit: "1", cursor: firstPage.data.nextCursor })}`, { authenticated: true });
    assert.equal(secondPage.data.orders.length, 1);
    assert.notEqual(secondPage.data.orders[0].id, firstPage.data.orders[0].id);
  });

  await check("Archived products leave the storefront while original order snapshots remain intact", async () => {
    await request(`/api/admin/products/${createdProduct.id}`, { method: "PATCH", authenticated: true, data: { name: "Local integration updated watch" }, expected: 400 });
    const current = await product();
    await request(`/api/admin/products/${createdProduct.id}`, { method: "PATCH", authenticated: true, data: { ...current, price: 799, name: "Local integration updated watch", nameFr: "Montre locale modifiée", nameAr: "ساعة محلية معدلة" } });
    await request(`/api/admin/products/${createdProduct.id}`, { method: "DELETE", authenticated: true });
    archived = true;
    await request(`/api/products/${slug}`, { expected: 404 });
    const list = await request("/api/admin/products", { authenticated: true });
    assert.ok(!list.data.products.some(item => item.id === createdProduct.id));
    const allOrders = await request("/api/admin/orders", { authenticated: true });
    for (const fixtureOrder of [firstOrder, secondOrder]) {
      const stored = allOrders.data.orders.find(item => item.id === fixtureOrder.id);
      assert.ok(stored);
      assert.equal(stored.customer.name, fixtureOrder.customer.name);
      assert.equal(stored.items[0].name, "Local integration watch");
      assert.equal(stored.items[0].price, 725);
    }
  });

  if (passwordMode) {
    await check("The sixth login attempt is blocked with a usable Retry-After while an existing session remains valid", async () => {
      // Consume the remaining attempts only after all commerce fixtures are archived.
      while (loginAttempts < 5) {
        const invalid = await passwordSignIn({ email: loginCredentials.email, password: "invalid-local-password-attempt" }, 401);
        assert.equal(invalid.data.code, "invalid_credentials");
      }
      const blocked = await passwordSignIn(loginCredentials, 429);
      const retryAfter = Number(blocked.response.headers.get("Retry-After"));
      assert.ok(Number.isInteger(retryAfter) && retryAfter > 0 && retryAfter <= 900);
      assert.equal(blocked.data.code, "rate_limited");
      assert.equal(blocked.data.retryAfter, retryAfter);
      assert.equal(blocked.response.headers.get("Cache-Control"), "no-store");
      assert.equal(blocked.response.headers.get("Set-Cookie"), null);
      assert.equal((await request("/api/admin/session", { authenticated: true })).data.isAdmin, true);
    });
  }

  console.log(`\n${passed} local integration checks passed. The test product is archived; test orders remain labelled Local integration.`);
} catch (error) {
  console.error(`\nIntegration checks failed after ${passed} passed checks.`);
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  // Clean up only fixtures created by this run; preserve order audit history.
  for (const [id, current] of fixtures) {
    if (current !== "pending" && current !== "confirmed") continue;
    try { await status(id, "cancelled"); } catch { console.error("Could not cancel a local test fixture; review Local integration orders."); }
  }
  if (createdProduct && !archived) {
    try { await request(`/api/admin/products/${createdProduct.id}`, { method: "DELETE", authenticated: true }); }
    catch { console.error("Could not archive a local test fixture; review Local integration products."); }
  }
}
