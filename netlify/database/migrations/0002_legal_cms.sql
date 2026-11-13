CREATE TABLE store_settings (
  id text PRIMARY KEY NOT NULL CHECK (id = 'store'), settings text NOT NULL,
  updated_at text NOT NULL, updated_by text NOT NULL
);
CREATE TABLE legal_pages (
  slug text PRIMARY KEY NOT NULL, draft_version_id text, published_version_id text, updated_at text NOT NULL
);
CREATE TABLE legal_page_versions (
  id text PRIMARY KEY NOT NULL, page_slug text NOT NULL REFERENCES legal_pages(slug) ON DELETE RESTRICT,
  version integer NOT NULL, title_en text NOT NULL, title_fr text NOT NULL, title_ar text NOT NULL,
  sections_en text NOT NULL, sections_fr text NOT NULL, sections_ar text NOT NULL,
  status text DEFAULT 'draft' NOT NULL CHECK (status IN ('draft','published','archived')),
  created_by text NOT NULL, created_at text NOT NULL, published_at text,
  UNIQUE (page_slug, version)
);
CREATE INDEX legal_page_versions_page_idx ON legal_page_versions (page_slug, created_at);
CREATE TABLE order_policy_acceptances (
  order_id text PRIMARY KEY NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  legal_version_id text NOT NULL REFERENCES legal_page_versions(id) ON DELETE RESTRICT,
  locale text NOT NULL CHECK (locale IN ('en','fr','ar')), terms_accepted integer NOT NULL,
  marketing_consent integer DEFAULT 0 NOT NULL, accepted_at text NOT NULL,
  CHECK (terms_accepted = 1)
);
CREATE TABLE customer_complaints (
  id text PRIMARY KEY NOT NULL, reference text UNIQUE NOT NULL, order_number text,
  customer_name text NOT NULL, email text, phone text NOT NULL, subject text NOT NULL, message text NOT NULL,
  status text DEFAULT 'open' NOT NULL CHECK (status IN ('open','reviewing','resolved','closed')),
  tracking_hash text NOT NULL, admin_notes text DEFAULT '' NOT NULL, created_at text NOT NULL, updated_at text NOT NULL
);
CREATE INDEX customer_complaints_status_idx ON customer_complaints (status, created_at);
CREATE TABLE return_requests (
  id text PRIMARY KEY NOT NULL, reference text UNIQUE NOT NULL,
  order_id text NOT NULL REFERENCES orders(id) ON DELETE RESTRICT, reason text NOT NULL, details text NOT NULL,
  status text DEFAULT 'requested' NOT NULL CHECK (status IN ('requested','approved','rejected','received','refunded')),
  admin_notes text DEFAULT '' NOT NULL, created_at text NOT NULL, updated_at text NOT NULL
);
CREATE INDEX return_requests_status_idx ON return_requests (status, created_at);
CREATE TABLE admin_audit_logs (
  id text PRIMARY KEY NOT NULL, admin_email text NOT NULL, action text NOT NULL,
  resource_type text NOT NULL, resource_id text NOT NULL, changes text NOT NULL, created_at text NOT NULL
);
CREATE INDEX admin_audit_logs_created_idx ON admin_audit_logs (created_at);
