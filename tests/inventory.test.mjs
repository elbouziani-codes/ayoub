import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import { openDatabase, addProduct, reserveOrder, cancelOrder } from './helpers/database.mjs';
import { decrementStockSql, orderPageQueries } from '../lib/server/order-sql.ts';

test('a failed second cart item rolls back the order, all line items, and earlier stock reservations', () => {
  const db = openDatabase();
  addProduct(db, 'first', 5);
  addProduct(db, 'sold-out', 0);
  assert.throws(() => reserveOrder(db, 'failed', 'key-failed', [{ id: 'first', quantity: 1, price: 650 }, { id: 'sold-out', quantity: 1, price: 650 }]), /CHECK/);
  assert.equal(db.prepare('SELECT stock FROM products WHERE id = ?').get('first').stock, 5);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM orders').get().count, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM order_items').get().count, 0);
  db.close();
});

test('a stale quote and an archived product cannot reserve stock', () => {
  const db = openDatabase();
  addProduct(db, 'watch', 3, 790);
  assert.throws(() => reserveOrder(db, 'stale', 'key-stale', [{ id: 'watch', quantity: 1, price: 650 }]), /CHECK/);
  db.prepare('UPDATE products SET archived = 1 WHERE id = ?').run('watch');
  assert.throws(() => reserveOrder(db, 'archived', 'key-archived', [{ id: 'watch', quantity: 1, price: 790 }]), /CHECK/);
  assert.equal(db.prepare('SELECT stock FROM products WHERE id = ?').get('watch').stock, 3);
  db.close();
});

test('idempotency uniqueness prevents duplicate orders and duplicate stock decrements', () => {
  const db = openDatabase();
  addProduct(db, 'watch', 3);
  reserveOrder(db, 'first', 'shared-key', [{ id: 'watch', quantity: 1, price: 650 }]);
  assert.throws(() => reserveOrder(db, 'duplicate', 'shared-key', [{ id: 'watch', quantity: 1, price: 650 }]), /UNIQUE/);
  assert.equal(db.prepare('SELECT stock FROM products WHERE id = ?').get('watch').stock, 2);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM orders').get().count, 1);
  db.close();
});

test('racing cancellation requests restore stock once and archived order history remains intact', () => {
  const db = openDatabase();
  addProduct(db, 'watch', 3);
  reserveOrder(db, 'order', 'key-order', [{ id: 'watch', quantity: 2, price: 650 }]);
  assert.equal(cancelOrder(db, 'order', 'pending'), 1);
  assert.equal(cancelOrder(db, 'order', 'pending'), 0);
  assert.equal(db.prepare('SELECT stock FROM products WHERE id = ?').get('watch').stock, 3);
  db.prepare('UPDATE products SET archived = 1 WHERE id = ?').run('watch');
  assert.equal(db.prepare('SELECT name, price, quantity FROM order_items WHERE order_id = ?').get('order').quantity, 2);
  assert.throws(() => db.prepare('DELETE FROM products WHERE id = ?').run('watch'), /FOREIGN KEY/);
  db.close();
});

test('eight simultaneous database clients cannot oversell three watches', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'ayoub-inventory-'));
  const path = join(directory, 'inventory.sqlite');
  const db = openDatabase(path);
  addProduct(db, 'shared', 3);
  db.close();
  try {
    const results = await Promise.all(Array.from({ length: 8 }, (_, index) => new Promise((resolve, reject) => {
      const worker = new Worker(new URL('./helpers/stock-worker.mjs', import.meta.url), { workerData: { path, id: `order-${index}` } });
      worker.once('message', resolve);
      worker.once('error', reject);
      worker.once('exit', (code) => { if (code !== 0) reject(new Error(`Stock worker exited ${code}`)); });
    })));
    assert.equal(results.filter((result) => result.success).length, 3);
    const check = openDatabase(path, false);
    assert.equal(check.prepare('SELECT stock FROM products WHERE id = ?').get('shared').stock, 0);
    assert.equal(check.prepare('SELECT COUNT(*) AS count FROM orders').get().count, 3);
    check.close();
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('keyset order pagination preserves timestamp ties and hydrates only the requested page', () => {
  const db = openDatabase();
  addProduct(db, 'watch', 10);
  for (const id of ['a', 'b', 'c', 'd', 'e']) reserveOrder(db, id, `key-${id}`, [{ id: 'watch', quantity: 1, price: 650 }]);
  db.prepare('UPDATE orders SET created_at = ?').run('2026-11-06T12:00:00.000Z');
  let position = null;
  const ids = [];
  while (true) {
    const queries = orderPageQueries(position, 2);
    const rows = db.prepare(queries.ordersSql).all(...queries.ordersParams);
    const page = rows.slice(0, 2);
    const items = db.prepare(queries.itemsSql).all(...queries.itemsParams);
    assert.deepEqual(items.map((item) => item.order_id).sort(), page.map((order) => order.id).sort());
    ids.push(...page.map((row) => row.id));
    if (rows.length <= 2) break;
    const last = page.at(-1);
    position = { createdAt: last.created_at, id: last.id };
  }
  assert.deepEqual(ids, ['e', 'd', 'c', 'b', 'a']);
  db.close();
});

test('inventory versions advance even if multiple stock writes share the same millisecond', () => {
  const db = openDatabase();
  addProduct(db, 'watch', 10);
  const now = '2026-11-06T12:00:00.000Z';
  db.prepare('UPDATE products SET updated_at = ? WHERE id = ?').run(now, 'watch');
  db.prepare(decrementStockSql).run(1, now, now, 'watch');
  const first = db.prepare('SELECT updated_at FROM products WHERE id = ?').get('watch').updated_at;
  db.prepare(decrementStockSql).run(1, now, now, 'watch');
  const second = db.prepare('SELECT updated_at FROM products WHERE id = ?').get('watch').updated_at;
  assert.equal(first, '2026-11-06T12:00:00.001Z');
  assert.equal(second, '2026-11-06T12:00:00.002Z');
  db.close();
});
