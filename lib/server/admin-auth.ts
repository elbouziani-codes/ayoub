import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
import { z } from "zod";
import { validPasswordHash, verifyPassword } from "./admin-credentials";
import { createSession, findSession, revokeSession, SESSION_SECONDS } from "./admin-session-store";
import { getDatabase } from "./db";
import { readAccount, type AdminAccount } from "./admin-account-store";
import { HttpError } from "./http";
import type { AdminSession } from "../types";

const COOKIE = "ayoub_admin_session";
const SECURE_COOKIE = "__Host-ayoub_admin_session";
const loginInput = z.object({
  email: z.string().trim().email().max(254).transform(value => value.toLowerCase()),
  password: z.string().min(1).max(256),
}).strict();

export function passwordAdminConfig(): { configured: boolean; email: string; hash: string; recoveryEmail: string; available: boolean } {
  const email = (env.ADMIN_LOGIN_EMAIL ?? "").trim().toLowerCase();
  const hash = env.ADMIN_PASSWORD_HASH ?? "";
  const recoveryEmail = (env.ADMIN_RECOVERY_EMAIL ?? email).trim().toLowerCase();
  const configured = Boolean(email || hash || env.ADMIN_RECOVERY_EMAIL);
  return { configured, email, hash, recoveryEmail, available: z.string().email().max(254).safeParse(email).success && z.string().email().max(254).safeParse(recoveryEmail).success && validPasswordHash(hash) };
}

async function currentToken(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(SECURE_COOKIE)?.value ?? jar.get(COOKIE)?.value;
}

export async function getPasswordAccount(): Promise<AdminAccount> {
  const config = passwordAdminConfig();
  if (!config.available) throw new HttpError(503, "Administrator sign-in is not available. Contact the store owner.", "login_unavailable");
  return readAccount(getDatabase(), config);
}

export async function requirePasswordAccount(): Promise<AdminAccount> {
  const config = passwordAdminConfig();
  if (!config.configured) throw new HttpError(403, "Password account settings are unavailable.", "password_login_required");
  const account = await getPasswordAccount();
  const token = await currentToken();
  if (!token || !await findSession(getDatabase(), token, account.email, account.version)) throw new HttpError(401, "Please sign in to continue.", "unauthenticated");
  return account;
}

export async function passwordAdminSession(): Promise<AdminSession | null> {
  const config = passwordAdminConfig();
  if (!config.configured) return null;
  const anonymous: AdminSession = { authenticated: false, isAdmin: false, user: null, passwordLoginAvailable: config.available };
  if (!config.available) return anonymous;
  const account = await getPasswordAccount();
  const token = await currentToken();
  if (!token || !await findSession(getDatabase(), token, account.email, account.version)) return anonymous;
  return { authenticated: true, isAdmin: true, user: { email: account.email, displayName: "Administrator" }, authMethod: "password", passwordLoginAvailable: true };
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
  const account = await getPasswordAccount();
  // Derive for unknown emails too, keeping invalid-credential responses uniform.
  const passwordMatches = await verifyPassword(password, account.passwordHash);
  if (email !== account.email || !passwordMatches) throw new HttpError(401, "Invalid email or password.", "invalid_credentials");
  const created = await createSession(getDatabase(), account.email, account.version, undefined, await currentToken());
  return { session: { authenticated: true, isAdmin: true, user: { email: account.email, displayName: "Administrator" }, authMethod: "password", passwordLoginAvailable: true }, cookie: cookieValue(request, created.token, SESSION_SECONDS) };
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
