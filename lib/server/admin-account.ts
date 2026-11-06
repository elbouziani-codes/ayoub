import { z } from "zod";
import { getChatGPTUser } from "../../app/chatgpt-auth";
import { getPasswordAccount, passwordAdminConfig, requirePasswordAccount } from "./admin-auth";
import { hashPassword, verifyPassword } from "./admin-credentials";
import { updateAccount } from "./admin-account-store";
import { getDatabase } from "./db";
import { HttpError } from "./http";

const emailInput = z.string().trim().email().max(254).transform(value => value.toLowerCase());
export const newPasswordInput = z.string().min(12, "Use at least 12 characters.").max(256, "Use at most 256 characters.");
export const accountUpdateInput = z.object({
  currentPassword: z.string().min(1).max(256), email: emailInput.optional(),
  newPassword: newPasswordInput.optional(), confirmPassword: z.string().max(256).optional(),
}).strict().superRefine((input, ctx) => {
  if (!input.email && !input.newPassword) ctx.addIssue({ code: "custom", message: "Choose an email or password to update." });
  if (input.newPassword !== input.confirmPassword) ctx.addIssue({ code: "custom", message: "Passwords must match.", path: ["confirmPassword"] });
});
export const recoveryInput = z.object({ newPassword: newPasswordInput, confirmPassword: z.string().max(256) }).strict()
  .refine(input => input.newPassword === input.confirmPassword, { message: "Passwords must match.", path: ["confirmPassword"] });

export async function changeAdminAccount(input: z.infer<typeof accountUpdateInput>): Promise<void> {
  const account = await requirePasswordAccount();
  if (!await verifyPassword(input.currentPassword, account.passwordHash)) throw new HttpError(401, "The current password is incorrect.", "invalid_current_password");
  const email = input.email ?? account.email;
  if (email === account.email && !input.newPassword) throw new HttpError(400, "Choose an email or password to update.", "no_changes");
  const passwordHash = input.newPassword ? await hashPassword(input.newPassword) : account.passwordHash;
  if (!await updateAccount(getDatabase(), account, { email, passwordHash })) throw new HttpError(409, "Your account changed. Sign in again and retry.", "account_changed");
}

/** Recovery is bound to the original verified Sites identity, never to an editable login address. */
export async function adminRecoverySession() {
  const user = await getChatGPTUser();
  const config = passwordAdminConfig();
  return { authenticated: Boolean(user), canReset: Boolean(config.available && user && user.email.toLowerCase() === config.recoveryEmail),
    user: user ? { email: user.email, displayName: user.displayName } : null };
}

export async function resetAdminPassword(input: z.infer<typeof recoveryInput>): Promise<void> {
  const session = await adminRecoverySession();
  if (!session.authenticated) throw new HttpError(401, "Sign in with the store owner's ChatGPT account.", "unauthenticated");
  if (!session.canReset) throw new HttpError(403, "This account cannot recover administrator access.", "recovery_forbidden");
  const account = await getPasswordAccount();
  if (!await updateAccount(getDatabase(), account, { email: account.email, passwordHash: await hashPassword(input.newPassword) })) throw new HttpError(409, "Your account changed. Reload and try again.", "account_changed");
}
