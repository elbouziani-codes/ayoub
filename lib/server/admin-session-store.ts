import { digest, sessionToken } from "./admin-credentials.ts";

export const SESSION_SECONDS = 8 * 60 * 60;

export async function createSession(db: D1Database, email: string, version: string, now = Math.floor(Date.now() / 1000), previousToken?: string): Promise<{ token: string; expiresAt: number }> {
  const token = sessionToken();
  const expiresAt = now + SESSION_SECONDS;
  const statements = [db.prepare("DELETE FROM admin_sessions WHERE token_hash IN (SELECT token_hash FROM admin_sessions WHERE expires_at <= ? LIMIT 100)").bind(now)];
  if (previousToken && /^[a-f0-9]{64}$/.test(previousToken)) statements.push(db.prepare("DELETE FROM admin_sessions WHERE token_hash = ?").bind(await digest(previousToken)));
  statements.push(db.prepare("INSERT INTO admin_sessions (token_hash, email, credential_version, expires_at) VALUES (?, ?, ?, ?)").bind(await digest(token), email, version, expiresAt));
  await db.batch(statements);
  return { token, expiresAt };
}

export async function findSession(db: D1Database, token: string, email: string, version: string, now = Math.floor(Date.now() / 1000)): Promise<boolean> {
  if (!/^[a-f0-9]{64}$/.test(token)) return false;
  const session = await db.prepare("SELECT token_hash FROM admin_sessions WHERE token_hash = ? AND email = ? AND credential_version = ? AND expires_at > ?").bind(await digest(token), email, version, now).first();
  return Boolean(session);
}

export async function revokeSession(db: D1Database, token: string): Promise<void> {
  if (/^[a-f0-9]{64}$/.test(token)) await db.prepare("DELETE FROM admin_sessions WHERE token_hash = ?").bind(await digest(token)).run();
}
