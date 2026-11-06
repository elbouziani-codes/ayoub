import { requireAdmin } from "@/lib/server/auth";
import { statusSchema } from "@/lib/server/commerce";
import { updateOrderStatus } from "@/lib/server/orders";
import { handleError, json, readJson, requireSameOrigin } from "@/lib/server/http";
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(request); await requireAdmin();
    const { id } = await context.params;
    const { status } = statusSchema.parse(await readJson(request));
    return json({ order: await updateOrderStatus(id, status) });
  } catch (error) { return handleError(error); }
}
