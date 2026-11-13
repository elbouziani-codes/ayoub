import { requireAdmin } from "@/lib/server/auth";
import { statusSchema } from "@/lib/server/commerce";
import { updateOrderStatus } from "@/lib/server/orders";
import { handleError, json, readJson, requireSameOrigin } from "@/lib/server/http";
import { audit } from "@/lib/server/audit";
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(request); const session = await requireAdmin();
    const { id } = await context.params;
    const { status } = statusSchema.parse(await readJson(request));
    const order = await updateOrderStatus(id, status); await audit(session.user!.email, "order.status.update", "order", id, { status }); return json({ order });
  } catch (error) { return handleError(error); }
}
