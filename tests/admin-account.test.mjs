import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from './helpers/database.mjs';
import { readAccount, updateAccount } from '../lib/server/admin-account-store.ts';
import { credentialVersion, hashPassword, verifyPassword } from '../lib/server/admin-credentials.ts';
import { createSession, findSession } from '../lib/server/admin-session-store.ts';

/** Exercise the production D1 SQL against real SQLite transactions. */
function d1(sqlite) {
  return {
    prepare(sql) {
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
    },
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

const password = 'Account-fixture-password-2026!';
const hash = await hashPassword(password, '000102030405060708090a0b0c0d0e0f');
const changedPassword = 'Changed-account-password-2026!';
const changedHash = await hashPassword(changedPassword, 'f0e0d0c0b0a090807060504030201000');
const bootstrap = { email: 'admin@example.invalid', hash, recoveryEmail: 'owner@example.invalid' };

test('initial account seed binds credential version to its exact email and password hash', async () => {
  const sqlite = openDatabase();
  try {
    const db = d1(sqlite);
    const account = await readAccount(db, bootstrap);
    assert.equal(account.email, bootstrap.email);
    assert.equal(account.passwordHash, bootstrap.hash);
    assert.equal(account.recoveryEmail, bootstrap.recoveryEmail);
    assert.equal(account.version, await credentialVersion(account.email, account.passwordHash));
    assert.deepEqual(await readAccount(db, bootstrap), account);
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM admin_accounts').get().count, 1);
  } finally { sqlite.close(); }
});

test('email updates survive ordinary bootstrap reads and preserve the original recovery owner', async () => {
  const sqlite = openDatabase();
  try {
    const db = d1(sqlite);
    const account = await readAccount(db, bootstrap);
    const active = await createSession(db, account.email, account.version, 1000);
    const nextEmail = 'changed-admin@example.invalid';
    assert.equal(await updateAccount(db, account, { email: nextEmail, passwordHash: account.passwordHash }), true);
    const updated = await readAccount(db, bootstrap);
    assert.equal(updated.email, nextEmail);
    assert.equal(updated.passwordHash, hash);
    assert.equal(updated.recoveryEmail, bootstrap.recoveryEmail);
    assert.equal(updated.version, await credentialVersion(nextEmail, hash));
    assert.notEqual(updated.version, account.version);
    assert.equal(await findSession(db, active.token, account.email, account.version, 1001), false);
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM admin_sessions').get().count, 0);
    assert.deepEqual(await readAccount(db, bootstrap), updated);
  } finally { sqlite.close(); }
});

test('password updates revoke all previous sessions and cannot be reset by a normal login read', async () => {
  const sqlite = openDatabase();
  try {
    const db = d1(sqlite);
    const account = await readAccount(db, bootstrap);
    const first = await createSession(db, account.email, account.version, 1000);
    const second = await createSession(db, account.email, account.version, 1000);
    assert.equal(await updateAccount(db, account, { email: account.email, passwordHash: changedHash }), true);
    const updated = await readAccount(db, bootstrap);
    assert.equal(await verifyPassword(password, updated.passwordHash), false);
    assert.equal(await verifyPassword(changedPassword, updated.passwordHash), true);
    assert.equal(updated.version, await credentialVersion(account.email, changedHash));
    assert.equal(updated.recoveryEmail, bootstrap.recoveryEmail);
    for (const session of [first, second]) assert.equal(await findSession(db, session.token, account.email, account.version, 1001), false);
    const fresh = await createSession(db, updated.email, updated.version, 1002);
    assert.deepEqual(await readAccount(db, bootstrap), updated);
    assert.equal(await findSession(db, fresh.token, updated.email, updated.version, 1003), true);
    const persisted = JSON.stringify(sqlite.prepare('SELECT * FROM admin_sessions').all());
    assert.ok(!persisted.includes(fresh.token), 'Only token digests may be persisted');
    assert.ok(!persisted.includes(password));
    assert.ok(!persisted.includes(changedPassword));
  } finally { sqlite.close(); }
});

test('stale concurrent account changes cannot overwrite the winner or revoke its fresh session', async () => {
  const sqlite = openDatabase();
  try {
    const db = d1(sqlite);
    const original = await readAccount(db, bootstrap);
    const staleSnapshot = await readAccount(db, bootstrap);
    assert.equal(await updateAccount(db, original, { email: 'winning-admin@example.invalid', passwordHash: changedHash }), true);
    const winning = await readAccount(db, bootstrap);
    const newSession = await createSession(db, winning.email, winning.version, 1000);
    assert.equal(await updateAccount(db, staleSnapshot, { email: 'stale-admin@example.invalid', passwordHash: hash }), false);
    assert.deepEqual(await readAccount(db, bootstrap), winning);
    assert.equal(await findSession(db, newSession.token, winning.email, winning.version, 1001), true);
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM admin_sessions').get().count, 1);
  } finally { sqlite.close(); }
});

test('unchanged credentials preserve a current session but a stale no-op is rejected', async () => {
  const sqlite = openDatabase();
  try {
    const db = d1(sqlite);
    const original = await readAccount(db, bootstrap);
    const active = await createSession(db, original.email, original.version, 1000);
    assert.equal(await updateAccount(db, original, { email: original.email, passwordHash: original.passwordHash }), true);
    assert.equal(await findSession(db, active.token, original.email, original.version, 1001), true);
    assert.equal(await updateAccount(db, original, { email: 'winning-admin@example.invalid', passwordHash: changedHash }), true);
    const winner = await readAccount(db, bootstrap);
    const newSession = await createSession(db, winner.email, winner.version, 1002);
    assert.equal(await updateAccount(db, original, { email: original.email, passwordHash: original.passwordHash }), false);
    assert.deepEqual(await readAccount(db, bootstrap), winner);
    assert.equal(await findSession(db, newSession.token, winner.email, winner.version, 1003), true);
  } finally { sqlite.close(); }
});

test('a failed session revocation rolls the credential update back atomically', async () => {
  const sqlite = openDatabase();
  try {
    const db = d1(sqlite);
    const original = await readAccount(db, bootstrap);
    const active = await createSession(db, original.email, original.version, 1000);
    sqlite.exec("CREATE TRIGGER reject_session_delete BEFORE DELETE ON admin_sessions BEGIN SELECT RAISE(ABORT, 'local revocation failure'); END;");
    await assert.rejects(updateAccount(db, original, { email: 'changed@example.invalid', passwordHash: changedHash }));
    assert.deepEqual(await readAccount(db, bootstrap), original);
    assert.equal(await findSession(db, active.token, original.email, original.version, 1001), true);
  } finally { sqlite.close(); }
});

test('malformed persisted credentials and a changed recovery owner fail closed without silent re-seeding', async () => {
  for (const [column, value] of [['email', 'malformed-email'], ['password_hash', 'plaintext-password'], ['recovery_email', 'attacker@example.invalid']]) {
    const sqlite = openDatabase();
    try {
      const db = d1(sqlite);
      await readAccount(db, bootstrap);
      // Column identifiers are fixed test constants, never request input.
      sqlite.prepare(`UPDATE admin_accounts SET ${column} = ? WHERE id = 'admin'`).run(value);
      await assert.rejects(readAccount(db, bootstrap));
      assert.equal(sqlite.prepare(`SELECT ${column} AS value FROM admin_accounts WHERE id = 'admin'`).get().value, value);
    } finally { sqlite.close(); }
  }
});

test('deliberate environment credential rotation overrides edited credentials and revokes prior sessions once', async () => {
  const sqlite = openDatabase();
  try {
    const db = d1(sqlite);
    const initial = await readAccount(db, bootstrap);
    assert.equal(await updateAccount(db, initial, { email: 'edited-admin@example.invalid', passwordHash: changedHash }), true);
    const edited = await readAccount(db, bootstrap);
    const previous = await createSession(db, edited.email, edited.version, 1000);
    const replacementBootstrap = { ...bootstrap, email: 'replacement-admin@example.invalid' };
    const replacement = await readAccount(db, replacementBootstrap);
    assert.equal(replacement.email, replacementBootstrap.email);
    assert.equal(replacement.passwordHash, replacementBootstrap.hash);
    assert.equal(replacement.recoveryEmail, bootstrap.recoveryEmail);
    assert.equal(await findSession(db, previous.token, edited.email, edited.version, 1001), false);
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM admin_sessions').get().count, 0);
    const fresh = await createSession(db, replacement.email, replacement.version, 1002);
    assert.deepEqual(await readAccount(db, replacementBootstrap), replacement);
    assert.equal(await findSession(db, fresh.token, replacement.email, replacement.version, 1003), true);
  } finally { sqlite.close(); }
});

test('a changed bootstrap password or recovery identity is an explicit one-time account reset', async () => {
  for (const replacementBootstrap of [{ ...bootstrap, hash: changedHash }, { ...bootstrap, recoveryEmail: 'new-owner@example.invalid' }]) {
    const sqlite = openDatabase();
    try {
      const db = d1(sqlite);
      const initial = await readAccount(db, bootstrap);
      const oldSession = await createSession(db, initial.email, initial.version, 1000);
      const replacement = await readAccount(db, replacementBootstrap);
      assert.equal(replacement.email, replacementBootstrap.email);
      assert.equal(replacement.passwordHash, replacementBootstrap.hash);
      assert.equal(replacement.recoveryEmail, replacementBootstrap.recoveryEmail);
      assert.equal(await findSession(db, oldSession.token, initial.email, initial.version, 1001), false);
      assert.deepEqual(await readAccount(db, replacementBootstrap), replacement);
    } finally { sqlite.close(); }
  }
});
