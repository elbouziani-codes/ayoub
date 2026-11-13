import { createReturnRequest } from "@/lib/server/support";
import { handleError, json, readJson, requireSameOrigin } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
export async function POST(request: Request) { try { requireSameOrigin(request); await rateLimit(request, "return", 5, 3600); return json(await createReturnRequest(await readJson(request)), 201); } catch (error) { return handleError(error); } }
