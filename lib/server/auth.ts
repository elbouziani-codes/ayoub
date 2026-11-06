import { getChatGPTUser } from "../../app/chatgpt-auth";
import type { AdminSession } from "../types";
import { getAdminEmails } from "./db";
import { HttpError } from "./http";

export async function adminSession(): Promise<AdminSession> {
  // Identity is provided by the Sites trusted authentication gateway, never by a client field.
  const user = await getChatGPTUser();
  return { authenticated: Boolean(user), isAdmin: Boolean(user && getAdminEmails().includes(user.email.toLowerCase())),
    user: user ? { email: user.email, displayName: user.displayName } : null };
}

export async function requireAdmin(): Promise<AdminSession> {
  const session = await adminSession();
  if (!session.authenticated) throw new HttpError(401, "Please sign in to continue", "unauthenticated");
  if (!session.isAdmin) throw new HttpError(403, "Administrator access is required", "forbidden");
  return session;
}
