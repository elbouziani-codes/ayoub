import { getDatabase as getNetlifyDatabase } from "@netlify/database";
import { createPostgresDatabase } from "./netlify-database";
import { createNetlifyBucket } from "./netlify-storage";

// Selected only by the native Next build. Connection strings and account secrets
// are read at request time; they are never put in next.config.env or client code.
let database: ReturnType<typeof createPostgresDatabase> | undefined;
const bucket = createNetlifyBucket();

export const env = {
  get DB() { return database ??= createPostgresDatabase(getNetlifyDatabase().pool); },
  get BUCKET() { return bucket; },
  get ADMIN_LOGIN_EMAIL() { return process.env.ADMIN_LOGIN_EMAIL; },
  get ADMIN_PASSWORD() { return process.env.ADMIN_PASSWORD; },
  get ADMIN_PASSWORD_HASH() { return process.env.ADMIN_PASSWORD_HASH; },
  get ADMIN_RECOVERY_EMAIL() { return process.env.ADMIN_RECOVERY_EMAIL; },
  get ADMIN_EMAILS() { return process.env.ADMIN_EMAILS; },
};
