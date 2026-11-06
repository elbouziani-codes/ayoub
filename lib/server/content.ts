import { cache } from "react";
import { z } from "zod";
import { dictionaries, type ContentOverrides, type TranslationKey } from "../i18n";
import { getDatabase } from "./db";
import { HttpError } from "./http";
import type { EditorialAsset } from "../types";

const keys = new Set(Object.keys(dictionaries.en));
export const contentInputSchema = z.object({
  key: z.string().refine((key) => keys.has(key), "Unknown content field"),
  en: z.string().trim().min(1).max(5000),
  fr: z.string().trim().min(1).max(5000),
  ar: z.string().trim().min(1).max(5000),
});

type ContentRow = { key: string; en: string; fr: string; ar: string };

export const getContentOverrides = cache(async (): Promise<ContentOverrides> => {
  const rows = await getDatabase().prepare("SELECT key, en, fr, ar FROM content_overrides").all<ContentRow>();
  const overrides: ContentOverrides = {};
  for (const row of rows.results) {
    if (keys.has(row.key)) overrides[row.key as TranslationKey] = { en: row.en, fr: row.fr, ar: row.ar };
  }
  return overrides;
});

export async function saveContent(input: z.infer<typeof contentInputSchema>) {
  const value = contentInputSchema.parse(input);
  const current = await getDatabase().prepare("SELECT en, fr, ar FROM content_overrides WHERE key = ?")
    .bind(value.key).first<Pick<ContentRow, "en" | "fr" | "ar">>();
  const before = current ?? {
    en: dictionaries.en[value.key as TranslationKey],
    fr: dictionaries.fr[value.key as TranslationKey],
    ar: dictionaries.ar[value.key as TranslationKey],
  };
  const changed = (["en", "fr", "ar"] as const).map((locale) => before[locale] !== value[locale]);
  if (changed.some(Boolean) && !changed.every(Boolean)) {
    throw new HttpError(400, "Update English, French and Arabic together", "incomplete_translations");
  }
  await getDatabase().prepare(`INSERT INTO content_overrides (key, en, fr, ar, updated_at)
    VALUES (?, ?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET en = excluded.en, fr = excluded.fr,
    ar = excluded.ar, updated_at = excluded.updated_at`)
    .bind(value.key, value.en, value.fr, value.ar, new Date().toISOString()).run();
  return value;
}

export const editorialAssetDefault = {
  slot: "editorialImage" as const, image: "/images/watch-blue.webp",
  en: "Blue dial watch detail", fr: "Détails d’une montre bleue", ar: "تفاصيل ساعة زرقاء",
};
const assetPath = z.string().max(500).regex(/^\/(?:images\/watch-(?:hero|silver|gold|blue)\.(?:webp|png)|api\/images\/[a-f0-9-]+\.(?:png|jpg|webp))$/);
export const contentAssetSchema = z.object({
  type: z.literal("image"), slot: z.literal("editorialImage"), image: assetPath,
  en: z.string().trim().min(1).max(300), fr: z.string().trim().min(1).max(300), ar: z.string().trim().min(1).max(300),
});
type AssetRow = { image_path: string; alt_en: string; alt_fr: string; alt_ar: string };
export const getEditorialAsset = cache(async (): Promise<EditorialAsset> => {
  const row = await getDatabase().prepare("SELECT image_path, alt_en, alt_fr, alt_ar FROM content_assets WHERE slot = 'editorialImage'").first<AssetRow>();
  return row ? { slot: "editorialImage", image: row.image_path, en: row.alt_en, fr: row.alt_fr, ar: row.alt_ar } : editorialAssetDefault;
});
export async function saveEditorialAsset(input: z.infer<typeof contentAssetSchema>) {
  const value = contentAssetSchema.parse(input);
  const before = await getEditorialAsset();
  const changed = (["en", "fr", "ar"] as const).map((locale) => before[locale] !== value[locale]);
  if ((before.image !== value.image || changed.some(Boolean)) && !changed.every(Boolean)) {
    throw new HttpError(400, "Update image descriptions in English, French and Arabic together", "incomplete_translations");
  }
  await getDatabase().prepare(`INSERT INTO content_assets (slot, image_path, alt_en, alt_fr, alt_ar, updated_at)
    VALUES ('editorialImage', ?, ?, ?, ?, ?) ON CONFLICT(slot) DO UPDATE SET image_path = excluded.image_path,
    alt_en = excluded.alt_en, alt_fr = excluded.alt_fr, alt_ar = excluded.alt_ar, updated_at = excluded.updated_at`)
    .bind(value.image, value.en, value.fr, value.ar, new Date().toISOString()).run();
  return { slot: "editorialImage" as const, image: value.image, en: value.en, fr: value.fr, ar: value.ar };
}
