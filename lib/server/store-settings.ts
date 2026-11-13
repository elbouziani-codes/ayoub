import { cache } from "react";
import { z } from "zod";
import { getDatabase } from "./db";

const optional = (max: number) => z.string().trim().max(max);
export const storeSettingsSchema = z.object({
  business: z.object({ legalName: optional(200), commercialName: optional(200), ownerName: optional(200),
    legalForm: optional(120), address: optional(500), phone: optional(40), email: z.union([z.string().trim().email().max(200), z.literal("")]),
    rc: optional(80), taxId: optional(80), ice: optional(80), capital: optional(120), authorizations: optional(1000),
    hostingProvider: optional(300), cndpReference: optional(120), privacyContact: optional(200) }),
  shipping: z.object({ fee: z.number().int().min(0).max(10_000), freeThreshold: z.number().int().min(0).max(1_000_000),
    estimatedDaysMin: z.number().int().min(1).max(90), estimatedDaysMax: z.number().int().min(1).max(90),
    codEnabled: z.boolean(), cities: z.array(z.string().trim().min(2).max(100)).min(1).max(200) })
    .refine((value) => value.estimatedDaysMax >= value.estimatedDaysMin, { message: "Maximum delivery time must not be shorter than the minimum" }),
  appearance: z.object({ primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/), secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    defaultTheme: z.enum(["dark", "light", "system"]), radius: z.enum(["sharp", "soft", "round"]) }),
  checkout: z.object({ instructions: optional(1000), confirmationMessage: optional(1000), marketingEnabled: z.boolean() }),
  defaultLocale: z.enum(["en", "fr", "ar"]),
});
export type StoreSettings = z.infer<typeof storeSettingsSchema>;

export const defaultStoreSettings: StoreSettings = {
  business: { legalName: "", commercialName: "Ayoub Shop", ownerName: "", legalForm: "", address: "", phone: "", email: "", rc: "", taxId: "", ice: "", capital: "", authorizations: "", hostingProvider: "", cndpReference: "", privacyContact: "" },
  shipping: { fee: 35, freeThreshold: 1000, estimatedDaysMin: 2, estimatedDaysMax: 7, codEnabled: true,
    cities: ["Casablanca", "Rabat", "Marrakech", "Fès", "Tanger", "Agadir", "Meknès", "Oujda", "Kénitra", "Tétouan", "Safi", "Mohammedia", "El Jadida", "Béni Mellal", "Nador", "Essaouira", "Laâyoune", "Dakhla"] },
  appearance: { primaryColor: "#4d8dff", secondaryColor: "#9ac9ff", defaultTheme: "dark", radius: "soft" },
  checkout: { instructions: "", confirmationMessage: "", marketingEnabled: false }, defaultLocale: "fr",
};

type Row = { settings: string };
export const getStoreSettings = cache(async (): Promise<StoreSettings> => {
  const row = await getDatabase().prepare("SELECT settings FROM store_settings WHERE id = 'store'").first<Row>();
  if (!row) return defaultStoreSettings;
  const parsed = storeSettingsSchema.safeParse(JSON.parse(row.settings));
  return parsed.success ? parsed.data : defaultStoreSettings;
});

export async function saveStoreSettings(input: unknown, adminEmail: string): Promise<StoreSettings> {
  const settings = storeSettingsSchema.parse(input);
  await getDatabase().prepare(`INSERT INTO store_settings (id, settings, updated_at, updated_by) VALUES ('store', ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET settings = excluded.settings, updated_at = excluded.updated_at, updated_by = excluded.updated_by`)
    .bind(JSON.stringify(settings), new Date().toISOString(), adminEmail).run();
  return settings;
}
