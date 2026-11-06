import { accountUpdateInput, changeAdminAccount } from "@/lib/server/admin-account";
import { logoutAdmin, requirePasswordAccount } from "@/lib/server/admin-auth";
import { handleError, json, readJson, requireSameOrigin } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";

export async function GET() {
  try {
    const account = await requirePasswordAccount();
    return json({ email: account.email, recoveryMethod: "chatgpt", recoveryEmail: account.recoveryEmail });
  } catch (error) { return handleError(error); }
}

export async function PATCH(request: Request) {
  try {
    requireSameOrigin(request);
    const account = await requirePasswordAccount();
    await rateLimit(request, "admin-account-ip", 10, 15 * 60);
    await rateLimit(request, "admin-account-owner", 10, 15 * 60, account.recoveryEmail);
    const input = accountUpdateInput.parse(await readJson(request));
    await changeAdminAccount(input);
    const response = json({ ok: true, requiresLogin: true });
    for (const cookie of await logoutAdmin(request)) response.headers.append("Set-Cookie", cookie);
    return response;
  } catch (error) { return handleError(error); }
}
