# Netlify deployment and data migration

The Netlify build uses native Next.js and its OpenNext runtime. Products, orders, content, accounts, sessions and rate limits use Netlify Database (PostgreSQL); uploaded images use the site-wide `ayoub-product-images` Blobs store in `eu-central-1` with strong consistency. The existing `/api/images/<uuid>.<extension>` URLs remain valid.

This repository prepares the application for Netlify. A successful local build does not mean the hosted database, data import or live cutover has happened.

## Build locally

Use a current Node.js 22 release or Node.js 24. Run from the directory containing `package.json`:

```sh
npm ci
npm run build:netlify
npm run typecheck
npm test
```

The Netlify build must produce `.next`. `npm run build` remains the Sites/Cloudflare build; `netlify.toml` selects `npm run build:netlify` on Netlify.

For a local preview of the Netlify build, after configuring the target database:

```sh
AYOUB_RUNTIME=netlify node --env-file=.env node_modules/next/dist/bin/next start
```

Opening the storefront can seed an empty database. Finish an existing-store data import before opening this preview against the target database. While preparing an import, set `AYOUB_IMPORT_PENDING=true` to block application database access; the standalone importer still connects directly.

## Configure the Netlify project

1. Connect this repository and the intended deployment branch. The base directory is the repository root, where `package.json` and `netlify.toml` live.
2. Use build command `npm run build:netlify`, publish directory `.next`, and Node.js 22. The checked-in configuration supplies these settings. Netlify's Next.js/OpenNext runtime handles pages, server rendering and API routes.
3. Enable Netlify Database under **Data & Storage → Database**. It requires a [credit-based plan](https://docs.netlify.com/build/data-and-storage/netlify-database/billing-and-usage/), including eligible Free credit-based accounts. Compute and bandwidth use plan credits. If the account is on an incompatible plan, the account owner must choose whether to change plans before provisioning.
4. Before the first migration deployment, set `AYOUB_IMPORT_PENDING=true` in Netlify's environment settings for **Builds** and **Functions**. This temporarily returns 503 for application database access, preventing visitors and automated probes from seeding the empty target. It does not block schema migrations or the standalone data importer.
5. In Netlify's environment-variable settings, configure `ADMIN_LOGIN_EMAIL` and `ADMIN_PASSWORD` for the production **Functions** runtime. The password must contain 12–256 characters. Set the same bootstrap values for any preview context that should access a copy of this account. `ADMIN_EMAILS` alone does not configure password login on Netlify.
6. Deploy the branch. Netlify detects the database dependency, provisions the database, and applies `netlify/database/migrations/0001_storefront.sql` before publishing. Its [migration system](https://docs.netlify.com/build/data-and-storage/netlify-database/migrations/) tracks the applied schema. Leave `AYOUB_IMPORT_PENDING=true` until importing the data successfully, then remove the flag and redeploy to open the application.

Locally, keep the email and plaintext password in the ignored `.env` file:

```dotenv
ADMIN_LOGIN_EMAIL=admin@example.com
ADMIN_PASSWORD="replace-with-a-long-unique-password"
```

Leave `ADMIN_PASSWORD_HASH` unset when using the plaintext `.env` password. Passwords are derived and hashed on the server; they are never sent to the browser. Do not commit `.env`, snapshots, database connection strings or access tokens. Do not put secrets in `NEXT_PUBLIC_*` variables or `next.config.ts`.

Netlify supplies `NETLIFY_DB_URL` to the deployed runtime. For a local import or preview, copy the intended database branch's connection string from Netlify's database settings into `.env` as `NETLIFY_DB_URL`. Check that it belongs to the production project and branch you intend to migrate; deploy previews have separate database branches. Do not paste connection strings into shell commands or logs.

## Import an existing store

The private source snapshot is stored locally at `outputs/netlify-source-data.json`. The entire `outputs/` directory is ignored by Git. Export a fresh snapshot for the actual cutover if the source store has changed. Prevent source writes during that final export/import window so orders or stock changes are not missed.

The importer accepts this format, using database column names and JSON text exactly as stored in D1:

```json
{
  "version": 1,
  "tables": {
    "products": [],
    "orders": [],
    "order_items": [],
    "content_overrides": [],
    "content_assets": [],
    "admin_accounts": []
  }
}
```

All columns of each exported table must be present. IDs, translated product/content fields, order records, stock, archived flags and timestamps are preserved. Administrator sessions and rate-limit counters are deliberately excluded; everyone signs in again after the move.

The saved administrator email and password hash are preserved. The importer updates the account's bootstrap marker to match the new environment values, preventing the first Netlify request from overwriting saved account changes. The environment values used for import must match the hosted runtime values. `ADMIN_RECOVERY_EMAIL`, if supplied, must also match; otherwise it defaults to `ADMIN_LOGIN_EMAIL`.

Validate the prepared snapshot and bootstrap credentials without opening any database or API connection:

```sh
node --env-file=.env scripts/import-netlify-data.mjs --snapshot outputs/netlify-source-data.json --dry-run
```

The current prepared snapshot references bundled repository images, so it needs no image directory. For a snapshot containing uploaded images, download the original image bytes into `outputs/netlify-images/`, keeping each lowercase UUID filename and its `.png`, `.jpg` or `.webp` extension. Supply all referenced uploads:

```sh
node --env-file=.env scripts/import-netlify-data.mjs --snapshot outputs/netlify-source-data.json --images-dir outputs/netlify-images --dry-run
```

The importer checks filename format, file type, the 5 MiB size limit, required images, foreign-key references, column types, duplicate IDs and database constraints it can validate offline. A dry run does not verify target permissions, database emptiness or whether the configured database belongs to the intended Netlify project.

For image import from your computer, also put `NETLIFY_SITE_ID` and a suitable `NETLIFY_AUTH_TOKEN` in `.env`. These select and authorize the target Blobs store. The Project ID is shown in **Project configuration → General → Project information**. These local import credentials do not need to be added to the deployed application's environment; Netlify supplies its own Blobs access to Functions. See the [Blobs API documentation](https://docs.netlify.com/build/data-and-storage/netlify-blobs/).

After the schema is deployed and the target connection is configured, keep the hosted `AYOUB_IMPORT_PENDING=true` gate in place and explicitly apply the import:

```sh
node --env-file=.env scripts/import-netlify-data.mjs --snapshot outputs/netlify-source-data.json --apply
```

For uploaded images, add `--images-dir outputs/netlify-images` to the apply command too. When the command reports that the import committed, remove `AYOUB_IMPORT_PENDING` from Netlify's environment settings and redeploy. Keep the source store's final export/import write window closed until the imported copy is ready for verification.

The importer locks and checks all application tables, including sessions and rate limits, and refuses to modify a populated target. It never clears existing data. If a target was visited and seeded already, use a fresh empty database branch or review its contents before arranging a new empty migration target.

All database inserts run in one PostgreSQL transaction. Images upload before the transaction commits. Existing image keys are reused only when their bytes match; they are never overwritten. A failed import may leave uploaded, unreferenced blobs, which an identical retry can reuse. If a connection drops during commit, inspect the target before retrying rather than assuming it is empty. Logs contain counts and fixed validation messages, not rows, customer information or account secrets.

On Node.js 22.13–22.17, add `--experimental-strip-types` before `--env-file=.env` when running the importer; current Node.js 22 and Node.js 24 read the shared credential helper directly.

## Administrator access and recovery

On Netlify, the administrator signs in with the password account at `/admin/login`. Incoming `oai-authenticated-*` headers grant no access. Authenticated account settings still support changing the email and password, and those changes revoke previous sessions.

ChatGPT owner verification and its password recovery flow require the Sites gateway and are unavailable on Netlify. There is no email-reset delivery service configured. If the password is forgotten, update the bootstrap `ADMIN_PASSWORD` in Netlify's environment settings, keep the local `.env` in sync, and redeploy. An intentional change to bootstrap email, password or recovery identity resets the saved account on its next access and revokes previous sessions. Use a different new password value to trigger that reset; simply re-saving unchanged environment values does not override a password changed through account settings.

## Verify and switch traffic

After import, verify the deployed storefront, French default language, uploaded images, administrator sign-in, account settings, three-language content editing, inventory and order handling. Confirm anonymous visitors cannot access administrator APIs. Use clearly identified test orders and cancel them afterward to restore reserved stock.

Once these checks pass, connect the intended custom domain in Netlify and update its DNS. Netlify also supplies a `.netlify.app` address. The existing `.chatgpt.site` address belongs to Sites hosting and does not become the Netlify address automatically. Retire the old store only after the Netlify data and customer traffic are verified.
