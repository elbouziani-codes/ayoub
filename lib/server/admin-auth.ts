import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
import { z } from "zod";
import { credentialVersion, validPasswordHash, verifyPassword } from "./admin-credentials";
import { createSession, findSession, revokeSession, SESSION_SECONDS } from "./admin-session-store";
import { getDatabase } from "./db";
import { HttpError } from "./http";
import type { AdminSession } from "../types";

const COOKIE = "ayoub_admin_session";
const SECURE_COOKIE = "__Host-ayoub_admin_session";
const loginInput = z.object({
  email: z.string().trim().email().max(254).transform(value => value.toLowerCase()),
  password: z.string().min(1).max(256),
}).strict();

export function passwordAdminConfig(): { configured: boolean; email: string; hash: string; available: boolean } {
  const email = (env.ADMIN_LOGIN_EMAIL ?? "").trim().toLowerCase();
  const hash = env.ADMIN_PASSWORD_HASH ?? "";
  const configured = Boolean(email || hash);
  return { configured, email, hash, available: z.string().email().max(254).safeParse(email).success && validPasswordHash(hash) };
}

async function currentToken(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(SECURE_COOKIE)?.value ?? jar.get(COOKIE)?.value;
}

export async function passwordAdminSession(): Promise<AdminSession | null> {
  const config = passwordAdminConfig();
  if (!config.configured) return null;
  const anonymous: AdminSession = { authenticated: false, isAdmin: false, user: null, passwordLoginAvailable: config.available };
  if (!config.available) return anonymous;
  const token = await currentToken();
  if (!token || !await findSession(getDatabase(), token, config.email, await credentialVersion(config.email, config.hash))) return anonymous;
  return { authenticated: true, isAdmin: true, user: { email: config.email, displayName: "Administrator" }, authMethod: "password", passwordLoginAvailable: true };
}

export function parseAdminLogin(input: unknown): { email: string; password: string } {
  const parsed = loginInput.safeParse(input);
  if (!parsed.success) throw new HttpError(401, "Invalid email or password.", "invalid_credentials");
  return parsed.data;
}

function cookieName(request: Request): string {
  return new URL(request.url).protocol === "https:" ? SECURE_COOKIE : COOKIE;
}

function cookieValue(request: Request, value: string, maxAge: number): string {
  return `${cookieName(request)}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
}

export async function loginAdmin(request: Request, email: string, password: string): Promise<{ session: AdminSession; cookie: string }> {
  const config = passwordAdminConfig();
  if (!config.available) throw new HttpError(503, "Administrator sign-in is not available. Contact the store owner.", "login_unavailable");
  // Derive for unknown emails too, keeping invalid-credential responses uniform.
  const passwordMatches = await verifyPassword(password, config.hash);
  if (email !== config.email || !passwordMatches) throw new HttpError(401, "Invalid email or password.", "invalid_credentials");
  const created = await createSession(getDatabase(), config.email, await credentialVersion(config.email, config.hash), undefined, await currentToken());
  return { session: { authenticated: true, isAdmin: true, user: { email: config.email, displayName: "Administrator" }, authMethod: "password", passwordLoginAvailable: true }, cookie: cookieValue(request, created.token, SESSION_SECONDS) };
}

export async function logoutAdmin(request: Request): Promise<string[]> {
  const jar = await cookies();
  for (const name of [SECURE_COOKIE, COOKIE]) {
    const token = jar.get(name)?.value;
    if (token) await revokeSession(getDatabase(), token);
  }
  // Clear both names in case a local origin was upgraded from HTTP to HTTPS.
  return [cookieValue(request, "", 0), `${new URL(request.url).protocol === "https:" ? COOKIE : SECURE_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0; Secure`];
}
