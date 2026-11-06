import { listProducts } from "@/lib/server/catalog";
import { handleError, json } from "@/lib/server/http";
export async function GET() {
  try { return json({ products: await listProducts() }); } catch (error) { return handleError(error); }
}
