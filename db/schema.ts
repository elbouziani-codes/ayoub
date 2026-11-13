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
  localizedDetails: text("localized_details"),
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

/** Only hashes of random session tokens are stored; credential changes revoke existing sessions. */
export const adminSessions = sqliteTable("admin_sessions", {
  tokenHash: text("token_hash").primaryKey(), email: text("email").notNull(),
  credentialVersion: text("credential_version").notNull(), expiresAt: integer("expires_at").notNull(),
}, (table) => [index("admin_sessions_expiry_idx").on(table.expiresAt)]);

/** Singleton account; bootstrap secrets provision it and remain the recovery authority. */
export const adminAccounts = sqliteTable("admin_accounts", {
  id: text("id").primaryKey(), email: text("email").notNull(), passwordHash: text("password_hash").notNull(),
  recoveryEmail: text("recovery_email").notNull(), bootstrapVersion: text("bootstrap_version").notNull(),
}, (table) => [check("admin_accounts_singleton", sql`${table.id} = 'admin'`)]);

/** Merchant-owned storefront copy; each update is saved as a complete language set. */
export const contentOverrides = sqliteTable("content_overrides", {
  key: text("key").primaryKey(),
  en: text("en").notNull(), fr: text("fr").notNull(), ar: text("ar").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const contentAssets = sqliteTable("content_assets", {
  slot: text("slot").primaryKey(), imagePath: text("image_path").notNull(),
  altEn: text("alt_en").notNull(), altFr: text("alt_fr").notNull(), altAr: text("alt_ar").notNull(),
  updatedAt: text("updated_at").notNull(),
});

/** Singleton JSON settings document. It is validated by the server before every write. */
export const storeSettings = sqliteTable("store_settings", {
  id: text("id").primaryKey(),
  settings: text("settings").notNull(),
  updatedAt: text("updated_at").notNull(),
  updatedBy: text("updated_by").notNull(),
}, (table) => [check("store_settings_singleton", sql`${table.id} = 'store'`)]);

export const legalPages = sqliteTable("legal_pages", {
  slug: text("slug").primaryKey(),
  draftVersionId: text("draft_version_id"),
  publishedVersionId: text("published_version_id"),
  updatedAt: text("updated_at").notNull(),
});

/** Published rows are immutable; editing always creates or updates a separate draft. */
export const legalPageVersions = sqliteTable("legal_page_versions", {
  id: text("id").primaryKey(),
  pageSlug: text("page_slug").notNull().references(() => legalPages.slug, { onDelete: "restrict" }),
  version: integer("version").notNull(),
  titleEn: text("title_en").notNull(), titleFr: text("title_fr").notNull(), titleAr: text("title_ar").notNull(),
  sectionsEn: text("sections_en").notNull(), sectionsFr: text("sections_fr").notNull(), sectionsAr: text("sections_ar").notNull(),
  status: text("status").notNull().default("draft"),
  createdBy: text("created_by").notNull(), createdAt: text("created_at").notNull(), publishedAt: text("published_at"),
}, (table) => [
  uniqueIndex("legal_page_versions_number_idx").on(table.pageSlug, table.version),
  index("legal_page_versions_page_idx").on(table.pageSlug, table.createdAt),
  check("legal_page_versions_status_valid", sql`${table.status} IN ('draft','published','archived')`),
]);

export const orderPolicyAcceptances = sqliteTable("order_policy_acceptances", {
  orderId: text("order_id").primaryKey().references(() => orders.id, { onDelete: "restrict" }),
  legalVersionId: text("legal_version_id").notNull().references(() => legalPageVersions.id, { onDelete: "restrict" }),
  locale: text("locale").notNull(), termsAccepted: integer("terms_accepted", { mode: "boolean" }).notNull(),
  marketingConsent: integer("marketing_consent", { mode: "boolean" }).notNull().default(false),
  acceptedAt: text("accepted_at").notNull(),
}, (table) => [
  check("order_policy_locale_valid", sql`${table.locale} IN ('en','fr','ar')`),
  check("order_policy_terms_required", sql`${table.termsAccepted} = 1`),
]);

export const customerComplaints = sqliteTable("customer_complaints", {
  id: text("id").primaryKey(), reference: text("reference").notNull().unique(), orderNumber: text("order_number"),
  customerName: text("customer_name").notNull(), email: text("email"), phone: text("phone").notNull(),
  subject: text("subject").notNull(), message: text("message").notNull(), status: text("status").notNull().default("open"),
  trackingHash: text("tracking_hash").notNull(), adminNotes: text("admin_notes").notNull().default(""),
  createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("customer_complaints_status_idx").on(table.status, table.createdAt),
  check("customer_complaints_status_valid", sql`${table.status} IN ('open','reviewing','resolved','closed')`),
]);

export const returnRequests = sqliteTable("return_requests", {
  id: text("id").primaryKey(), reference: text("reference").notNull().unique(), orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "restrict" }),
  reason: text("reason").notNull(), details: text("details").notNull(), status: text("status").notNull().default("requested"),
  adminNotes: text("admin_notes").notNull().default(""), createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("return_requests_status_idx").on(table.status, table.createdAt),
  check("return_requests_status_valid", sql`${table.status} IN ('requested','approved','rejected','received','refunded')`),
]);

export const adminAuditLogs = sqliteTable("admin_audit_logs", {
  id: text("id").primaryKey(), adminEmail: text("admin_email").notNull(), action: text("action").notNull(),
  resourceType: text("resource_type").notNull(), resourceId: text("resource_id").notNull(),
  changes: text("changes").notNull(), createdAt: text("created_at").notNull(),
}, (table) => [index("admin_audit_logs_created_idx").on(table.createdAt)]);
