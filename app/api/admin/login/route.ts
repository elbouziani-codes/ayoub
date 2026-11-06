import { loginAdmin, parseAdminLogin } from "@/lib/server/admin-auth";
import { handleError, json, readJson, requireSameOrigin } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    // Charge the address before parsing or expensive password derivation.
    await rateLimit(request, "admin-login-ip", 5, 15 * 60);
    const input = parseAdminLogin(await readJson(request));
    await rateLimit(request, "admin-login-account", 20, 15 * 60, input.email);
    const result = await loginAdmin(request, input.email, input.password);
    const response = json(result.session);
    response.headers.set("Set-Cookie", result.cookie);
    return response;
  } catch (error) { return handleError(error); }
}
