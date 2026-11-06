import { readFile, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { credentialVersion, hashLocalAdminPassword, validPasswordHash } from '../lib/server/admin-credentials.ts';

// Identifiers are authored here, never taken from snapshot keys or row values.
const SCHEMA = {
  products: {
    id: 'text', slug: 'text', name: 'text', subtitle: 'text', description: 'text', name_fr: 'text?', name_ar: 'text?', description_fr: 'text?', description_ar: 'text?', localized_details: 'text?',
    price: 'int', compare_at: 'int?', category: 'text', color: 'text', movement: 'text', case_size: 'text', water_resistance: 'text', material: 'text', stock: 'int', images: 'text',
    featured: 'int', badge: 'text?', archived: 'int', sort_order: 'int', created_at: 'text', updated_at: 'text',
  },
  orders: { id: 'text', number: 'text', customer: 'text', subtotal: 'int', shipping: 'int', total: 'int', status: 'text', idempotency_key: 'text', request_hash: 'text', tracking_hash: 'text', created_at: 'text', updated_at: 'text' },
  order_items: { id: 'text', order_id: 'text', product_id: 'text', name: 'text', price: 'int', quantity: 'int', image: 'text' },
  content_overrides: { key: 'text', en: 'text', fr: 'text', ar: 'text', updated_at: 'text' },
  content_assets: { slot: 'text', image_path: 'text', alt_en: 'text', alt_fr: 'text', alt_ar: 'text', updated_at: 'text' },
  admin_accounts: { id: 'text', email: 'text', password_hash: 'text', recovery_email: 'text', bootstrap_version: 'text' },
};
const TABLES = Object.keys(SCHEMA);
const EMPTY_TABLES = [...TABLES, 'admin_sessions', 'rate_limits'];
const IMAGE_KEY = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(png|jpg|webp)$/;
const EMAIL = z.string().email().max(254);
class ImportError extends Error {}
function check(condition, message) { if (!condition) throw new ImportError(message); }
function plain(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function json(value, field) {
  try { return JSON.parse(value); } catch { throw new ImportError(`Invalid JSON in ${field}.`); }
}
function unique(rows, column, table) {
  check(new Set(rows.map(row => row[column])).size === rows.length, `Duplicate ${table}.${column} in snapshot.`);
}

export async function bootstrapFromEnv(env) {
  const email = (env.ADMIN_LOGIN_EMAIL ?? '').trim().toLowerCase();
  const recoveryEmail = (env.ADMIN_RECOVERY_EMAIL ?? email).trim().toLowerCase();
  const password = env.ADMIN_PASSWORD ?? '';
  check(EMAIL.safeParse(email).success && EMAIL.safeParse(recoveryEmail).success, 'Configure a valid ADMIN_LOGIN_EMAIL and optional ADMIN_RECOVERY_EMAIL.');
  const configuredHash = env.ADMIN_PASSWORD_HASH ?? '';
  check(configuredHash || (password.length >= 12 && password.length <= 256), 'Configure ADMIN_PASSWORD with 12–256 characters.');
  const hash = configuredHash || await hashLocalAdminPassword(email, password);
  check(validPasswordHash(hash), 'ADMIN_PASSWORD_HASH has an unsupported format.');
  return { recoveryEmail, version: await credentialVersion(recoveryEmail, await credentialVersion(email, hash)) };
}

export function validateSnapshot(snapshot, bootstrap) {
  check(plain(snapshot) && snapshot.version === 1 && plain(snapshot.tables), 'Expected snapshot version 1 with a tables object.');
  check(Object.keys(snapshot).every(key => ['version', 'tables'].includes(key)), 'Unexpected snapshot metadata.');
  check(Object.keys(snapshot.tables).every(table => EMPTY_TABLES.includes(table)), 'Snapshot contains an unsupported table.');
  const tables = {};
  for (const table of TABLES) {
    const rows = snapshot.tables[table];
    const fields = SCHEMA[table];
    check(Array.isArray(rows), `Snapshot must include a ${table} array.`);
    tables[table] = rows.map(row => {
      check(plain(row) && Object.keys(row).length === Object.keys(fields).length && Object.keys(row).every(column => Object.hasOwn(fields, column)), `Unexpected or missing columns in ${table}.`);
      for (const [column, type] of Object.entries(fields)) {
        const value = row[column];
        if (value === null && type.endsWith('?')) continue;
        check(type.startsWith('int') ? Number.isInteger(value) && value >= -2147483648 && value <= 2147483647 : typeof value === 'string' && !value.includes('\0'), `Invalid ${table}.${column}.`);
      }
      return { ...row };
    });
    unique(rows, table === 'content_overrides' ? 'key' : table === 'content_assets' ? 'slot' : 'id', table);
  }
  unique(tables.products, 'slug', 'products');
  unique(tables.orders, 'number', 'orders');
  unique(tables.orders, 'idempotency_key', 'orders');
  const imageKeys = new Set();
  function image(value) {
    check(typeof value === 'string' && /^\/(?:images\/[A-Za-z0-9_-]+\.(?:png|jpe?g|webp)|api\/images\/[^/]+)$/.test(value), 'Invalid product/content image path.');
    if (value.startsWith('/api/images/')) {
      const key = value.slice('/api/images/'.length);
      check(IMAGE_KEY.test(key), 'Uploaded image path must use a supported UUID filename.');
      imageKeys.add(key);
    }
  }
  for (const row of tables.products) {
    check(row.id && row.slug && row.price > 0 && row.stock >= 0 && ['Classic', 'Sport', 'Minimal', 'Limited'].includes(row.category), 'Invalid product constraints.');
    check([0, 1].includes(row.featured) && [0, 1].includes(row.archived), 'Invalid product flag.');
    const images = json(row.images, 'products.images');
    check(Array.isArray(images) && images.length > 0, 'Product images must be a nonempty JSON array.');
    images.forEach(image);
    if (row.localized_details !== null) check(plain(json(row.localized_details, 'products.localized_details')), 'Localized product details must be a JSON object.');
  }
  const products = new Set(tables.products.map(row => row.id));
  const orders = new Set(tables.orders.map(row => row.id));
  for (const row of tables.orders) {
    check(row.id && row.number && row.idempotency_key && row.subtotal > 0 && row.shipping >= 0 && row.total === row.subtotal + row.shipping, 'Invalid order constraints.');
    check(['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'].includes(row.status), 'Invalid order status.');
    check(plain(json(row.customer, 'orders.customer')), 'Order customer must be a JSON object.');
  }
  for (const row of tables.order_items) {
    check(row.id && orders.has(row.order_id) && products.has(row.product_id) && row.price > 0 && row.quantity > 0, 'Invalid order item or missing referenced product/order.');
    image(row.image);
  }
  tables.content_assets.forEach(row => image(row.image_path));
  check(tables.admin_accounts.length <= 1, 'Snapshot must contain at most one administrator account.');
  for (const row of tables.admin_accounts) {
    check(row.id === 'admin' && EMAIL.safeParse(row.email).success && validPasswordHash(row.password_hash), 'Invalid administrator account in snapshot.');
    // Preserve saved login credentials, while acknowledging the new host's
    // bootstrap configuration so its first request does not overwrite them.
    row.recovery_email = bootstrap.recoveryEmail;
    row.bootstrap_version = bootstrap.version;
  }
  return { tables, imageKeys };
}

async function loadImages(directory, requiredKeys) {
  if (!directory) {
    check(requiredKeys.size === 0, 'Snapshot references uploaded images; provide --images-dir.');
    return [];
  }
  const images = [];
  for (const file of await readdir(directory, { withFileTypes: true })) {
    check(file.isFile() && IMAGE_KEY.test(file.name), 'Images directory must contain only supported UUID image files; no subdirectories or symlinks.');
    const bytes = await readFile(join(directory, file.name));
    check(bytes.length > 0 && bytes.length <= 5 * 1024 * 1024, 'Each image must be at most 5 MiB.');
    const extension = file.name.split('.').at(-1);
    const valid = extension === 'png' ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : extension === 'jpg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
    check(valid, 'Image bytes do not match their filename extension.');
    images.push({ key: file.name, bytes, contentType: extension === 'png' ? 'image/png' : extension === 'jpg' ? 'image/jpeg' : 'image/webp' });
  }
  const suppliedKeys = new Set(images.map(image => image.key));
  check([...requiredKeys].every(key => suppliedKeys.has(key)), 'A referenced uploaded image is missing from --images-dir.');
  return images;
}

function validateTargetEnv(env, needsImages) {
  let url;
  try { url = new URL(env.NETLIFY_DB_URL ?? ''); } catch { /* Checked below without printing credentials. */ }
  check(url && ['postgres:', 'postgresql:'].includes(url.protocol) && url.hostname && url.username && url.pathname.length > 1, 'Set NETLIFY_DB_URL to the target database connection string.');
  if (needsImages) check(/^[a-f0-9-]{36}$/i.test(env.NETLIFY_SITE_ID ?? '') && Boolean(env.NETLIFY_AUTH_TOKEN?.trim()), 'Image import requires NETLIFY_SITE_ID and NETLIFY_AUTH_TOKEN for the target Netlify project.');
}

export async function importData({ tables, images, pool, store }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
    await client.query(`LOCK TABLE ${EMPTY_TABLES.join(', ')} IN ACCESS EXCLUSIVE MODE`);
    for (const table of EMPTY_TABLES) {
      const result = await client.query(`SELECT EXISTS (SELECT 1 FROM ${table}) AS populated`);
      check(result.rows[0]?.populated === false, 'Target application tables must all be empty. Nothing was imported.');
    }
    for (const table of TABLES) {
      const columns = Object.keys(SCHEMA[table]);
      const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map((_, index) => `$${index + 1}`).join(', ')})`;
      for (const row of tables[table]) await client.query(sql, columns.map(column => row[column]));
    }
    for (const image of images) {
      const result = await store.set(image.key, image.bytes, { onlyIfNew: true, metadata: { contentType: image.contentType, cacheControl: 'public, max-age=31536000, immutable' } });
      if (!result.modified) {
        const existing = await store.get(image.key, { type: 'arrayBuffer' });
        check(existing && createHash('sha256').update(new Uint8Array(existing)).digest('hex') === createHash('sha256').update(image.bytes).digest('hex'), 'An existing image key has different contents. Database import was rolled back.');
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* Preserve the original failure without exposing server details. */ }
    throw error;
  } finally { client.release(); }
}

export async function main(args = process.argv.slice(2), env = process.env) {
  const options = {};
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (flag === '--help') {
      console.log('Usage: node --env-file=.env scripts/import-netlify-data.mjs --snapshot outputs/netlify-source-data.json [--images-dir outputs/netlify-images] (--dry-run | --apply)');
      return;
    }
    check(['--snapshot', '--images-dir', '--dry-run', '--apply'].includes(flag) && !Object.hasOwn(options, flag), 'Unknown or repeated importer option. Use --help.');
    if (flag === '--snapshot' || flag === '--images-dir') {
      check(args[index + 1] && !args[index + 1].startsWith('--'), `Provide a path after ${flag}.`);
      options[flag] = resolve(args[++index]);
    } else options[flag] = true;
  }
  check(Boolean(options['--snapshot']) && Boolean(options['--dry-run']) !== Boolean(options['--apply']), 'Provide --snapshot and exactly one of --dry-run or --apply.');
  const bootstrap = await bootstrapFromEnv(env);
  let snapshot;
  try { snapshot = JSON.parse(await readFile(options['--snapshot'], 'utf8')); } catch { throw new ImportError('Cannot read a valid JSON snapshot.'); }
  const { tables, imageKeys } = validateSnapshot(snapshot, bootstrap);
  const images = await loadImages(options['--images-dir'], imageKeys);
  const summary = TABLES.map(table => `${table}=${tables[table].length}`).join(', ');
  if (options['--dry-run']) {
    console.log(`Dry run passed: ${summary}, images=${images.length}. No connections or writes made.`);
    return;
  }
  validateTargetEnv(env, images.length > 0);
  // Dynamic imports keep dry-run validation completely disconnected from APIs.
  const { getDatabase } = await import('@netlify/database');
  const { getStore } = images.length ? await import('@netlify/blobs') : {};
  const pool = getDatabase().pool;
  const store = images.length ? getStore({ name: 'ayoub-product-images', region: 'eu-central-1', consistency: 'strong', siteID: env.NETLIFY_SITE_ID, token: env.NETLIFY_AUTH_TOKEN }) : null;
  try {
    await importData({ tables, images, pool, store });
    console.log(`Import committed: ${summary}, images=${images.length}. Sessions and rate-limit counters were not imported.`);
  } finally { await pool.end(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    // PostgreSQL/API errors may include row values or credentials. Only our
    // fixed validation messages are suitable for terminal output.
    console.error(error instanceof ImportError ? error.message : 'Import did not report success. Inspect the target database before retrying; database/API error details were withheld.');
    process.exitCode = 1;
  });
}
