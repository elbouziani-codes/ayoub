import { requireAdmin } from "@/lib/server/auth";
import { productPatchSchema } from "@/lib/server/commerce";
import { archiveProduct, updateProduct } from "@/lib/server/products";
import { handleError, json, readJson, requireSameOrigin } from "@/lib/server/http";
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(request); await requireAdmin();
    const { id } = await context.params;
    const input = productPatchSchema.parse(await readJson(request));
    return json({ product: await updateProduct(id, input) });
  } catch (error) { return handleError(error); }
}
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(request); await requireAdmin();
    const { id } = await context.params;
    await archiveProduct(id);
    return json({ ok: true });
  } catch (error) { return handleError(error); }
}
