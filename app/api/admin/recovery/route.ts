import { adminRecoverySession, recoveryInput, resetAdminPassword } from "@/lib/server/admin-account";
import { logoutAdmin } from "@/lib/server/admin-auth";
import { handleError, HttpError, json, readJson, requireSameOrigin } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    await rateLimit(request, "admin-recovery-ip", 5, 15 * 60);
    const session = await adminRecoverySession();
    if (!session.authenticated) throw new HttpError(401, "Sign in with the store owner's ChatGPT account.", "unauthenticated");
    if (!session.canReset) throw new HttpError(403, "This account cannot recover administrator access.", "recovery_forbidden");
    await rateLimit(request, "admin-recovery-owner", 5, 15 * 60, session.user!.email.toLowerCase());
    const input = recoveryInput.parse(await readJson(request));
    await resetAdminPassword(input);
    const response = json({ ok: true, requiresLogin: true });
    for (const cookie of await logoutAdmin(request)) response.headers.append("Set-Cookie", cookie);
    return response;
  } catch (error) { return handleError(error); }
}
