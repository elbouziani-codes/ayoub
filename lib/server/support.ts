import { z } from "zod";
import { getDatabase } from "./db";
import { HttpError } from "./http";
import { sha256 } from "./commerce";
import { trackOrder } from "./orders";

const optionalEmail = z.union([z.string().trim().email().max(200), z.literal("")]);
const phone = z.string().trim().transform((value) => value.replace(/[\s().-]/g, "")).pipe(z.string().regex(/^(?:\+212|0)[5-7]\d{8}$/));
export const complaintInputSchema = z.object({ customerName: z.string().trim().min(2).max(100), email: optionalEmail,
  phone, orderNumber: z.string().trim().max(40).optional(), subject: z.string().trim().min(3).max(200), message: z.string().trim().min(20).max(5000) });
export const complaintUpdateSchema = z.object({ status: z.enum(["open", "reviewing", "resolved", "closed"]), adminNotes: z.string().trim().max(5000) });
export const returnInputSchema = z.object({ orderNumber: z.string().trim().min(5).max(40), trackingToken: z.string().trim().min(20).max(300),
  reason: z.enum(["withdrawal", "damaged", "defective", "incorrect", "other"]), details: z.string().trim().min(10).max(5000) });
export const returnUpdateSchema = z.object({ status: z.enum(["requested", "approved", "rejected", "received", "refunded"]), adminNotes: z.string().trim().max(5000) });

function reference(prefix: string) { return `${prefix}-${new Date().getUTCFullYear()}-${crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`; }
function trackingToken() { const bytes = crypto.getRandomValues(new Uint8Array(24)); return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(""); }

export async function createComplaint(input: unknown) {
  const value = complaintInputSchema.parse(input); const id = crypto.randomUUID(); const ref = reference("REC"); const token = trackingToken(); const now = new Date().toISOString();
  await getDatabase().prepare(`INSERT INTO customer_complaints (id, reference, order_number, customer_name, email, phone, subject, message, status, tracking_hash, admin_notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, '', ?, ?)`)
    .bind(id, ref, value.orderNumber || null, value.customerName, value.email || null, value.phone, value.subject, value.message, await sha256(token), now, now).run();
  return { reference: ref, trackingToken: token, status: "open" as const, createdAt: now };
}
export async function trackComplaint(referenceValue: string, token: string) {
  const row = await getDatabase().prepare("SELECT reference, status, created_at, updated_at FROM customer_complaints WHERE reference = ? AND tracking_hash = ?")
    .bind(referenceValue.toUpperCase(), await sha256(token)).first<Record<string, string>>();
  if (!row) throw new HttpError(404, "Complaint not found", "complaint_not_found");
  return { reference: row.reference, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at };
}
export async function createReturnRequest(input: unknown) {
  const value = returnInputSchema.parse(input); const order = await trackOrder(value.orderNumber, value.trackingToken);
  if (!["delivered", "shipped"].includes(order.status)) throw new HttpError(409, "This order is not eligible for a return request yet", "return_unavailable");
  const existing = await getDatabase().prepare("SELECT reference FROM return_requests WHERE order_id = ? AND status NOT IN ('rejected','refunded')").bind(order.id).first<{ reference: string }>();
  if (existing) throw new HttpError(409, `A return request already exists: ${existing.reference}`, "return_exists");
  const id = crypto.randomUUID(); const ref = reference("RET"); const now = new Date().toISOString();
  await getDatabase().prepare(`INSERT INTO return_requests (id, reference, order_id, reason, details, status, admin_notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'requested', '', ?, ?)`).bind(id, ref, order.id, value.reason, value.details, now, now).run();
  return { reference: ref, status: "requested" as const, createdAt: now };
}
export async function listSupportCases() {
  const [complaints, returns] = await getDatabase().batch([
    getDatabase().prepare("SELECT * FROM customer_complaints ORDER BY created_at DESC LIMIT 500"),
    getDatabase().prepare(`SELECT r.*, o.number AS order_number FROM return_requests r JOIN orders o ON o.id = r.order_id ORDER BY r.created_at DESC LIMIT 500`),
  ]);
  return { complaints: complaints.results, returns: returns.results };
}
export async function updateComplaint(id: string, input: unknown) {
  const value = complaintUpdateSchema.parse(input); const result = await getDatabase().prepare("UPDATE customer_complaints SET status = ?, admin_notes = ?, updated_at = ? WHERE id = ?")
    .bind(value.status, value.adminNotes, new Date().toISOString(), id).run();
  if (!result.meta.changes) throw new HttpError(404, "Complaint not found", "complaint_not_found"); return value;
}
export async function updateReturnRequest(id: string, input: unknown) {
  const value = returnUpdateSchema.parse(input); const result = await getDatabase().prepare("UPDATE return_requests SET status = ?, admin_notes = ?, updated_at = ? WHERE id = ?")
    .bind(value.status, value.adminNotes, new Date().toISOString(), id).run();
  if (!result.meta.changes) throw new HttpError(404, "Return request not found", "return_not_found"); return value;
}
