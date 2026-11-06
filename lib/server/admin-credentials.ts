/** Workers-compatible password derivation. No password or hash is sent to the browser. */
export const PASSWORD_ITERATIONS = 100_000;
const encoder = new TextEncoder();
const hex = (bytes: ArrayBuffer | Uint8Array) => Array.from((bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)), byte => byte.toString(16).padStart(2, "0")).join("");

export function sessionToken(): string {
  return hex(crypto.getRandomValues(new Uint8Array(32)));
}

export function validPasswordHash(encoded: string): boolean {
  return /^pbkdf2-sha256\$100000\$[a-f0-9]{32}\$[a-f0-9]{64}$/.test(encoded);
}

export async function hashPassword(password: string, saltHex?: string): Promise<string> {
  const salt = saltHex ?? hex(crypto.getRandomValues(new Uint8Array(16)));
  if (!/^[a-f0-9]{32}$/.test(salt)) throw new Error("Invalid password salt");
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const derived = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", iterations: PASSWORD_ITERATIONS,
    salt: Uint8Array.from(salt.match(/../g)!, byte => parseInt(byte, 16)) }, key, 256);
  return `pbkdf2-sha256$${PASSWORD_ITERATIONS}$${salt}$${hex(derived)}`;
}

/** Keep local plaintext bootstrap credentials stable across Worker restarts. */
export async function hashLocalAdminPassword(email: string, password: string): Promise<string> {
  const salt = (await digest(`ayoub-shop-admin-bootstrap-v1\n${email}`)).slice(0, 32);
  return hashPassword(password, salt);
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  if (!validPasswordHash(encoded) || password.length > 256) return false;
  const derived = await hashPassword(password, encoded.split("$")[2]);
  // Always compare every byte of the same-size digest.
  let difference = 0;
  for (let i = 0; i < encoded.length; i++) difference |= encoded.charCodeAt(i) ^ derived.charCodeAt(i);
  return difference === 0;
}

export async function digest(value: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

export async function credentialVersion(email: string, encoded: string): Promise<string> {
  return digest(`${email}\n${encoded}`);
}
