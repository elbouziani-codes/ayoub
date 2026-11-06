import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

// VM modules let these route helpers run with a real request and controlled
// platform metadata, without booting either hosting provider or a database.
if (typeof vm.SourceTextModule !== 'function') {
  const child = spawnSync(process.execPath, ['--experimental-vm-modules', fileURLToPath(import.meta.url)], { stdio: 'inherit' });
  process.exit(child.status ?? 1);
}

const root = new URL('../', import.meta.url);
const sourceFiles = ['app/chatgpt-auth.ts', 'lib/server/auth.ts', 'lib/server/rate-limit.ts'];
const source = Object.fromEntries(await Promise.all(sourceFiles.map(async path => [path, stripTypeScriptTypes(await readFile(new URL(path, root), 'utf8'))])));

async function fixture(env = {}, passwordSession = null) {
  const context = vm.createContext({ process: { env } });
  const state = { passwordSession, headers: new Headers(), headerReads: 0, rateKeys: [], allowed: true };
  class HttpError extends Error {
    constructor(status, message, code, headers = {}) { super(message); Object.assign(this, { status, code, headers }); }
  }
  function synthetic(values) {
    return new vm.SyntheticModule(Object.keys(values), function () {
      for (const [key, value] of Object.entries(values)) this.setExport(key, value);
    }, { context });
  }
  const modules = Object.fromEntries(sourceFiles.map(path => [path, new vm.SourceTextModule(source[path], { context, identifier: new URL(path, root).href })]));
  const headers = synthetic({ headers: async () => { state.headerReads++; return state.headers; } });
  const navigation = synthetic({ redirect: path => { throw new Error(`redirect:${path}`); } });
  const database = synthetic({ getDatabase: () => ({}), getAdminEmails: () => ['owner@example.invalid'] });
  const password = synthetic({ passwordAdminSession: async () => state.passwordSession });
  const http = synthetic({ HttpError });
  const store = synthetic({
    rateLimitKey: async (namespace, client) => `${namespace}:${client}`,
    consumeRateLimit: async (_db, key) => { state.rateKeys.push(key); return { allowed: state.allowed, retryAfter: 17 }; },
  });
  await modules['app/chatgpt-auth.ts'].link(specifier => {
    if (specifier === 'next/headers') return headers;
    if (specifier === 'next/navigation') return navigation;
    throw new Error(`Unexpected ChatGPT auth import: ${specifier}`);
  });
  await modules['lib/server/auth.ts'].link(specifier => {
    if (specifier === '../../app/chatgpt-auth') return modules['app/chatgpt-auth.ts'];
    if (specifier === './db') return database;
    if (specifier === './http') return http;
    if (specifier === './admin-auth') return password;
    throw new Error(`Unexpected administrator auth import: ${specifier}`);
  });
  await modules['lib/server/rate-limit.ts'].link(specifier => {
    if (specifier === './db') return database;
    if (specifier === './http') return http;
    if (specifier === './rate-limit-store') return store;
    throw new Error(`Unexpected rate limiter import: ${specifier}`);
  });
  await Promise.all(Object.values(modules).map(module => module.evaluate()));
  return { state, chatGPT: modules['app/chatgpt-auth.ts'].namespace, auth: modules['lib/server/auth.ts'].namespace, rate: modules['lib/server/rate-limit.ts'].namespace };
}

function spoofOwner(state) {
  state.headers = new Headers({ 'oai-authenticated-user-id': 'attacker-controlled-id', 'oai-authenticated-user-email': 'owner@example.invalid' });
}

for (const runtime of [{ AYOUB_RUNTIME: 'netlify' }, { NETLIFY: 'true' }]) {
  test(`Netlify ${Object.keys(runtime)[0]} ignores forged Sites identity and denies an unconfigured administrator`, async () => {
    const { state, chatGPT, auth } = await fixture(runtime);
    spoofOwner(state);
    assert.equal(await chatGPT.getChatGPTUser(), null);
    const session = await auth.adminSession();
    assert.equal(session.authenticated, false);
    assert.equal(session.isAdmin, false);
    assert.equal(session.passwordLoginAvailable, false);
    assert.equal(session.chatGPTLoginAvailable, false);
    await assert.rejects(auth.requireAdmin(), error => error.status === 401);
    assert.equal(state.headerReads, 0, 'Unverified identity headers must not be consumed');
  });
}

test('Netlify preserves database password sessions and never uses Sites identity as a fallback', async () => {
  const anonymous = { authenticated: false, isAdmin: false, user: null, passwordLoginAvailable: true };
  const { state, auth } = await fixture({ AYOUB_RUNTIME: 'netlify' }, anonymous);
  spoofOwner(state);
  assert.equal((await auth.adminSession()).authenticated, false);
  state.passwordSession = { ...anonymous, authenticated: true, isAdmin: true, user: { email: 'admin@example.invalid', displayName: 'Administrator' }, authMethod: 'password' };
  const session = await auth.requireAdmin();
  assert.equal(session.authenticated, true);
  assert.equal(session.authMethod, 'password');
  assert.equal(session.user.email, 'admin@example.invalid');
  assert.equal(session.chatGPTLoginAvailable, false);
  assert.equal(state.headerReads, 0);
});

test('Sites continues to accept its gateway identity when password login is unconfigured', async () => {
  const { state, auth } = await fixture();
  spoofOwner(state);
  const session = await auth.requireAdmin();
  assert.equal(session.authenticated, true);
  assert.equal(session.isAdmin, true);
  assert.equal(session.authMethod, 'chatgpt');
  assert.equal(session.chatGPTLoginAvailable, true);
  assert.equal(state.headerReads, 1);
});

test('Netlify limits by its own connection header and ignores spoofed Cloudflare/forwarded values', async () => {
  const { state, rate } = await fixture({ AYOUB_RUNTIME: 'netlify' });
  for (const spoof of ['198.51.100.20', '198.51.100.99']) {
    const request = new Request('https://store.example/api/admin/login', { headers: { 'X-Nf-Client-Connection-Ip': '203.0.113.9', 'CF-Connecting-IP': spoof, 'X-Forwarded-For': spoof } });
    await rate.rateLimit(request, 'login', 5, 900);
  }
  assert.deepEqual(state.rateKeys, ['login:203.0.113.9', 'login:203.0.113.9']);
  await rate.rateLimit(new Request('https://store.example', { headers: { 'X-Nf-Client-Connection-Ip': '2001:DB8::1' } }), 'login', 5, 900);
  assert.equal(state.rateKeys.at(-1), 'login:2001:db8::1');
});

test('missing or malformed trusted IP uses a shared bucket and still enforces rejection', async () => {
  const { state, rate } = await fixture({ AYOUB_RUNTIME: 'netlify' });
  for (const headers of [{ 'CF-Connecting-IP': '198.51.100.20' }, { 'X-Nf-Client-Connection-Ip': '203.0.113.9, 198.51.100.20' }, { 'X-Forwarded-For': '198.51.100.99' }]) {
    await rate.rateLimit(new Request('https://store.example', { headers }), 'login', 5, 900);
  }
  assert.deepEqual(state.rateKeys, Array(3).fill('login:unknown-netlify-client'));
  state.allowed = false;
  await assert.rejects(rate.rateLimit(new Request('https://store.example'), 'login', 5, 900), error => error.status === 429 && error.headers['Retry-After'] === '17');
});

test('Sites keeps Cloudflare connection identity while explicit account counters remain host-independent', async () => {
  const { state, rate } = await fixture();
  const request = new Request('https://store.example', { headers: { 'CF-Connecting-IP': '203.0.113.4', 'X-Nf-Client-Connection-Ip': '198.51.100.4' } });
  await rate.rateLimit(request, 'login', 5, 900);
  await rate.rateLimit(request, 'account', 5, 900, 'owner@example.invalid');
  assert.deepEqual(state.rateKeys, ['login:203.0.113.4', 'account:owner@example.invalid']);
});
