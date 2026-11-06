import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateTotals, canTransition, canonicalOrderPayload, orderInputSchema, productInputSchema, productPatchSchema, sha256, trackingTokenFor } from '../lib/server/commerce.ts';
import { requireSameOrigin, readJson, handleError, HttpError } from '../lib/server/http.ts';

const product = { id: 'watch-1', price: 650, stock: 5 };
const input = { customer: { name: 'Ayoub Test', phone: '06 12 34 56 78', city: 'Casablanca', address: '10 Rue Test, Apartment 3' },
  items: [{ productId: 'watch-1', quantity: 1 }], idempotencyKey: 'fd02be92-d50e-4d4d-8f48-b0bf150f7a0f' };

test('checkout validates and normalizes Moroccan phone numbers', () => {
  assert.equal(orderInputSchema.parse(input).customer.phone, '0612345678');
  assert.equal(orderInputSchema.parse({ ...input, customer: { ...input.customer, phone: '+212 612 345 678' } }).customer.phone, '+212612345678');
  assert.equal(orderInputSchema.safeParse({ ...input, customer: { ...input.customer, phone: '+1 555 123 4567' } }).success, false);
});

test('server prices and shipping thresholds are authoritative', () => {
  assert.deepEqual(calculateTotals([{ productId: 'watch-1', quantity: 1, price: 1 }], [product]), { subtotal: 650, shipping: 35, total: 685 });
  assert.deepEqual(calculateTotals([{ productId: 'watch-1', quantity: 2 }], [product]), { subtotal: 1300, shipping: 0, total: 1300 });
  assert.deepEqual(calculateTotals([{ productId: 'watch-1', quantity: 1 }], [{ ...product, price: 1000 }]), { subtotal: 1000, shipping: 0, total: 1000 });
  assert.throws(() => calculateTotals([{ productId: 'watch-1', quantity: 6 }], [product]));
  assert.throws(() => calculateTotals([{ productId: 'missing', quantity: 1 }], [product]));
});

test('malicious quantities, duplicate products, and weak idempotency keys are rejected', () => {
  for (const quantity of [-1, 0, 1.5, 11]) assert.equal(orderInputSchema.safeParse({ ...input, items: [{ productId: 'watch-1', quantity }] }).success, false);
  assert.equal(orderInputSchema.safeParse({ ...input, items: [input.items[0], input.items[0]] }).success, false);
  assert.equal(orderInputSchema.safeParse({ ...input, idempotencyKey: 'guessable' }).success, false);
});

test('idempotency fingerprint binds normalized customer details and item quantities', async () => {
  const first = orderInputSchema.parse(input);
  const second = orderInputSchema.parse({ ...input, customer: { ...input.customer, name: '  Ayoub Test ' } });
  assert.equal(canonicalOrderPayload(first), canonicalOrderPayload(second));
  const changed = { ...first, items: [{ productId: 'watch-1', quantity: 2 }] };
  assert.notEqual(await sha256(canonicalOrderPayload(first)), await sha256(canonicalOrderPayload(changed)));
  assert.notEqual(await trackingTokenFor('server-random-id', first.idempotencyKey), await trackingTokenFor('different-order', first.idempotencyKey));
  assert.equal((await trackingTokenFor('server-random-id', first.idempotencyKey)).length, 64);
});

test('order transitions enforce fulfillment sequence and terminal states', () => {
  assert.equal(canTransition('pending', 'confirmed'), true);
  assert.equal(canTransition('confirmed', 'cancelled'), true);
  assert.equal(canTransition('shipped', 'delivered'), true);
  assert.equal(canTransition('pending', 'delivered'), false);
  assert.equal(canTransition('shipped', 'cancelled'), false);
  assert.equal(canTransition('cancelled', 'confirmed'), false);
  assert.equal(canTransition('delivered', 'cancelled'), false);
});

test('mutation origin check rejects external and missing origins', () => {
  assert.doesNotThrow(() => requireSameOrigin(new Request('https://shop.test/api/orders', { headers: { Origin: 'https://shop.test' } })));
  assert.throws(() => requireSameOrigin(new Request('https://shop.test/api/orders', { headers: { Origin: 'https://attacker.test' } })), { status: 403 });
  assert.throws(() => requireSameOrigin(new Request('https://shop.test/api/orders')), { status: 403 });
});

test('JSON reader bounds streaming bodies and does not expose server errors', async () => {
  await assert.rejects(readJson(new Request('https://shop.test/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'x'.repeat(33000) })), { status: 413 });
  const response = handleError(new HttpError(409, 'Stock changed', 'stock_changed'));
  assert.equal(response.status, 409);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { error: 'Stock changed', code: 'stock_changed' });
});

test('product validation rejects executable image formats and remote URLs', () => {
  const minimal = { slug: 'new-watch', name: 'New Watch', subtitle: '', description: 'A very nice premium watch.', price: 800, category: 'Classic',
    color: 'Black', movement: 'Quartz', caseSize: '40 mm', waterResistance: '5 ATM', material: 'Steel', stock: 2, featured: false,
    nameFr: 'Nouvelle montre', nameAr: 'ساعة جديدة', descriptionFr: 'Une très belle montre de qualité.', descriptionAr: 'ساعة جميلة وعالية الجودة.',
    localizedDetails: { fr: { subtitle: '', badge: '', color: 'Noir', movement: 'Quartz', caseSize: '40 mm', waterResistance: '5 ATM', material: 'Acier' },
      ar: { subtitle: '', badge: '', color: 'أسود', movement: 'كوارتز', caseSize: '40 مم', waterResistance: '5 ATM', material: 'فولاذ' } } };
  assert.equal(productInputSchema.safeParse({ ...minimal, images: ['/api/images/1234-abcd.png'] }).success, true);
  assert.equal(productInputSchema.safeParse({ ...minimal, nameFr: '', images: ['/api/images/1234-abcd.png'] }).success, false);
  assert.equal(productInputSchema.safeParse({ ...minimal, subtitle: 'New', images: ['/api/images/1234-abcd.png'] }).success, false);
  for (const image of ['javascript:alert(1)', '/images/payload.svg', 'https://external.test/image.png', '/images/../../secret.png']) {
    assert.equal(productInputSchema.safeParse({ ...minimal, images: [image] }).success, false);
  }
});

test('inventory edits require the current product version and text edits require all three languages', () => {
  assert.equal(productPatchSchema.safeParse({ stock: 5 }).success, false);
  assert.equal(productPatchSchema.safeParse({ stock: 5, updatedAt: '2026-11-06T12:00:00.000Z' }).success, true);
  assert.equal(productPatchSchema.safeParse({ name: 'New Watch' }).success, false);
  assert.equal(productPatchSchema.safeParse({ updatedAt: '2026-11-06T12:00:00.000Z' }).success, false);
});
