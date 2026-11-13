import { z } from "zod";
import { audit } from "@/lib/server/audit";
import { requireAdmin } from "@/lib/server/auth";
import { handleError, json, readJson, requireSameOrigin } from "@/lib/server/http";
import { updateComplaint, updateReturnRequest } from "@/lib/server/support";
const typeSchema = z.enum(["complaint", "return"]); const idSchema = z.string().uuid();
export async function PATCH(request: Request, context: { params: Promise<{ type: string; id: string }> }) { try { requireSameOrigin(request); const session = await requireAdmin(); const params = await context.params; const type = typeSchema.parse(params.type); const id = idSchema.parse(params.id); const body = await readJson(request); const item = type === "complaint" ? await updateComplaint(id, body) : await updateReturnRequest(id, body); await audit(session.user!.email, `${type}.update`, type, id, item); return json({ item }); } catch (error) { return handleError(error); } }
