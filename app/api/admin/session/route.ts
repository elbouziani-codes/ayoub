import { adminSession } from "@/lib/server/auth";
import { handleError, json } from "@/lib/server/http";
export async function GET() {
  try { return json(await adminSession()); } catch (error) { return handleError(error); }
}
