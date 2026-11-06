declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    /** Comma-separated emails allowed to administer the shop. Empty denies everyone. */
    ADMIN_EMAILS?: string;
    /** One explicitly provisioned password administrator, configured as runtime secrets. */
    ADMIN_LOGIN_EMAIL?: string;
    /** Local plaintext bootstrap password; never included in the deployed source. */
    ADMIN_PASSWORD?: string;
    ADMIN_PASSWORD_HASH?: string;
    /** Verified original Sites/ChatGPT email allowed to recover the password. Defaults to bootstrap email. */
    ADMIN_RECOVERY_EMAIL?: string;
  }
}
