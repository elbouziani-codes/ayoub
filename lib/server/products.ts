import type { z } from "zod";
import { productInputSchema, productPatchSchema } from "./commerce";
import { ensureCatalogSeeded, getProductById } from "./catalog";
import { getDatabase } from "./db";
import { HttpError } from "./http";
import type { Product, ProductDetails } from "../types";

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
      (id, slug, name, subtitle, description, name_fr, name_ar, description_fr, description_ar, localized_details, price, compare_at,
      category, color, movement, case_size, water_resistance, material, stock, images, featured, badge, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, input.slug, input.name, input.subtitle, input.description, input.nameFr ?? null, input.nameAr ?? null,
        input.descriptionFr, input.descriptionAr, JSON.stringify(input.localizedDetails), input.price, input.compareAt ?? null, input.category,
        input.color, input.movement, input.caseSize, input.waterResistance, input.material, input.stock,
        JSON.stringify(input.images), input.featured ? 1 : 0, input.badge ?? null, now, now).run();
  } catch (error) { conflict(error); }
  const created = await getProductById(id);
  if (!created) throw new HttpError(409, "This watch changed. Refresh your catalog.", "product_changed");
  return created;
}

const columns: Record<string, string> = { slug: "slug", name: "name", subtitle: "subtitle", description: "description",
  nameFr: "name_fr", nameAr: "name_ar", descriptionFr: "description_fr", descriptionAr: "description_ar", localizedDetails: "localized_details", price: "price",
  compareAt: "compare_at", category: "category", color: "color", movement: "movement", caseSize: "case_size",
  waterResistance: "water_resistance", material: "material", stock: "stock", images: "images", featured: "featured", badge: "badge" };

function enforceThreeLanguageChanges(before: Product, after: z.infer<typeof productInputSchema>) {
  const sets: Array<[string, string, string, string, string]> = [
    ["name", before.name, before.nameFr ?? "", before.nameAr ?? "", after.name],
    ["description", before.description, before.descriptionFr ?? "", before.descriptionAr ?? "", after.description],
  ];
  for (const [field, previousEn, previousFr, previousAr, nextEn] of sets) {
    const nextFr = field === "name" ? after.nameFr : after.descriptionFr;
    const nextAr = field === "name" ? after.nameAr : after.descriptionAr;
    const changed = [previousEn !== nextEn, previousFr !== nextFr, previousAr !== nextAr];
    if (previousFr && previousAr && changed.some(Boolean) && !changed.every(Boolean)) {
      throw new HttpError(400, `Update ${field} in English, French and Arabic together`, "incomplete_translations");
    }
  }
  for (const field of ["subtitle", "badge", "color", "movement", "caseSize", "waterResistance", "material"] as (keyof ProductDetails)[]) {
    const previousEn = before[field] ?? "";
    const previousFr = before.localizedDetails?.fr[field] ?? "";
    const previousAr = before.localizedDetails?.ar[field] ?? "";
    const changed = [previousEn !== (after[field] ?? ""), previousFr !== after.localizedDetails.fr[field], previousAr !== after.localizedDetails.ar[field]];
    if (previousFr && previousAr && changed.some(Boolean) && !changed.every(Boolean)) {
      throw new HttpError(400, `Update ${field} in English, French and Arabic together`, "incomplete_translations");
    }
  }
}

export async function updateProduct(id: string, input: z.infer<typeof productPatchSchema>) {
  const db = getDatabase();
  const current = await db.prepare("SELECT slug, price, compare_at, updated_at FROM products WHERE id = ? AND archived = 0").bind(id)
    .first<{ slug: string; price: number; compare_at: number | null; updated_at: string }>();
  if (!current) throw new HttpError(404, "Watch not found", "not_found");
  if (input.updatedAt && input.updatedAt !== current.updated_at) throw new HttpError(409, "This watch changed while you were editing. Refresh your catalog and try again.", "product_changed");
  if (["name", "nameFr", "nameAr", "description", "descriptionFr", "descriptionAr", "subtitle", "badge", "color", "movement", "caseSize", "waterResistance", "material", "localizedDetails"].some((key) => key in input)) {
    const before = await getProductById(id);
    if (!before) throw new HttpError(404, "Watch not found", "not_found");
    enforceThreeLanguageChanges(before, input as z.infer<typeof productInputSchema>);
  }
  const price = input.price ?? current.price;
  const compareAt = "compareAt" in input ? input.compareAt : current.compare_at;
  if (compareAt != null && compareAt < price) throw new HttpError(400, "Original price must be at least the selling price", "invalid_price");
  const entries = Object.entries(input).filter(([key, value]) => key in columns && value !== undefined);
  const values: (string | number | null)[] = entries.map(([key, value]) => key === "images" || key === "localizedDetails" ? JSON.stringify(value)
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
