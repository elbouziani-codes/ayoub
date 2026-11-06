import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const products = sqliteTable("products", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  subtitle: text("subtitle").notNull().default(""),
  description: text("description").notNull(),
  nameFr: text("name_fr"), nameAr: text("name_ar"),
  descriptionFr: text("description_fr"), descriptionAr: text("description_ar"),
  price: integer("price").notNull(), compareAt: integer("compare_at"),
  category: text("category").notNull(), color: text("color").notNull(),
  movement: text("movement").notNull(), caseSize: text("case_size").notNull(),
  waterResistance: text("water_resistance").notNull(), material: text("material").notNull(),
  stock: integer("stock").notNull().default(0), images: text("images").notNull(),
  featured: integer("featured", { mode: "boolean" }).notNull().default(false),
  badge: text("badge"), archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(100),
  createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
}, (table) => [
  check("products_stock_nonnegative", sql`${table.stock} >= 0`),
  check("products_price_positive", sql`${table.price} > 0`),
  check("products_category_valid", sql`${table.category} IN ('Classic','Sport','Minimal','Limited')`),
  index("products_visible_sort_idx").on(table.archived, table.sortOrder),
]);

export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(), number: text("number").notNull().unique(), customer: text("customer").notNull(),
  subtotal: integer("subtotal").notNull(), shipping: integer("shipping").notNull(), total: integer("total").notNull(),
  status: text("status").notNull().default("pending"), idempotencyKey: text("idempotency_key").notNull(),
  requestHash: text("request_hash").notNull(), trackingHash: text("tracking_hash").notNull(),
  createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("orders_idempotency_idx").on(table.idempotencyKey), index("orders_created_idx").on(table.createdAt),
  check("orders_status_valid", sql`${table.status} IN ('pending','confirmed','shipped','delivered','cancelled')`),
  check("orders_totals_valid", sql`${table.subtotal} > 0 AND ${table.shipping} >= 0 AND ${table.total} = ${table.subtotal} + ${table.shipping}`),
]);

export const orderItems = sqliteTable("order_items", {
  id: text("id").primaryKey(), orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "restrict" }),
  productId: text("product_id").notNull().references(() => products.id, { onDelete: "restrict" }),
  name: text("name").notNull(), price: integer("price").notNull(), quantity: integer("quantity").notNull(), image: text("image").notNull(),
}, (table) => [
  index("order_items_order_idx").on(table.orderId),
  check("order_items_quantity_positive", sql`${table.quantity} > 0`), check("order_items_price_positive", sql`${table.price} > 0`),
]);

export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(), count: integer("count").notNull(), expiresAt: integer("expires_at").notNull(),
}, (table) => [index("rate_limits_expiry_idx").on(table.expiresAt)]);
