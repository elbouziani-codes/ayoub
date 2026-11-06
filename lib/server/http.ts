import { ZodError } from "zod";

export class HttpError extends Error {
  status: number;
  code: string;
  headers: Record<string, string>;
  constructor(status: number, message: string, code = "request_failed", headers: Record<string, string> = {}) { super(message); this.status = status; this.code = code; this.headers = headers; }
}

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: {
    "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY", "Cross-Origin-Resource-Policy": "same-origin",
  } });
}

export function handleError(error: unknown): Response {
  if (error instanceof HttpError) {
    const retryAfter = Number(error.headers["Retry-After"]);
    const response = json({ error: error.message, code: error.code, ...(retryAfter > 0 ? { retryAfter } : {}) }, error.status);
    for (const [key, value] of Object.entries(error.headers)) response.headers.set(key, value);
    return response;
  }
  if (error instanceof ZodError) return json({ error: error.issues[0]?.message ?? "Check your details", code: "invalid_input" }, 400);
  // Keep internal SQL, binding names, personal information, and stack traces out of responses.
  console.error("Shop request failed", error instanceof Error ? error.name : "unknown");
  return json({ error: "We could not complete your request. Please try again.", code: "server_error" }, 500);
}

export function requireSameOrigin(request: Request): void {
  const origin = request.headers.get("Origin");
  if (!origin || origin !== new URL(request.url).origin) throw new HttpError(403, "This request is not permitted", "origin_rejected");
  if (request.headers.get("Sec-Fetch-Site") === "cross-site") throw new HttpError(403, "This request is not permitted", "origin_rejected");
}

export async function readJson(request: Request): Promise<unknown> {
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) throw new HttpError(415, "Send JSON data", "invalid_content_type");
  if (Number(request.headers.get("Content-Length") ?? 0) > 32768) throw new HttpError(413, "Request is too large", "payload_too_large");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "Request body is required", "invalid_json");
  let length = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const result = await reader.read();
    if (result.done) break;
    length += result.value.byteLength;
    if (length > 32768) { await reader.cancel(); throw new HttpError(413, "Request is too large", "payload_too_large"); }
    chunks.push(result.value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new HttpError(400, "Invalid JSON data", "invalid_json"); }
}
