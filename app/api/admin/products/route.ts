import { requireAdmin } from "@/lib/server/auth";
import { listProducts } from "@/lib/server/catalog";
import { productInputSchema } from "@/lib/server/commerce";
import { createProduct } from "@/lib/server/products";
import { handleError, json, readJson, requireSameOrigin } from "@/lib/server/http";
import { audit } from "@/lib/server/audit";
export async function GET() {
  try { await requireAdmin(); return json({ products: await listProducts() }); } catch (error) { return handleError(error); }
}
export async function POST(request: Request) {
  try {
    requireSameOrigin(request); const session = await requireAdmin();
    const input = productInputSchema.parse(await readJson(request));
    const product = await createProduct(input); await audit(session.user!.email, "product.create", "product", product.id, { name: product.name, price: product.price, stock: product.stock });
    return json({ product }, 201);
  } catch (error) { return handleError(error); }
}
