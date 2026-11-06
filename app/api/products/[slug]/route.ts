import { getProductBySlug } from "@/lib/server/catalog";
import { handleError, HttpError, json } from "@/lib/server/http";
export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    if (!/^[a-z0-9-]{2,90}$/.test(slug)) throw new HttpError(404, "Watch not found", "not_found");
    const product = await getProductBySlug(slug);
    if (!product) throw new HttpError(404, "Watch not found", "not_found");
    return json({ product });
  } catch (error) { return handleError(error); }
}
