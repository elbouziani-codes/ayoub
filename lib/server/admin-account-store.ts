import { credentialVersion, validPasswordHash } from "./admin-credentials.ts";

export type AdminAccount = { email: string; passwordHash: string; recoveryEmail: string; version: string };
export type AccountBootstrap = { email: string; hash: string; recoveryEmail: string };
type AccountRow = { email: string; password_hash: string; recovery_email: string; bootstrap_version: string };

/** The env values provision the account once; deliberate env rotation overrides saved changes. */
export async function readAccount(db: D1Database, bootstrap: AccountBootstrap): Promise<AdminAccount> {
  const bootstrapVersion = await credentialVersion(bootstrap.recoveryEmail, await credentialVersion(bootstrap.email, bootstrap.hash));
  // Revoke sessions only for an actual bootstrap rotation, in the same transaction.
  await db.batch([
    db.prepare("DELETE FROM admin_sessions WHERE EXISTS (SELECT 1 FROM admin_accounts WHERE id = 'admin' AND bootstrap_version <> ?)").bind(bootstrapVersion),
    db.prepare(`INSERT INTO admin_accounts (id, email, password_hash, recovery_email, bootstrap_version)
      VALUES ('admin', ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET
      email = excluded.email, password_hash = excluded.password_hash, recovery_email = excluded.recovery_email, bootstrap_version = excluded.bootstrap_version
      WHERE admin_accounts.bootstrap_version <> excluded.bootstrap_version`).bind(bootstrap.email, bootstrap.hash, bootstrap.recoveryEmail, bootstrapVersion),
  ]);
  const row = await db.prepare("SELECT email, password_hash, recovery_email, bootstrap_version FROM admin_accounts WHERE id = 'admin'").first<AccountRow>();
  if (!row || !validPasswordHash(row.password_hash) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email) || row.recovery_email !== bootstrap.recoveryEmail) throw new Error("Administrator account is unavailable");
  return { email: row.email, passwordHash: row.password_hash, recoveryEmail: row.recovery_email, version: await credentialVersion(row.email, row.password_hash) };
}

/** Compare-and-swap plus revocation commit atomically. A stale form cannot undo a newer change. */
export async function updateAccount(db: D1Database, previous: AdminAccount, next: { email: string; passwordHash: string }): Promise<boolean> {
  if (next.email === previous.email && next.passwordHash === previous.passwordHash) {
    return Boolean(await db.prepare("SELECT id FROM admin_accounts WHERE id = 'admin' AND email = ? AND password_hash = ? AND recovery_email = ?")
      .bind(previous.email, previous.passwordHash, previous.recoveryEmail).first());
  }
  const changed = await db.batch([
    db.prepare("UPDATE admin_accounts SET email = ?, password_hash = ? WHERE id = 'admin' AND email = ? AND password_hash = ? AND recovery_email = ?")
      .bind(next.email, next.passwordHash, previous.email, previous.passwordHash, previous.recoveryEmail),
    // SQLite changes() refers to the immediately preceding UPDATE in this batch.
    db.prepare("DELETE FROM admin_sessions WHERE changes() > 0"),
  ]);
  return (changed[0].meta.changes ?? 0) === 1;
}
