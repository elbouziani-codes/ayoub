import { requireAdmin } from "@/lib/server/auth";
import { listOrders } from "@/lib/server/orders";
import { handleError, json } from "@/lib/server/http";
export async function GET(request: Request) {
  try {
    await requireAdmin();
    const params = new URL(request.url).searchParams;
    const limit = params.has("limit") ? Number(params.get("limit")) : 500;
    return json(await listOrders(params.get("cursor") ?? undefined, limit));
  } catch (error) { return handleError(error); }
}
