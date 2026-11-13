import { getDatabase } from "./db";

function redact(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(redact);
  return Object.fromEntries(Object.entries(value).map(([key, item]) =>
    [key, /password|token|secret|hash/i.test(key) ? "[redacted]" : redact(item)]));
}

export async function audit(adminEmail: string, action: string, resourceType: string, resourceId: string, changes: unknown) {
  await getDatabase().prepare(`INSERT INTO admin_audit_logs
    (id, admin_email, action, resource_type, resource_id, changes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(crypto.randomUUID(), adminEmail.toLowerCase(), action, resourceType, resourceId,
      JSON.stringify(redact(changes)).slice(0, 20_000), new Date().toISOString()).run();
}

export async function listAuditLogs(limit = 100) {
  const size = Math.max(1, Math.min(250, Math.trunc(limit)));
  const rows = await getDatabase().prepare(`SELECT id, admin_email, action, resource_type, resource_id, changes, created_at
    FROM admin_audit_logs ORDER BY created_at DESC LIMIT ?`).bind(size).all<Record<string, string>>();
  return rows.results.map((row) => ({ id: row.id, adminEmail: row.admin_email, action: row.action,
    resourceType: row.resource_type, resourceId: row.resource_id, changes: JSON.parse(row.changes), createdAt: row.created_at }));
}
