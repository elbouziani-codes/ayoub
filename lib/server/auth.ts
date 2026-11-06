import { getChatGPTUser } from "../../app/chatgpt-auth";
import type { AdminSession } from "../types";
import { getAdminEmails } from "./db";
import { HttpError } from "./http";
import { passwordAdminSession } from "./admin-auth";

export async function adminSession(): Promise<AdminSession> {
  const netlify = process.env.AYOUB_RUNTIME === "netlify" || process.env.NETLIFY === "true";
  // An explicitly configured password administrator requires its own session.
  // The Sites gateway still protects the audience of private hosted stores.
  const passwordSession = await passwordAdminSession();
  if (passwordSession) return { ...passwordSession, chatGPTLoginAvailable: !netlify };
  // A public host has no verified Sites identity to fall back to, including
  // when the administrator's environment configuration is missing or invalid.
  if (netlify) return { authenticated: false, isAdmin: false, user: null, passwordLoginAvailable: false, chatGPTLoginAvailable: false };
  const user = await getChatGPTUser();
  return { authenticated: Boolean(user), isAdmin: Boolean(user && getAdminEmails().includes(user.email.toLowerCase())),
    user: user ? { email: user.email, displayName: user.displayName } : null, ...(user ? { authMethod: "chatgpt" as const } : {}), passwordLoginAvailable: false, chatGPTLoginAvailable: true };
}

export async function requireAdmin(): Promise<AdminSession> {
  const session = await adminSession();
  if (!session.authenticated) throw new HttpError(401, "Please sign in to continue", "unauthenticated");
  if (!session.isAdmin) throw new HttpError(403, "Administrator access is required", "forbidden");
  return session;
}
