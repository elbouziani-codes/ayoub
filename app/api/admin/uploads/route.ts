import { requireAdmin } from "@/lib/server/auth";
import { getBucket } from "@/lib/server/db";
import { handleError, HttpError, json, requireSameOrigin } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";

const maxBytes = 5 * 1024 * 1024;
function imageKind(bytes: Uint8Array): { extension: string; contentType: string } | null {
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => bytes[i] === byte)) return { extension: "png", contentType: "image/png" };
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return { extension: "jpg", contentType: "image/jpeg" };
  if (bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP") return { extension: "webp", contentType: "image/webp" };
  return null;
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request); await requireAdmin();
    await rateLimit(request, "upload", 60, 3600);
    const contentType = request.headers.get("Content-Type") ?? "";
    if (!contentType.toLowerCase().startsWith("multipart/form-data;")) throw new HttpError(415, "Upload an image using a file form", "invalid_content_type");
    const maxBody = maxBytes + 65536;
    if (Number(request.headers.get("Content-Length") ?? 0) > maxBody) throw new HttpError(413, "Images must be 5 MB or smaller", "file_too_large");
    const reader = request.body?.getReader();
    if (!reader) throw new HttpError(400, "Choose an image", "missing_file");
    let size = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBody) { await reader.cancel(); throw new HttpError(413, "Images must be 5 MB or smaller", "file_too_large"); }
      chunks.push(value);
    }
    const payload = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { payload.set(chunk, offset); offset += chunk.byteLength; }
    let form: FormData;
    try { form = await new Response(payload, { headers: { "Content-Type": contentType } }).formData(); }
    catch { throw new HttpError(400, "Image upload was not valid", "invalid_upload"); }
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) throw new HttpError(400, "Choose an image", "missing_file");
    if (file.size > maxBytes) throw new HttpError(413, "Images must be 5 MB or smaller", "file_too_large");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const kind = imageKind(bytes);
    if (!kind || file.type !== kind.contentType) throw new HttpError(415, "Choose a PNG, JPEG or WebP image", "invalid_image");
    const key = `${crypto.randomUUID()}.${kind.extension}`;
    await getBucket().put(key, bytes, { httpMetadata: { contentType: kind.contentType, cacheControl: "public, max-age=31536000, immutable" } });
    return json({ url: `/api/images/${key}` }, 201);
  } catch (error) { return handleError(error); }
}
