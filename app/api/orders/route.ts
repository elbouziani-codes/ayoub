import { orderInputSchema } from "@/lib/server/commerce";
import { createOrder } from "@/lib/server/orders";
import { handleError, json, readJson, requireSameOrigin } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const input = orderInputSchema.parse(await readJson(request));
    await rateLimit(request, "checkout", 12, 3600);
    const { replayed, ...result } = await createOrder(input);
    return json(result, replayed ? 200 : 201);
  } catch (error) { return handleError(error); }
}
