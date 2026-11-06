import { getDatabase } from "./db";
import { HttpError } from "./http";
import { consumeRateLimit, rateLimitKey } from "./rate-limit-store";

/** Durable counters are shared across server instances. */
export async function rateLimit(request: Request, namespace: string, max: number, windowSeconds: number, identifier?: string): Promise<void> {
  const netlify = process.env.AYOUB_RUNTIME === "netlify" || process.env.NETLIFY === "true";
  // Each host overwrites its own client-address header. CF-Connecting-IP is
  // client-controlled on Netlify; X-Forwarded-For is never an identity source.
  const address = request.headers.get(netlify ? "X-Nf-Client-Connection-Ip" : "CF-Connecting-IP")?.trim().toLowerCase();
  // A missing/malformed platform address shares one bucket instead of allowing
  // callers to select arbitrary identities through alternate headers.
  const client = identifier ?? (address && /^[0-9a-f:.]{2,64}$/.test(address) ? address : netlify ? "unknown-netlify-client" : "local-preview");
  const key = await rateLimitKey(namespace, client);
  const result = await consumeRateLimit(getDatabase(), key, max, windowSeconds);
  if (!result.allowed) throw new HttpError(429, "Too many requests. Please try again later.", "rate_limited", { "Retry-After": String(result.retryAfter) });
}
