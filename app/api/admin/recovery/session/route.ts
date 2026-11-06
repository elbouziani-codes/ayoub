import { adminRecoverySession } from "@/lib/server/admin-account";
import { handleError, json } from "@/lib/server/http";
export async function GET() {
  try { return json(await adminRecoverySession()); } catch (error) { return handleError(error); }
}
