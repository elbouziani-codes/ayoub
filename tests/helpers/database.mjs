import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import { insertOrderSql, reserveItemSql, decrementStockSql, cancelRestockSql, changeOrderStatusSql } from '../../lib/server/order-sql.ts';

export function openDatabase(path = ':memory:', migrate = true) {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 10000;');
  if (migrate) {
    const directory = new URL('../../drizzle/', import.meta.url);
    const migrations = readdirSync(directory).filter((name) => name.endsWith('.sql')).sort();
    if (!migrations.length) throw new Error('Generate the D1 schema migration with npm run db:generate first.');
    for (const migration of migrations) db.exec(readFileSync(new URL(migration, directory), 'utf8'));
  }
  return db;
}

export function addProduct(db, id, stock, price = 650) {
  db.prepare(`INSERT INTO products (id,slug,name,description,price,category,color,movement,case_size,water_resistance,material,stock,images,created_at,updated_at)
    VALUES (?,?,?,'A beautiful test watch',?,'Classic','Black','Quartz','40 mm','5 ATM','Steel',?,'["/images/watch-hero.png"]','2026-11-06','2026-11-06')`)
    .run(id, id, id, price, stock);
}

/** Uses the production SQL statements with the same bind ordering as createOrder. */
export function reserveOrder(db, id, key, items) {
  const now = new Date().toISOString();
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shipping = subtotal >= 1000 ? 0 : 35;
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(insertOrderSql).run(id, `AY-${id}`, '{}', subtotal, shipping, subtotal + shipping, key, 'hash', 'tokenhash', now, now);
    for (const [index, item] of items.entries()) {
      db.prepare(reserveItemSql).run(`${id}-item-${index}`, id, item.id, item.id, item.price, item.id, item.quantity, item.price, item.quantity, '/images/watch-hero.png');
      db.prepare(decrementStockSql).run(item.quantity, now, now, item.id);
    }
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

export function cancelOrder(db, id, expectedStatus = 'pending') {
  const now = new Date().toISOString();
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(cancelRestockSql).run(id, now, now, id, id, expectedStatus);
    const changed = db.prepare(changeOrderStatusSql).run('cancelled', now, id, expectedStatus).changes;
    db.exec('COMMIT');
    return changed;
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}
