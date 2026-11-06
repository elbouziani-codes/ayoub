import { env } from "cloudflare:workers";

export function getDatabase(): D1Database {
  if (!env.DB) throw new Error("Database is unavailable");
  return env.DB;
}

export function getBucket(): R2Bucket {
  if (!env.BUCKET) throw new Error("Image storage is unavailable");
  return env.BUCKET;
}

export function getAdminEmails(): string[] {
  return (env.ADMIN_EMAILS ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
}
