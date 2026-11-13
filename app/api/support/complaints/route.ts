import { createComplaint, trackComplaint } from "@/lib/server/support";
import { handleError, json, readJson, requireSameOrigin } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
export async function POST(request: Request) { try { requireSameOrigin(request); await rateLimit(request, "complaint", 5, 3600); return json(await createComplaint(await readJson(request)), 201); } catch (error) { return handleError(error); } }
export async function GET(request: Request) { try { await rateLimit(request, "complaint-track", 30, 3600); const params = new URL(request.url).searchParams; return json(await trackComplaint(params.get("reference") ?? "", params.get("token") ?? "")); } catch (error) { return handleError(error); } }
