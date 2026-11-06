type RateLimitDatabase = Pick<D1Database, "prepare">;

/** The identifier is hashed before persistence so counters contain no IPs or emails. */
export async function rateLimitKey(namespace: string, identifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(identifier));
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${namespace}:${hash}`;
}

/**
 * One atomic write both claims and increments the window, including across Workers.
 * The window begins with the first request; a wall-clock bucket boundary cannot
 * double the number of requests allowed in a short burst.
 */
export async function consumeRateLimit(
  db: RateLimitDatabase,
  key: string,
  max: number,
  windowSeconds: number,
  now = Math.floor(Date.now() / 1000),
): Promise<{ allowed: boolean; retryAfter: number }> {
  const result = await db.prepare(`INSERT INTO rate_limits (key, count, expires_at) VALUES (?, 1, ?)
    ON CONFLICT(key) DO UPDATE SET
      count = CASE WHEN rate_limits.expires_at <= ? THEN 1 ELSE rate_limits.count + 1 END,
      expires_at = CASE WHEN rate_limits.expires_at <= ? THEN excluded.expires_at ELSE rate_limits.expires_at END
    RETURNING count, expires_at`).bind(key, now + windowSeconds, now, now).first<{ count: number; expires_at: number }>();
  if (!result) throw new Error("Rate limit counter is unavailable");
  // Bounded cleanup avoids requiring a scheduled Worker and keeps active windows intact.
  await db.prepare("DELETE FROM rate_limits WHERE key IN (SELECT key FROM rate_limits WHERE expires_at <= ? LIMIT 100)").bind(now).run();
  return { allowed: result.count <= max, retryAfter: Math.max(1, result.expires_at - now) };
}
