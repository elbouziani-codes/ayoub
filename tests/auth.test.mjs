import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, pbkdf2Sync } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { openDatabase } from './helpers/database.mjs';
import { hashPassword, verifyPassword, credentialVersion, sessionToken } from '../lib/server/admin-credentials.ts';
import { createSession, findSession, revokeSession, SESSION_SECONDS } from '../lib/server/admin-session-store.ts';
import { consumeRateLimit, rateLimitKey } from '../lib/server/rate-limit-store.ts';
import { handleError, HttpError } from '../lib/server/http.ts';

/** Execute production D1 statements against SQLite, including atomic batch transactions. */
function d1(sqlite) {
  const prepare = (sql) => {
    let values = [];
    const statement = {
      bind(...args) { values = args; return statement; },
      async first(column) {
        const row = sqlite.prepare(sql).get(...values);
        return row ? column ? row[column] : row : null;
      },
      async run() {
        const result = sqlite.prepare(sql).run(...values);
        return { success: true, results: [], meta: { changes: Number(result.changes) } };
      },
    };
    return statement;
  };
  return {
    prepare,
    async batch(statements) {
      sqlite.exec('BEGIN IMMEDIATE');
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec('COMMIT');
        return results;
      } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  };
}

if (!isMainThread) {
  const sqlite = openDatabase(workerData.path, false);
  try {
    const ready = new Int32Array(workerData.ready);
    Atomics.add(ready, 0, 1);
    Atomics.notify(ready, 0);
    Atomics.wait(ready, 1, 0);
    parentPort.postMessage(await consumeRateLimit(d1(sqlite), 'shared-login', 5, 900, 1000));
  } finally { sqlite.close(); }
} else {
  const email = 'admin@example.invalid';
  const password = 'S3cure-admin-pa55word!';
  const salt = '000102030405060708090a0b0c0d0e0f';

  test('password derivation matches an independent PBKDF2 vector and preserves exact UTF-8 input', async () => {
    const input = `${password} ساعة`;
    const expected = pbkdf2Sync(input, Buffer.from(salt, 'hex'), 100000, 32, 'sha256').toString('hex');
    const encoded = await hashPassword(input, salt);
    assert.equal(encoded, `pbkdf2-sha256$100000$${salt}$${expected}`);
    assert.equal(await verifyPassword(input, encoded), true);
    assert.equal(await verifyPassword(`${input} `, encoded), false);
    assert.equal(await verifyPassword('wrong-password', encoded), false);
  });

  test('password hashes reject malformed encodings, unsupported work factors and oversized inputs', async () => {
    const encoded = await hashPassword(password, salt);
    for (const invalid of ['', 'plaintext-password', encoded.replace('100000', '1000000'), encoded.replace(salt, salt.slice(2)), `${encoded}x`, encoded.toUpperCase()]) {
      assert.equal(await verifyPassword(password, invalid), false);
    }
    assert.equal(await verifyPassword('x'.repeat(257), encoded), false);
    await assert.rejects(hashPassword(password, 'invalid-salt'));
    const second = await hashPassword(password);
    const third = await hashPassword(password);
    assert.notEqual(second, third, 'Fresh salts must produce different hashes for the same password');
  });

  test('credential versions bind both the account and password hash, while session tokens are fresh 256-bit values', async () => {
    const encoded = await hashPassword(password, salt);
    const version = await credentialVersion(email, encoded);
    assert.equal(version, createHash('sha256').update(`${email}\n${encoded}`).digest('hex'));
    assert.notEqual(version, await credentialVersion('other@example.invalid', encoded));
    assert.notEqual(version, await credentialVersion(email, await hashPassword('changed-password', salt)));
    const tokens = Array.from({ length: 20 }, sessionToken);
    for (const token of tokens) assert.match(token, /^[a-f0-9]{64}$/);
    assert.equal(new Set(tokens).size, tokens.length);
  });

  test('database sessions persist only the token digest and reject guessed tokens or another account/version', async () => {
    const sqlite = openDatabase();
    try {
      const db = d1(sqlite);
      const session = await createSession(db, email, 'credential-version', 1000);
      assert.equal(session.expiresAt, 1000 + SESSION_SECONDS);
      const row = sqlite.prepare('SELECT * FROM admin_sessions').get();
      assert.equal(row.token_hash, createHash('sha256').update(session.token).digest('hex'));
      assert.ok(!JSON.stringify(row).includes(session.token));
      assert.equal(await findSession(db, session.token, email, 'credential-version', 1001), true);
      assert.equal(await findSession(db, '0'.repeat(64), email, 'credential-version', 1001), false);
      assert.equal(await findSession(db, session.token, 'other@example.invalid', 'credential-version', 1001), false);
      assert.equal(await findSession(db, session.token, email, 'rotated-credential-version', 1001), false);
      for (const token of ['', `${session.token}x`, session.token.toUpperCase(), '../cookie']) {
        assert.equal(await findSession(db, token, email, 'credential-version', 1001), false);
      }
    } finally { sqlite.close(); }
  });

  test('sessions expire at the exact boundary, and logout immediately revokes the stored token', async () => {
    const sqlite = openDatabase();
    try {
      const db = d1(sqlite);
      const session = await createSession(db, email, 'version', 1000);
      assert.equal(await findSession(db, session.token, email, 'version', session.expiresAt - 1), true);
      assert.equal(await findSession(db, session.token, email, 'version', session.expiresAt), false);
      assert.equal(await findSession(db, session.token, email, 'version', session.expiresAt + 1), false);
      await revokeSession(db, session.token);
      assert.equal(await findSession(db, session.token, email, 'version', 1001), false);
      assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM admin_sessions').get().count, 0);
      await revokeSession(db, session.token);
      await revokeSession(db, 'malformed');
    } finally { sqlite.close(); }
  });

  test('a new login rotates its prior session and expired-session cleanup preserves other active logins', async () => {
    const sqlite = openDatabase();
    try {
      const db = d1(sqlite);
      const previous = await createSession(db, email, 'version', 1000);
      const independent = await createSession(db, email, 'version', 1001);
      const replacement = await createSession(db, email, 'version', 1002, previous.token);
      assert.notEqual(replacement.token, previous.token);
      assert.equal(await findSession(db, previous.token, email, 'version', 1003), false);
      assert.equal(await findSession(db, replacement.token, email, 'version', 1003), true);
      assert.equal(await findSession(db, independent.token, email, 'version', 1003), true);
      await createSession(db, email, 'version', independent.expiresAt);
      assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM admin_sessions WHERE expires_at <= ?').get(independent.expiresAt).count, 0);
      assert.equal(await findSession(db, replacement.token, email, 'version', independent.expiresAt), true);
    } finally { sqlite.close(); }
  });

  test('login counters hash identifiers and isolate IP, account and route namespaces', async () => {
    const sqlite = openDatabase();
    try {
      const db = d1(sqlite);
      const account = await rateLimitKey('admin-login-account', email);
      const client = await rateLimitKey('admin-login-ip', '192.0.2.1');
      assert.equal(account, `admin-login-account:${createHash('sha256').update(email).digest('hex')}`);
      assert.notEqual(account, await rateLimitKey('admin-login-ip', email));
      assert.notEqual(client, await rateLimitKey('admin-login-ip', '192.0.2.2'));
      await consumeRateLimit(db, account, 1, 900, 1000);
      await consumeRateLimit(db, client, 1, 900, 1000);
      assert.equal((await consumeRateLimit(db, account, 1, 900, 1001)).allowed, false);
      assert.equal((await consumeRateLimit(db, await rateLimitKey('admin-login-ip', '192.0.2.2'), 1, 900, 1001)).allowed, true);
      const persisted = JSON.stringify(sqlite.prepare('SELECT * FROM rate_limits').all());
      assert.ok(!persisted.includes(email));
      assert.ok(!persisted.includes('192.0.2.'));
    } finally { sqlite.close(); }
  });

  test('first-request windows prevent boundary bursts, preserve expiry on denial, and reset exactly on expiry', async () => {
    const sqlite = openDatabase();
    try {
      const db = d1(sqlite);
      assert.deepEqual(await consumeRateLimit(db, 'login', 2, 900, 899), { allowed: true, retryAfter: 900 });
      assert.deepEqual(await consumeRateLimit(db, 'login', 2, 900, 900), { allowed: true, retryAfter: 899 });
      assert.deepEqual(await consumeRateLimit(db, 'login', 2, 900, 901), { allowed: false, retryAfter: 898 });
      assert.deepEqual(await consumeRateLimit(db, 'login', 2, 900, 1798), { allowed: false, retryAfter: 1 });
      assert.deepEqual(await consumeRateLimit(db, 'login', 2, 900, 1799), { allowed: true, retryAfter: 900 });
      assert.deepEqual({ ...sqlite.prepare('SELECT count, expires_at FROM rate_limits WHERE key = ?').get('login') }, { count: 1, expires_at: 2699 });
    } finally { sqlite.close(); }
  });

  test('bounded counter cleanup removes expired keys while preserving active windows', async () => {
    const sqlite = openDatabase();
    try {
      const db = d1(sqlite);
      const insert = sqlite.prepare('INSERT INTO rate_limits (key, count, expires_at) VALUES (?, 1, ?)');
      for (let index = 0; index < 150; index++) insert.run(`expired-${index}`, 1000);
      insert.run('active', 2000);
      await consumeRateLimit(db, 'new', 5, 900, 1000);
      assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM rate_limits WHERE expires_at <= 1000').get().count, 50);
      assert.equal(sqlite.prepare('SELECT count FROM rate_limits WHERE key = ?').get('active').count, 1);
      await consumeRateLimit(db, 'new', 5, 900, 1001);
      assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM rate_limits WHERE expires_at <= 1000').get().count, 0);
    } finally { sqlite.close(); }
  });

  test('twelve simultaneous database clients grant exactly five login attempts', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'ayoub-auth-'));
    const path = join(directory, 'auth.sqlite');
    const setup = openDatabase(path);
    setup.close();
    const ready = new SharedArrayBuffer(8);
    const gate = new Int32Array(ready);
    const workers = [];
    try {
      const results = Array.from({ length: 12 }, () => new Promise((resolve, reject) => {
        const worker = new Worker(new URL(import.meta.url), { workerData: { path, ready } });
        workers.push(worker);
        worker.once('message', resolve);
        worker.once('error', reject);
        worker.once('exit', (code) => { if (code !== 0) reject(new Error(`Rate-limit worker exited ${code}`)); });
      }));
      // Every client reaches the same gate before any attempts to claim a request.
      const deadline = Date.now() + 10000;
      while (Atomics.load(gate, 0) < workers.length) {
        if (Date.now() > deadline) throw new Error('Rate-limit workers did not become ready');
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      Atomics.store(gate, 1, 1);
      Atomics.notify(gate, 1, workers.length);
      const outcomes = await Promise.all(results);
      assert.equal(outcomes.filter((result) => result.allowed).length, 5);
      assert.ok(outcomes.every((result) => result.retryAfter === 900));
      const sqlite = openDatabase(path, false);
      try { assert.equal(sqlite.prepare('SELECT count FROM rate_limits WHERE key = ?').get('shared-login').count, 12); }
      finally { sqlite.close(); }
    } finally {
      await Promise.all(workers.map((worker) => worker.terminate()));
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test('rate-limit errors expose a usable retry delay without caching the response', async () => {
    const response = handleError(new HttpError(429, 'Too many requests. Please try again later.', 'rate_limited', { 'Retry-After': '899' }));
    assert.equal(response.status, 429);
    assert.equal(response.headers.get('Retry-After'), '899');
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.deepEqual(await response.json(), { error: 'Too many requests. Please try again later.', code: 'rate_limited', retryAfter: 899 });
  });
}
