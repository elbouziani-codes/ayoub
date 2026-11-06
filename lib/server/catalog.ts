import { seedProducts } from "../catalog";
import type { Product } from "../types";
import { getDatabase } from "./db";

type ProductRow = {
  id: string; slug: string; name: string; subtitle: string; description: string;
  name_fr: string | null; name_ar: string | null; description_fr: string | null; description_ar: string | null;
  price: number; compare_at: number | null; category: Product["category"]; color: string;
  movement: string; case_size: string; water_resistance: string; material: string; stock: number;
  images: string; featured: number; badge: string | null; updated_at: string;
};

export function productFromRow(row: ProductRow): Product {
  return { id: row.id, slug: row.slug, name: row.name, subtitle: row.subtitle, description: row.description,
    nameFr: row.name_fr ?? undefined, nameAr: row.name_ar ?? undefined,
    descriptionFr: row.description_fr ?? undefined, descriptionAr: row.description_ar ?? undefined,
    price: row.price, compareAt: row.compare_at ?? undefined, category: row.category, color: row.color,
    movement: row.movement, caseSize: row.case_size, waterResistance: row.water_resistance, material: row.material,
    stock: row.stock, images: JSON.parse(row.images), featured: Boolean(row.featured), badge: row.badge ?? undefined, updatedAt: row.updated_at };
}

/** INSERT OR IGNORE is safe across isolates and never overwrites merchant changes or stock. */
export async function ensureCatalogSeeded(db = getDatabase()): Promise<void> {
  if (await db.prepare("SELECT id FROM products WHERE id = ?").bind(seedProducts[0].id).first()) return;
  const now = new Date().toISOString();
  await db.batch(seedProducts.map((p, index) => db.prepare(`INSERT OR IGNORE INTO products
    (id, slug, name, subtitle, description, name_fr, name_ar, description_fr, description_ar, price, compare_at,
     category, color, movement, case_size, water_resistance, material, stock, images, featured, badge, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(p.id, p.slug, p.name, p.subtitle, p.description, p.nameFr ?? null, p.nameAr ?? null, p.descriptionFr ?? null,
      p.descriptionAr ?? null, p.price, p.compareAt ?? null, p.category, p.color, p.movement, p.caseSize,
      p.waterResistance, p.material, p.stock, JSON.stringify(p.images), p.featured ? 1 : 0, p.badge ?? null, index, now, now)));
}

export async function listProducts(includeArchived = false): Promise<Product[]> {
  const db = getDatabase();
  await ensureCatalogSeeded(db);
  const result = await db.prepare(`SELECT * FROM products ${includeArchived ? "" : "WHERE archived = 0"} ORDER BY sort_order, created_at DESC`).all<ProductRow>();
  return result.results.map(productFromRow);
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const db = getDatabase();
  await ensureCatalogSeeded(db);
  const row = await db.prepare("SELECT * FROM products WHERE slug = ? AND archived = 0").bind(slug).first<ProductRow>();
  return row ? productFromRow(row) : null;
}

export async function getProductById(id: string): Promise<Product | null> {
  const row = await getDatabase().prepare("SELECT * FROM products WHERE id = ? AND archived = 0").bind(id).first<ProductRow>();
  return row ? productFromRow(row) : null;
}

export async function getProductsByIds(ids: string[]): Promise<Product[]> {
  const db = getDatabase();
  await ensureCatalogSeeded(db);
  const result = await db.prepare(`SELECT * FROM products WHERE archived = 0 AND id IN (${ids.map(() => "?").join(",")})`).bind(...ids).all<ProductRow>();
  return result.results.map(productFromRow);
}
