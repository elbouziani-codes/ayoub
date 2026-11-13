import { listAuditLogs } from "@/lib/server/audit";
import { requireAdmin } from "@/lib/server/auth";
import { handleError, json } from "@/lib/server/http";

export async function GET(request: Request) {
  try { await requireAdmin(); return json({ logs: await listAuditLogs(Number(new URL(request.url).searchParams.get("limit") ?? 100)) }); }
  catch (error) { return handleError(error); }
}
