import { getDatabase } from "./db";
import { HttpError } from "./http";
import { consumeRateLimit, rateLimitKey } from "./rate-limit-store";

/** Durable counters are shared across Workers, unlike an in-memory limiter. */
export async function rateLimit(request: Request, namespace: string, max: number, windowSeconds: number, identifier?: string): Promise<void> {
  // Only the edge-provided client address is trusted; forwarded client fields can be spoofed.
  const client = identifier ?? request.headers.get("CF-Connecting-IP") ?? "local-preview";
  const key = await rateLimitKey(namespace, client);
  const result = await consumeRateLimit(getDatabase(), key, max, windowSeconds);
  if (!result.allowed) throw new HttpError(429, "Too many requests. Please try again later.", "rate_limited", { "Retry-After": String(result.retryAfter) });
}
