import { requireAdmin } from "@/lib/server/auth";
import { productPatchSchema } from "@/lib/server/commerce";
import { archiveProduct, updateProduct } from "@/lib/server/products";
import { handleError, json, readJson, requireSameOrigin } from "@/lib/server/http";
import { audit } from "@/lib/server/audit";
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(request); const session = await requireAdmin();
    const { id } = await context.params;
    const input = productPatchSchema.parse(await readJson(request));
    const product = await updateProduct(id, input); await audit(session.user!.email, "product.update", "product", id, input); return json({ product });
  } catch (error) { return handleError(error); }
}
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(request); const session = await requireAdmin();
    const { id } = await context.params;
    await archiveProduct(id);
    await audit(session.user!.email, "product.archive", "product", id, {});
    return json({ ok: true });
  } catch (error) { return handleError(error); }
}
