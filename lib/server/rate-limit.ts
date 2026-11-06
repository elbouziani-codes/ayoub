import { getDatabase } from "./db";
import { sha256 } from "./commerce";
import { HttpError } from "./http";

/** Durable counters are shared across Workers, unlike an in-memory limiter. */
export async function rateLimit(request: Request, namespace: string, max: number, windowSeconds: number): Promise<void> {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(now / windowSeconds);
  const client = request.headers.get("CF-Connecting-IP") ?? "local-preview";
  const key = `${namespace}:${bucket}:${await sha256(client)}`;
  const result = await db.prepare(`INSERT INTO rate_limits (key, count, expires_at) VALUES (?, 1, ?)
    ON CONFLICT(key) DO UPDATE SET count = count + 1 RETURNING count`).bind(key, (bucket + 1) * windowSeconds).first<{ count: number }>();
  // A bounded cleanup keeps this small without a scheduled worker dependency.
  await db.prepare("DELETE FROM rate_limits WHERE key IN (SELECT key FROM rate_limits WHERE expires_at < ? LIMIT 100)").bind(now).run();
  if (!result || result.count > max) throw new HttpError(429, "Too many requests. Please try again later.", "rate_limited");
}
