-- PostgreSQL baseline of drizzle/0000 through drizzle/0005.
-- Keep IDs, ISO timestamps, JSON text and integer flags identical to D1 so an
-- existing shop export can be imported without changing application data shapes.
CREATE TABLE products (
  id text PRIMARY KEY NOT NULL,
  slug text NOT NULL,
  name text NOT NULL,
  subtitle text DEFAULT '' NOT NULL,
  description text NOT NULL,
  name_fr text,
  name_ar text,
  description_fr text,
  description_ar text,
  localized_details text,
  price integer NOT NULL,
  compare_at integer,
  category text NOT NULL,
  color text NOT NULL,
  movement text NOT NULL,
  case_size text NOT NULL,
  water_resistance text NOT NULL,
  material text NOT NULL,
  stock integer DEFAULT 0 NOT NULL,
  images text NOT NULL,
  featured integer DEFAULT 0 NOT NULL,
  badge text,
  archived integer DEFAULT 0 NOT NULL,
  sort_order integer DEFAULT 100 NOT NULL,
  created_at text NOT NULL,
  updated_at text NOT NULL,
  CONSTRAINT products_stock_nonnegative CHECK (stock >= 0),
  CONSTRAINT products_price_positive CHECK (price > 0),
  CONSTRAINT products_category_valid CHECK (category IN ('Classic','Sport','Minimal','Limited'))
);
CREATE UNIQUE INDEX products_slug_unique ON products (slug);
CREATE INDEX products_visible_sort_idx ON products (archived, sort_order);

CREATE TABLE orders (
  id text PRIMARY KEY NOT NULL,
  number text NOT NULL,
  customer text NOT NULL,
  subtotal integer NOT NULL,
  shipping integer NOT NULL,
  total integer NOT NULL,
  status text DEFAULT 'pending' NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  tracking_hash text NOT NULL,
  created_at text NOT NULL,
  updated_at text NOT NULL,
  CONSTRAINT orders_status_valid CHECK (status IN ('pending','confirmed','shipped','delivered','cancelled')),
  CONSTRAINT orders_totals_valid CHECK (subtotal > 0 AND shipping >= 0 AND total = subtotal + shipping)
);
CREATE UNIQUE INDEX orders_number_unique ON orders (number);
CREATE UNIQUE INDEX orders_idempotency_idx ON orders (idempotency_key);
CREATE INDEX orders_created_idx ON orders (created_at);

CREATE TABLE order_items (
  id text PRIMARY KEY NOT NULL,
  order_id text NOT NULL REFERENCES orders(id) ON UPDATE NO ACTION ON DELETE RESTRICT,
  product_id text NOT NULL REFERENCES products(id) ON UPDATE NO ACTION ON DELETE RESTRICT,
  name text NOT NULL,
  price integer NOT NULL,
  quantity integer NOT NULL,
  image text NOT NULL,
  CONSTRAINT order_items_quantity_positive CHECK (quantity > 0),
  CONSTRAINT order_items_price_positive CHECK (price > 0)
);
CREATE INDEX order_items_order_idx ON order_items (order_id);

CREATE TABLE rate_limits (
  key text PRIMARY KEY NOT NULL,
  count integer NOT NULL,
  expires_at integer NOT NULL
);
CREATE INDEX rate_limits_expiry_idx ON rate_limits (expires_at);

CREATE TABLE admin_sessions (
  token_hash text PRIMARY KEY NOT NULL,
  email text NOT NULL,
  credential_version text NOT NULL,
  expires_at integer NOT NULL
);
CREATE INDEX admin_sessions_expiry_idx ON admin_sessions (expires_at);

CREATE TABLE admin_accounts (
  id text PRIMARY KEY NOT NULL,
  email text NOT NULL,
  password_hash text NOT NULL,
  recovery_email text NOT NULL,
  bootstrap_version text NOT NULL,
  CONSTRAINT admin_accounts_singleton CHECK (id = 'admin')
);

CREATE TABLE content_overrides (
  key text PRIMARY KEY NOT NULL,
  en text NOT NULL,
  fr text NOT NULL,
  ar text NOT NULL,
  updated_at text NOT NULL
);

CREATE TABLE content_assets (
  slot text PRIMARY KEY NOT NULL,
  image_path text NOT NULL,
  alt_en text NOT NULL,
  alt_fr text NOT NULL,
  alt_ar text NOT NULL,
  updated_at text NOT NULL
);
