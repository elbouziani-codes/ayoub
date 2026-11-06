declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    /** Comma-separated emails allowed to administer the shop. Empty denies everyone. */
    ADMIN_EMAILS?: string;
  }
}
