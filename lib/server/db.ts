import { env } from "cloudflare:workers";
import { HttpError } from "./http";

export function getDatabase(): D1Database {
  if (process.env.AYOUB_RUNTIME === "netlify" && process.env.AYOUB_IMPORT_PENDING === "true") {
    throw new HttpError(503, "Store data is being transferred. Please try again shortly.", "migration_pending");
  }
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
