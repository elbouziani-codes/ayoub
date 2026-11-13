import { getBucket } from "@/lib/server/db";
import { handleError, HttpError } from "@/lib/server/http";
export async function GET(request: Request, context: { params: Promise<{ key: string }> }) {
  try {
    const { key } = await context.params;
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(png|jpg|webp)$/.test(key)) throw new HttpError(404, "Image not found", "not_found");
    const object = await getBucket().get(key);
    if (!object) throw new HttpError(404, "Image not found", "not_found");
    const headers = new Headers({ "Cache-Control": "public, max-age=31536000, immutable", "ETag": object.httpEtag,
      "X-Content-Type-Options": "nosniff", "Cross-Origin-Resource-Policy": "same-origin", "Content-Disposition": "inline",
      "Content-Security-Policy": "default-src 'none'; sandbox" });
    headers.set("Content-Type", key.endsWith(".png") ? "image/png" : key.endsWith(".jpg") ? "image/jpeg" : "image/webp");
    if (request.headers.get("If-None-Match") === object.httpEtag) return new Response(null, { status: 304, headers });
    return new Response(object.body, { headers });
  } catch (error) { return handleError(error); }
}
