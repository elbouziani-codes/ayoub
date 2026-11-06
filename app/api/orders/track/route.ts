import { handleError, HttpError, json } from "@/lib/server/http";
import { trackOrder } from "@/lib/server/orders";
import { rateLimit } from "@/lib/server/rate-limit";
export async function GET(request: Request) {
  try {
    await rateLimit(request, "tracking", 30, 900);
    const params = new URL(request.url).searchParams;
    const number = (params.get("number") ?? "").trim();
    const token = (params.get("token") ?? "").trim();
    if (!/^AY-\d{2}[A-F0-9]{16}$/i.test(number) || !/^[a-f0-9]{64}$/.test(token)) {
      throw new HttpError(404, "No order found with these tracking details", "order_not_found");
    }
    return json({ order: await trackOrder(number, token) });
  } catch (error) { return handleError(error); }
}
