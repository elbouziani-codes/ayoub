/** These statements run together in a D1 batch (one SQLite transaction). */
export const insertOrderSql = `INSERT INTO orders
  (id, number, customer, subtotal, shipping, total, status, idempotency_key, request_hash, tracking_hash, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`;

/** quantity=0 deliberately violates the database CHECK and rolls back every write. */
export const reserveItemSql = `INSERT INTO order_items (id, order_id, product_id, name, price, quantity, image)
  VALUES (?, ?, ?, ?, ?, CASE WHEN EXISTS (SELECT 1 FROM products
    WHERE id = ? AND archived = 0 AND stock >= ? AND price = ?) THEN ? ELSE 0 END, ?)`;

export const decrementStockSql = `UPDATE products SET stock = stock - ?,
  updated_at = CASE WHEN updated_at >= ? THEN strftime('%Y-%m-%dT%H:%M:%fZ', updated_at, '+0.001 seconds') ELSE ? END WHERE id = ?`;

/** Conditional inside the transaction so an outdated cancellation cannot restock twice. */
export const cancelRestockSql = `UPDATE products SET stock = stock +
  (SELECT SUM(quantity) FROM order_items WHERE order_id = ? AND product_id = products.id),
  updated_at = CASE WHEN updated_at >= ? THEN strftime('%Y-%m-%dT%H:%M:%fZ', updated_at, '+0.001 seconds') ELSE ? END
  WHERE id IN (SELECT product_id FROM order_items WHERE order_id = ?)
  AND EXISTS (SELECT 1 FROM orders WHERE id = ? AND status = ?)`;

export const changeOrderStatusSql = "UPDATE orders SET status = ?, updated_at = ? WHERE id = ? AND status = ?";

export function orderPageQueries(position: { createdAt: string; id: string } | null, limit: number) {
  const where = position ? "WHERE created_at < ? OR (created_at = ? AND id < ?)" : "";
  const params = position ? [position.createdAt, position.createdAt, position.id] : [];
  return {
    ordersSql: `SELECT * FROM orders ${where} ORDER BY created_at DESC, id DESC LIMIT ?`,
    ordersParams: [...params, limit + 1],
    itemsSql: `SELECT order_id, product_id, name, price, quantity, image FROM order_items
      WHERE order_id IN (SELECT id FROM orders ${where} ORDER BY created_at DESC, id DESC LIMIT ?)`,
    itemsParams: [...params, limit],
  };
}
