import { z } from "zod";
import type { OrderStatus, Product } from "../types";

const cleanText = (min: number, max: number) => z.string().trim().min(min).max(max);
const optionalText = (max: number) => z.string().trim().max(max).optional();
const imagePath = z.string().max(500).regex(/^\/(?:images\/[a-zA-Z0-9_-]+\.(?:png|jpe?g|webp)|api\/images\/[a-f0-9-]+\.(?:png|jpg|webp))$/, "Use an uploaded product image");

const localizedDetailsSchema = z.object({
  subtitle: cleanText(0, 180), badge: cleanText(0, 40), color: cleanText(1, 80),
  movement: cleanText(1, 100), caseSize: cleanText(1, 50),
  waterResistance: cleanText(1, 60), material: cleanText(1, 150),
});
const productFieldsSchema = z.object({
  slug: cleanText(2, 90).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: cleanText(2, 120), subtitle: cleanText(0, 180), description: cleanText(10, 5000),
  nameFr: cleanText(2, 120), nameAr: cleanText(2, 120), descriptionFr: cleanText(10, 5000), descriptionAr: cleanText(10, 5000),
  localizedDetails: z.object({ fr: localizedDetailsSchema, ar: localizedDetailsSchema }),
  price: z.number().int().min(1).max(1000000), compareAt: z.number().int().min(1).max(1000000).nullable().optional(),
  category: z.enum(["Classic", "Sport", "Minimal", "Limited"]), color: cleanText(1, 80),
  movement: cleanText(1, 100), caseSize: cleanText(1, 50), waterResistance: cleanText(1, 60), material: cleanText(1, 150),
  stock: z.number().int().min(0).max(1000000), images: z.array(imagePath).min(1).max(8),
  featured: z.boolean(), badge: optionalText(40),
});

function checkOptionalTranslations(value: z.infer<typeof productFieldsSchema>, ctx: z.RefinementCtx) {
  for (const locale of ["fr", "ar"] as const) {
    for (const field of ["subtitle", "badge"] as const) {
      if (Boolean(value[field]?.trim()) !== Boolean(value.localizedDetails[locale][field].trim())) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["localizedDetails", locale, field], message: `Complete ${locale.toUpperCase()} ${field} when editing this text` });
      }
    }
  }
}
export const productInputSchema = productFieldsSchema.superRefine(checkOptionalTranslations);
const contentFields = ["name", "nameFr", "nameAr", "description", "descriptionFr", "descriptionAr", "subtitle", "badge", "color", "movement", "caseSize", "waterResistance", "material", "localizedDetails"] as const;
export const productPatchSchema = productFieldsSchema.partial().extend({ updatedAt: z.string().datetime().optional() })
  .refine((value) => Object.keys(value).some((key) => key !== "updatedAt"), "Provide at least one field")
  .refine((value) => value.stock === undefined || Boolean(value.updatedAt), "Refresh this watch before updating inventory")
  .superRefine((value, ctx) => {
    if (contentFields.some((field) => field in value)) {
      const complete = productFieldsSchema.safeParse(value);
      if (!complete.success) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Save all product text in English, French and Arabic", path: ["localizedDetails"] });
      } else checkOptionalTranslations(complete.data, ctx);
    }
  });
export const customerSchema = z.object({
  name: cleanText(2, 100),
  phone: z.string().trim().transform((phone) => phone.replace(/[\s().-]/g, "")).pipe(z.string().regex(/^(?:\+212|0)[5-7]\d{8}$/, "Enter a valid Moroccan mobile number")),
  city: cleanText(2, 100), address: cleanText(8, 300),
  email: z.union([z.string().trim().email().max(200), z.literal("")]).optional(), notes: optionalText(1000),
});
export const orderInputSchema = z.object({
  customer: customerSchema,
  items: z.array(z.object({ productId: cleanText(1, 100), quantity: z.number().int().min(1).max(10) })).min(1).max(20),
  idempotencyKey: z.string().uuid(),
}).superRefine((value, ctx) => {
  if (new Set(value.items.map((item) => item.productId)).size !== value.items.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Each product must appear once", path: ["items"] });
  }
  if (value.items.reduce((sum, item) => sum + item.quantity, 0) > 30) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Order quantity limit exceeded", path: ["items"] });
  }
});

export const statusSchema = z.object({ status: z.enum(["pending", "confirmed", "shipped", "delivered", "cancelled"]) });
const transitions: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed", "cancelled"], confirmed: ["shipped", "cancelled"], shipped: ["delivered"], delivered: [], cancelled: [],
};
export function canTransition(from: OrderStatus, to: OrderStatus): boolean { return from === to || transitions[from].includes(to); }
export function calculateTotals(items: { quantity: number; productId: string }[], products: Product[]) {
  const subtotal = items.reduce((sum, item) => {
    const product = products.find((p) => p.id === item.productId);
    if (!product || product.stock < item.quantity) throw new Error("unavailable");
    return sum + product.price * item.quantity;
  }, 0);
  const shipping = subtotal >= 1000 ? 0 : 35;
  return { subtotal, shipping, total: subtotal + shipping };
}

/** Stable under item ordering and object key ordering, bound to normalized delivery details. */
export function canonicalOrderPayload(input: z.infer<typeof orderInputSchema>): string {
  const { name, phone, city, address, email = "", notes = "" } = input.customer;
  return JSON.stringify({ customer: { name, phone, city, address, email, notes },
    items: [...input.items].sort((a, b) => a.productId.localeCompare(b.productId)) });
}

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
/** Both inputs have independent UUID entropy; only a hash of the result is stored. */
export function trackingTokenFor(orderId: string, idempotencyKey: string) {
  return sha256(`${orderId}:${idempotencyKey}:ayoub-order-tracking-v1`);
}
