import { requireAdmin } from "@/lib/server/auth";
import { listSupportCases } from "@/lib/server/support";
import { handleError, json } from "@/lib/server/http";
export async function GET() { try { await requireAdmin(); return json(await listSupportCases()); } catch (error) { return handleError(error); } }
