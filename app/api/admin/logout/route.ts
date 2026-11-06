import { logoutAdmin } from "@/lib/server/admin-auth";
import { handleError, json, requireSameOrigin } from "@/lib/server/http";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const cookies = await logoutAdmin(request);
    const response = json({ ok: true });
    for (const cookie of cookies) response.headers.append("Set-Cookie", cookie);
    return response;
  } catch (error) { return handleError(error); }
}
