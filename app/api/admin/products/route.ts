import { requireAdmin } from "@/lib/server/auth";
import { listProducts } from "@/lib/server/catalog";
import { productInputSchema } from "@/lib/server/commerce";
import { createProduct } from "@/lib/server/products";
import { handleError, json, readJson, requireSameOrigin } from "@/lib/server/http";
export async function GET() {
  try { await requireAdmin(); return json({ products: await listProducts() }); } catch (error) { return handleError(error); }
}
export async function POST(request: Request) {
  try {
    requireSameOrigin(request); await requireAdmin();
    const input = productInputSchema.parse(await readJson(request));
    return json({ product: await createProduct(input) }, 201);
  } catch (error) { return handleError(error); }
}
