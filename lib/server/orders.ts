import type { z } from "zod";
import type { Order, OrderItem, OrderStatus, TrackedOrder } from "../types";
import { getDatabase } from "./db";
import { getProductsByIds } from "./catalog";
import { calculateTotals, canTransition, canonicalOrderPayload, orderInputSchema, sha256, trackingTokenFor } from "./commerce";
import { HttpError } from "./http";
import { cancelRestockSql, changeOrderStatusSql, decrementStockSql, insertOrderSql, orderPageQueries, reserveItemSql } from "./order-sql";

type OrderRow = { id: string; number: string; customer: string; subtotal: number; shipping: number; total: number;
  status: OrderStatus; idempotency_key: string; request_hash: string; tracking_hash: string; created_at: string; updated_at: string };
type ItemRow = { product_id: string; name: string; price: number; quantity: number; image: string };

function mapItems(rows: ItemRow[]): OrderItem[] {
  return rows.map((item) => ({ productId: item.product_id, name: item.name, price: item.price, quantity: item.quantity, image: item.image }));
}
function mapOrder(row: OrderRow, items: OrderItem[]): Order {
  return { id: row.id, number: row.number, customer: JSON.parse(row.customer), items, subtotal: row.subtotal,
    shipping: row.shipping, total: row.total, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at };
}
async function hydrateOrder(row: OrderRow): Promise<Order> {
  const items = await getDatabase().prepare("SELECT product_id, name, price, quantity, image FROM order_items WHERE order_id = ? ORDER BY id").bind(row.id).all<ItemRow>();
  return mapOrder(row, mapItems(items.results));
}
async function findByKey(key: string): Promise<OrderRow | null> {
  return getDatabase().prepare("SELECT * FROM orders WHERE idempotency_key = ?").bind(key).first<OrderRow>();
}
async function replay(row: OrderRow, requestHash: string) {
  if (row.request_hash !== requestHash) throw new HttpError(409, "This checkout reference was already used. Please start a new checkout.", "idempotency_conflict");
  return { order: await hydrateOrder(row), trackingToken: await trackingTokenFor(row.id, row.idempotency_key), replayed: true };
}

export async function createOrder(input: z.infer<typeof orderInputSchema>) {
  const db = getDatabase();
  const requestHash = await sha256(canonicalOrderPayload(input));
  const existing = await findByKey(input.idempotencyKey);
  if (existing) return replay(existing, requestHash);
  const products = await getProductsByIds(input.items.map((item) => item.productId));
  let totals: ReturnType<typeof calculateTotals>;
  try { totals = calculateTotals(input.items, products); }
  catch { throw new HttpError(409, "A watch in your bag is no longer available in that quantity. Please refresh your bag.", "stock_changed"); }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const number = `AY-${now.slice(2, 4)}${crypto.randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase()}`;
  const trackingToken = await trackingTokenFor(id, input.idempotencyKey);
  const statements: D1PreparedStatement[] = [db.prepare(insertOrderSql).bind(id, number, JSON.stringify(input.customer), totals.subtotal,
      totals.shipping, totals.total, input.idempotencyKey, requestHash, await sha256(trackingToken), now, now)];
  for (const item of input.items) {
    const product = products.find((p) => p.id === item.productId)!;
    // A failed CHECK aborts and rolls back the ENTIRE D1 batch. Each guard executes
    // inside the same transaction as its stock decrement, preventing overselling.
    // Matching the quoted price also protects against a concurrent catalog edit.
    statements.push(db.prepare(reserveItemSql)
      .bind(crypto.randomUUID(), id, product.id, product.name, product.price, product.id, item.quantity, product.price,
        item.quantity, product.images[0]));
    statements.push(db.prepare(decrementStockSql)
      .bind(item.quantity, now, now, product.id));
  }
  try { await db.batch(statements); }
  catch (error) {
    // If two copies of a request raced, the unique key rejects the second transaction.
    const concurrent = await findByKey(input.idempotencyKey);
    if (concurrent) return replay(concurrent, requestHash);
    const detail = error instanceof Error ? `${error.message} ${error.cause instanceof Error ? error.cause.message : ""}` : "";
    if (/constraint|check/i.test(detail)) throw new HttpError(409, "Stock or pricing changed during checkout. Please refresh your bag and try again.", "stock_changed");
    throw error;
  }
  const row = await db.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first<OrderRow>();
  if (!row) throw new Error("Committed order unavailable");
  return { order: await hydrateOrder(row), trackingToken, replayed: false };
}

export async function trackOrder(number: string, token: string): Promise<TrackedOrder> {
  const row = await getDatabase().prepare("SELECT * FROM orders WHERE number = ? AND tracking_hash = ?")
    .bind(number.toUpperCase(), await sha256(token)).first<OrderRow>();
  if (!row) throw new HttpError(404, "No order found with these tracking details", "order_not_found");
  const order = await hydrateOrder(row);
  const { customer: _privateCustomer, ...safeOrder } = order;
  return safeOrder;
}

export async function listOrders(cursor?: string, limit = 500): Promise<{ orders: Order[]; nextCursor: string | null }> {
  const db = getDatabase();
  let position: { createdAt: string; id: string } | null = null;
  if (cursor) {
    try {
      if (cursor.length > 300) throw new Error("invalid");
      const parsed = JSON.parse(atob(cursor.replaceAll("-", "+").replaceAll("_", "/")));
      if (typeof parsed.createdAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(parsed.createdAt)
        || typeof parsed.id !== "string" || !/^[a-f0-9-]{36}$/.test(parsed.id)) throw new Error("invalid");
      position = parsed;
    } catch { throw new HttpError(400, "This order page reference is invalid", "invalid_cursor"); }
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new HttpError(400, "Choose a page size between 1 and 500", "invalid_limit");
  const queries = orderPageQueries(position, limit);
  // Both queries share one snapshot, so a newly placed order between them cannot
  // push the last order's line items off the page.
  const results = await db.batch([
    db.prepare(queries.ordersSql).bind(...queries.ordersParams),
    db.prepare(queries.itemsSql).bind(...queries.itemsParams),
  ]);
  const rows = results[0] as D1Result<OrderRow>;
  const allItems = results[1] as D1Result<ItemRow & { order_id: string }>;
  const pageRows = rows.results.slice(0, limit);
  if (!pageRows.length) return { orders: [], nextCursor: null };
  const last = pageRows[pageRows.length - 1];
  const nextCursor = rows.results.length > limit ? btoa(JSON.stringify({ createdAt: last.created_at, id: last.id }))
    .replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "") : null;
  return { orders: pageRows.map((row) => mapOrder(row, mapItems(allItems.results.filter((item) => item.order_id === row.id)))), nextCursor };
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<Order> {
  const db = getDatabase();
  const current = await db.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first<OrderRow>();
  if (!current) throw new HttpError(404, "Order not found", "order_not_found");
  if (!canTransition(current.status, status)) throw new HttpError(409, "This order status change is not allowed", "invalid_transition");
  if (current.status === status) return hydrateOrder(current);
  const now = new Date().toISOString();
  const statements: D1PreparedStatement[] = [];
  if (status === "cancelled") {
    // Check the old status inside the transaction. A repeated or competing
    // cancellation cannot restore inventory twice.
    statements.push(db.prepare(cancelRestockSql)
      .bind(id, now, now, id, id, current.status));
  }
  statements.push(db.prepare(changeOrderStatusSql)
    .bind(status, now, id, current.status));
  const result = await db.batch(statements);
  if (!result[result.length - 1].meta.changes) throw new HttpError(409, "Order changed. Refresh and try again.", "order_changed");
  const row = await db.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first<OrderRow>();
  return hydrateOrder(row!);
}
