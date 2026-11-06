import type { z } from "zod";
import { productInputSchema, productPatchSchema } from "./commerce";
import { ensureCatalogSeeded, getProductById } from "./catalog";
import { getDatabase } from "./db";
import { HttpError } from "./http";

function conflict(error: unknown): never {
  const detail = error instanceof Error ? `${error.message} ${error.cause instanceof Error ? error.cause.message : ""}` : "";
  if (/unique constraint|UNIQUE constraint/i.test(detail)) throw new HttpError(409, "A watch with this URL already exists", "slug_conflict");
  throw error;
}

export async function createProduct(input: z.infer<typeof productInputSchema>) {
  const db = getDatabase();
  await ensureCatalogSeeded(db);
  if (input.compareAt != null && input.compareAt < input.price) throw new HttpError(400, "Original price must be at least the selling price", "invalid_price");
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  try {
    await db.prepare(`INSERT INTO products
      (id, slug, name, subtitle, description, name_fr, name_ar, description_fr, description_ar, price, compare_at,
      category, color, movement, case_size, water_resistance, material, stock, images, featured, badge, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, input.slug, input.name, input.subtitle, input.description, input.nameFr ?? null, input.nameAr ?? null,
        input.descriptionFr ?? null, input.descriptionAr ?? null, input.price, input.compareAt ?? null, input.category,
        input.color, input.movement, input.caseSize, input.waterResistance, input.material, input.stock,
        JSON.stringify(input.images), input.featured ? 1 : 0, input.badge ?? null, now, now).run();
  } catch (error) { conflict(error); }
  const created = await getProductById(id);
  if (!created) throw new HttpError(409, "This watch changed. Refresh your catalog.", "product_changed");
  return created;
}

const columns: Record<string, string> = { slug: "slug", name: "name", subtitle: "subtitle", description: "description",
  nameFr: "name_fr", nameAr: "name_ar", descriptionFr: "description_fr", descriptionAr: "description_ar", price: "price",
  compareAt: "compare_at", category: "category", color: "color", movement: "movement", caseSize: "case_size",
  waterResistance: "water_resistance", material: "material", stock: "stock", images: "images", featured: "featured", badge: "badge" };

export async function updateProduct(id: string, input: z.infer<typeof productPatchSchema>) {
  const db = getDatabase();
  const current = await db.prepare("SELECT slug, price, compare_at, updated_at FROM products WHERE id = ? AND archived = 0").bind(id)
    .first<{ slug: string; price: number; compare_at: number | null; updated_at: string }>();
  if (!current) throw new HttpError(404, "Watch not found", "not_found");
  if (input.updatedAt && input.updatedAt !== current.updated_at) throw new HttpError(409, "This watch changed while you were editing. Refresh your catalog and try again.", "product_changed");
  const price = input.price ?? current.price;
  const compareAt = "compareAt" in input ? input.compareAt : current.compare_at;
  if (compareAt != null && compareAt < price) throw new HttpError(400, "Original price must be at least the selling price", "invalid_price");
  const entries = Object.entries(input).filter(([key, value]) => key in columns && value !== undefined);
  const values: (string | number | null)[] = entries.map(([key, value]) => key === "images" ? JSON.stringify(value)
    : key === "featured" ? (value ? 1 : 0) : value as string | number | null);
  const nextStamp = new Date(Math.max(Date.now(), Date.parse(current.updated_at) + 1)).toISOString();
  try {
    const result = await db.prepare(`UPDATE products SET ${entries.map(([key]) => `${columns[key]} = ?`).join(", ")}, updated_at = ?
      WHERE id = ? AND archived = 0 AND updated_at = ?`)
      .bind(...values, nextStamp, id, current.updated_at).run();
    if (!result.meta.changes) throw new HttpError(409, "This watch changed while you were editing. Refresh your catalog and try again.", "product_changed");
  } catch (error) { conflict(error); }
  const updated = await getProductById(id);
  if (!updated) throw new HttpError(409, "This watch was archived. Refresh your catalog.", "product_changed");
  return updated;
}

export async function archiveProduct(id: string): Promise<void> {
  const result = await getDatabase().prepare("UPDATE products SET archived = 1, updated_at = ? WHERE id = ? AND archived = 0")
    .bind(new Date().toISOString(), id).run();
  if (!result.meta.changes) throw new HttpError(404, "Watch not found", "not_found");
}
