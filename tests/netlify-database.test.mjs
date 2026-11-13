import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createPostgresDatabase } from '../lib/server/netlify-database.ts';
import { insertOrderSql, reserveItemSql, decrementStockSql, cancelRestockSql, changeOrderStatusSql } from '../lib/server/order-sql.ts';
import { readAccount, updateAccount } from '../lib/server/admin-account-store.ts';
import { consumeRateLimit } from '../lib/server/rate-limit-store.ts';

async function fixture() {
  const pg = new PGlite();
  await pg.exec(await readFile(new URL('../netlify/database/migrations/0001_storefront.sql', import.meta.url), 'utf8'));
  await pg.exec(await readFile(new URL('../netlify/database/migrations/0002_legal_cms.sql', import.meta.url), 'utf8'));
  const query = async (sql, values) => {
    const result = await pg.query(sql, values);
    return { ...result, rowCount: result.affectedRows ?? result.rows.length };
  };
  const db = createPostgresDatabase({ query, connect: async () => ({ query, release() {} }) });
  return { db, pg };
}

async function addProduct(db, id, stock = 3, price = 650) {
  await db.prepare(`INSERT OR IGNORE INTO products (id,slug,name,description,price,category,color,movement,case_size,water_resistance,material,stock,images,created_at,updated_at)
    VALUES (?,?,?,'Test watch',?,'Classic','Black','Quartz','40 mm','5 ATM','Steel',?,'[]',?,?)`)
    .bind(id, id, id, price, stock, '2026-11-06T10:00:00.000Z', '2026-11-06T10:00:00.000Z').run();
}

function reserveStatements(db, id, items) {
  const now = '2026-11-06T10:00:00.000Z';
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return [db.prepare(insertOrderSql).bind(id, `AY-${id}`, '{}', subtotal, 0, subtotal, `key-${id}`, 'hash', 'tracking', now, now),
    ...items.flatMap((item, index) => [
      db.prepare(reserveItemSql).bind(`${id}-${index}`, id, item.id, item.id, item.price, item.id, item.quantity, item.price, item.quantity, '/watch.webp'),
      db.prepare(decrementStockSql).bind(item.quantity, now, now, item.id),
    ])];
}

test('Postgres baseline contains every D1 table and preserves text and integer data shapes', async () => {
  const { db, pg } = await fixture();
  try {
    const tables = await db.prepare("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name").all();
    assert.deepEqual(tables.results.map(row => row.table_name), ['admin_accounts', 'admin_audit_logs', 'admin_sessions', 'content_assets', 'content_overrides', 'customer_complaints', 'legal_page_versions', 'legal_pages', 'order_items', 'order_policy_acceptances', 'orders', 'products', 'rate_limits', 'return_requests', 'store_settings']);
    await addProduct(db, 'watch');
    const product = await db.prepare('SELECT featured, archived, localized_details, images, created_at FROM products WHERE id = ?').bind('watch').first();
    assert.deepEqual(product, { featured: 0, archived: 0, localized_details: null, images: '[]', created_at: '2026-11-06T10:00:00.000Z' });
  } finally { await pg.close(); }
});

test('a failed later line item rolls back the entire PostgreSQL order and inventory batch', async () => {
  const { db, pg } = await fixture();
  try {
    await addProduct(db, 'available', 3);
    await addProduct(db, 'sold-out', 0);
    await assert.rejects(db.batch(reserveStatements(db, 'failed', [{ id: 'available', quantity: 1, price: 650 }, { id: 'sold-out', quantity: 1, price: 650 }])), /order_items_quantity_positive/);
    assert.equal(await db.prepare('SELECT stock FROM products WHERE id = ?').bind('available').first('stock'), 3);
    assert.equal(Number(await db.prepare('SELECT COUNT(*) AS count FROM orders').first('count')), 0);
    assert.equal(Number(await db.prepare('SELECT COUNT(*) AS count FROM order_items').first('count')), 0);
    await db.batch(reserveStatements(db, 'works', [{ id: 'available', quantity: 2, price: 650 }]));
    await assert.rejects(db.batch(reserveStatements(db, 'oversell', [{ id: 'available', quantity: 2, price: 650 }])), /order_items_quantity_positive/);
    assert.equal(await db.prepare('SELECT stock FROM products WHERE id = ?').bind('available').first('stock'), 1);
    assert.equal(await db.prepare('SELECT updated_at FROM products WHERE id = ?').bind('available').first('updated_at'), '2026-11-06T10:00:00.001Z');
    await assert.rejects(db.batch(reserveStatements(db, 'stale-price', [{ id: 'available', quantity: 1, price: 100 }])), /order_items_quantity_positive/);
  } finally { await pg.close(); }
});

test('cancellation guards restore inventory once and retain referenced product history', async () => {
  const { db, pg } = await fixture();
  try {
    await addProduct(db, 'watch', 3);
    await db.batch(reserveStatements(db, 'order', [{ id: 'watch', quantity: 2, price: 650 }]));
    const cancel = () => db.batch([
      db.prepare(cancelRestockSql).bind('order', '2026-11-06T10:00:00.000Z', '2026-11-06T10:00:00.000Z', 'order', 'order', 'pending'),
      db.prepare(changeOrderStatusSql).bind('cancelled', '2026-11-06T10:00:00.000Z', 'order', 'pending'),
    ]);
    assert.equal((await cancel())[1].meta.changes, 1);
    assert.equal((await cancel())[1].meta.changes, 0);
    assert.equal(await db.prepare('SELECT stock FROM products WHERE id = ?').bind('watch').first('stock'), 3);
    assert.equal(await db.prepare('SELECT updated_at FROM products WHERE id = ?').bind('watch').first('updated_at'), '2026-11-06T10:00:00.002Z');
    await assert.rejects(db.prepare('DELETE FROM products WHERE id = ?').bind('watch').run(), /foreign key constraint/);
  } finally { await pg.close(); }
});

test('SQLite OR IGNORE seeding preserves merchant edits while real constraint failures still fail', async () => {
  const { db, pg } = await fixture();
  try {
    await addProduct(db, 'watch', 7);
    await db.prepare('UPDATE products SET name = ?, stock = ? WHERE id = ?').bind('Merchant name', 2, 'watch').run();
    await addProduct(db, 'watch', 7);
    assert.deepEqual(await db.prepare('SELECT name, stock FROM products WHERE id = ?').bind('watch').first(), { name: 'Merchant name', stock: 2 });
    await assert.rejects(addProduct(db, 'invalid', -1), /products_stock_nonnegative/);
  } finally { await pg.close(); }
});

test('account compare-and-swap revokes sessions only when that transaction changed credentials', async () => {
  const { db, pg } = await fixture();
  const bootstrap = { email: 'admin@example.com', hash: `pbkdf2-sha256$100000$${'a'.repeat(32)}$${'b'.repeat(64)}`, recoveryEmail: 'recovery@example.com' };
  try {
    const previous = await readAccount(db, bootstrap);
    const session = () => db.prepare('INSERT INTO admin_sessions (token_hash, email, credential_version, expires_at) VALUES (?, ?, ?, ?)').bind('token', previous.email, previous.version, 999999999).run();
    await session();
    assert.equal(await updateAccount(db, previous, { email: 'new@example.com', passwordHash: previous.passwordHash }), true);
    assert.equal(Number(await db.prepare('SELECT COUNT(*) AS count FROM admin_sessions').first('count')), 0);
    await session();
    assert.equal(await updateAccount(db, previous, { email: 'stale@example.com', passwordHash: previous.passwordHash }), false);
    assert.equal(Number(await db.prepare('SELECT COUNT(*) AS count FROM admin_sessions').first('count')), 1);
    await assert.rejects(db.prepare('DELETE FROM admin_sessions WHERE changes() > 0').run(), /immediately follow/);
    assert.equal(Number(await db.prepare('SELECT COUNT(*) AS count FROM admin_sessions').first('count')), 1);
  } finally { await pg.close(); }
});

test('rate limit upsert resets expired windows and retains atomic counts', async () => {
  const { db, pg } = await fixture();
  try {
    assert.deepEqual(await consumeRateLimit(db, 'key', 2, 60, 100), { allowed: true, retryAfter: 60 });
    assert.equal((await consumeRateLimit(db, 'key', 2, 60, 101)).allowed, true);
    assert.equal((await consumeRateLimit(db, 'key', 2, 60, 102)).allowed, false);
    assert.deepEqual(await consumeRateLimit(db, 'key', 2, 60, 160), { allowed: true, retryAfter: 60 });
  } finally { await pg.close(); }
});

test('placeholder translation handles repeated numbered parameters and leaves quoted text and comments intact', async () => {
  const { db, pg } = await fixture();
  try {
    assert.deepEqual(await db.prepare("SELECT ?2::text AS second, ?1::text AS first, ?2::text AS repeated, '?'::text AS literal, $$?3$$::text AS dollar -- ?4\n/* ?5 */").bind('one', 'two').first(),
      { second: 'two', first: 'one', repeated: 'two', literal: '?', dollar: '?3' });
    assert.equal(await db.prepare("SELECT 'l''été ?'::text AS text, ?::text AS value").bind('safe').first('text'), "l'été ?");
    await assert.rejects(db.prepare('SELECT ?::text').all(), /expected 1 parameters/);
    assert.throws(() => db.prepare('SELECT 1; DELETE FROM products'), /exactly one/);
  } finally { await pg.close(); }
});

test('serialization and deadlock errors retry the complete transaction on a fresh connection', async () => {
  const calls = [];
  let connections = 0;
  const pool = {
    async query() { throw new Error('Batches must use a leased connection'); },
    async connect() {
      const attempt = ++connections;
      return {
        async query(sql) {
          calls.push([attempt, sql]);
          if (sql.startsWith('UPDATE') && attempt < 3) throw Object.assign(new Error('retry'), { code: attempt === 1 ? '40001' : '40P01' });
          return { rows: [], rowCount: sql.startsWith('UPDATE') ? 1 : 0 };
        },
        release() { calls.push([attempt, 'release']); },
      };
    },
  };
  const db = createPostgresDatabase(pool);
  const results = await db.batch([db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').bind(1, 'watch')]);
  assert.equal(results[0].meta.changes, 1);
  assert.equal(connections, 3);
  for (let attempt = 1; attempt <= 3; attempt++) {
    assert.equal(calls.find(([number]) => number === attempt)[1], 'BEGIN ISOLATION LEVEL SERIALIZABLE');
    assert.ok(calls.some(([number, sql]) => number === attempt && sql === (attempt < 3 ? 'ROLLBACK' : 'COMMIT')));
    assert.ok(calls.some(([number, sql]) => number === attempt && sql === 'release'));
  }
});

test('retries are bounded and constraint errors never repeat a failed transaction', async () => {
  for (const [code, attempts] of [['40001', 5], ['23514', 1]]) {
    let connections = 0;
    let releases = 0;
    const db = createPostgresDatabase({ query: async () => ({ rows: [] }), connect: async () => {
      connections++;
      return { query: async (sql) => {
        if (sql.startsWith('UPDATE')) throw Object.assign(new Error('failed'), { code });
        return { rows: [] };
      }, release() { releases++; } };
    } });
    await assert.rejects(db.batch([db.prepare('UPDATE products SET stock = stock - 1')]), /failed/);
    assert.equal(connections, attempts);
    assert.equal(releases, attempts);
  }
});
