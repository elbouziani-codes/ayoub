/**
 * Local-only administrator account checks. Temporarily changes the configured
 * development account and restores the original email/password in finally.
 * Use a fresh local login rate window; the full flow needs five login attempts.
 * ADMIN_TEST_EMAIL=... ADMIN_TEST_PASSWORD=... node tests/account-integration.mjs http://127.0.0.1:5173
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const base = new URL(process.argv[2] || 'http://127.0.0.1:5173');
if (base.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname)
  || base.username || base.password || base.pathname !== '/' || base.search || base.hash) {
  throw new Error('Refusing account mutations: checks only support a local HTTP development server.');
}
const original = { email: process.env.ADMIN_TEST_EMAIL?.trim().toLowerCase(), password: process.env.ADMIN_TEST_PASSWORD };
assert.ok(original.email && original.password, 'Set ADMIN_TEST_EMAIL and ADMIN_TEST_PASSWORD for the local account');
const suffix = randomUUID();
const changedEmail = `local-account-${suffix}@example.invalid`;
const changedPassword = `Local-account-${suffix}!`;
let current = { ...original };
let cookie = '';
let changed = false;
let passed = 0;
let loginAttempts = 0;

async function request(path, { method = 'GET', data, expected = 200, headers = {}, useCookie = false, includeOrigin = true } = {}) {
  const requestHeaders = new Headers(headers);
  if (method !== 'GET' && method !== 'HEAD' && includeOrigin && !requestHeaders.has('Origin')) requestHeaders.set('Origin', base.origin);
  if (data !== undefined) requestHeaders.set('Content-Type', 'application/json');
  if (useCookie) {
    assert.ok(cookie, 'An authenticated local session is required');
    requestHeaders.set('Cookie', cookie);
  }
  const response = await fetch(new URL(path, base), {
    method, headers: requestHeaders, body: data === undefined ? undefined : JSON.stringify(data),
    redirect: 'manual', signal: AbortSignal.timeout(30000),
  });
  const isJson = (response.headers.get('Content-Type') || '').includes('application/json');
  const body = isJson ? await response.json() : await response.text();
  assert.equal(response.status, expected, `${method} ${path}: expected ${expected}, received ${response.status}${body?.code ? ` (${body.code})` : ''}`);
  // The dev framework may reject cross-origin requests before application headers run.
  if (isJson) assert.equal(response.headers.get('Cache-Control'), 'no-store', 'Sensitive account responses must not be cached');
  return { response, data: body };
}

function sessionCookie(response) {
  const values = response.headers.getSetCookie();
  assert.ok(values.length, 'Real local authentication must issue its own cookie');
  return values.map(value => value.split(';')[0]).join('; ');
}

async function login(credentials = current, expected = 200) {
  loginAttempts++;
  assert.ok(loginAttempts <= 5, 'Stay within the real local login rate limit');
  const result = await request('/api/admin/login', { method: 'POST', data: credentials, expected });
  if (expected === 200) cookie = sessionCookie(result.response);
  return result;
}

async function check(name, callback) {
  await callback();
  passed++;
  console.log(`✓ ${name}`);
}

async function update(data) {
  const result = await request('/api/admin/account', {
    method: 'PATCH', useCookie: true, data: { currentPassword: current.password, ...data },
  });
  // Track successful mutations immediately so finally can restore them even if
  // one of the response/session assertions below fails.
  current = { email: data.email ?? current.email, password: data.newPassword ?? current.password };
  changed = current.email !== original.email || current.password !== original.password;
  const previousCookie = cookie;
  cookie = '';
  assert.deepEqual(result.data, { ok: true, requiresLogin: true });
  await request('/api/admin/account', { headers: { Cookie: previousCookie }, expected: 401 });
  const session = await request('/api/admin/session', { headers: { Cookie: previousCookie } });
  assert.equal(session.data.authenticated, false);
  assert.equal(session.data.isAdmin, false);
}

try {
  console.log(`Ayoub Shop local administrator account checks: ${base.origin}`);
  await check('Anonymous callers cannot read or update the administrator account', async () => {
    await request('/api/admin/account', { expected: 401 });
    await request('/api/admin/account', { method: 'PATCH', data: { currentPassword: original.password, email: changedEmail }, expected: 401 });
    const recovery = await request('/api/admin/recovery/session');
    assert.equal(recovery.data.authenticated, false);
    assert.equal(recovery.data.canReset, false);
    assert.equal(recovery.data.user, null);
    await request('/api/admin/recovery', { method: 'POST', data: { newPassword: changedPassword, confirmPassword: changedPassword }, expected: 401 });
  });

  await login();
  let recoveryOwner;
  await check('The account endpoint exposes its email and recovery owner without password or session secrets', async () => {
    const result = await request('/api/admin/account', { useCookie: true });
    assert.equal(result.data.email, original.email);
    assert.equal(result.data.recoveryMethod, 'chatgpt');
    recoveryOwner = result.data.recoveryEmail;
    assert.ok(typeof recoveryOwner === 'string' && recoveryOwner.includes('@'));
    const serialized = JSON.stringify(result.data);
    assert.ok(!serialized.includes(original.password));
    assert.ok(!serialized.includes('pbkdf2-sha256'));
    assert.ok(!serialized.includes(cookie.split('=')[1]));
  });

  await check('Changing credentials requires the correct current password and same-origin requests', async () => {
    const invalid = await request('/api/admin/account', {
      method: 'PATCH', useCookie: true, data: { currentPassword: `wrong-${suffix}`, email: changedEmail }, expected: 401,
    });
    assert.equal(invalid.data.code, 'invalid_current_password');
    for (const path of ['/api/admin/account', '/api/admin/recovery']) {
      const options = { method: path.endsWith('/account') ? 'PATCH' : 'POST', useCookie: true,
        data: { currentPassword: current.password, email: changedEmail, newPassword: changedPassword, confirmPassword: changedPassword }, expected: 403 };
      await request(path, { ...options, includeOrigin: false });
      await request(path, { ...options, headers: { Origin: 'https://external.invalid' } });
      await request(path, { ...options, headers: { 'Sec-Fetch-Site': 'cross-site' } });
    }
    assert.equal((await request('/api/admin/account', { useCookie: true })).data.email, original.email);
  });

  await check('A real local gateway identity cannot recover an account owned by another ChatGPT identity', async () => {
    assert.notEqual(recoveryOwner, 'seedy@sites.test', 'Configure a distinct recovery owner to test wrong-owner denial');
    const signedIn = await fetch(new URL('/signin-with-chatgpt?return_to=%2Fadmin%2Freset-password', base), {
      headers: { 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Dest': 'document' },
      redirect: 'manual', signal: AbortSignal.timeout(30000),
    });
    assert.equal(signedIn.status, 302);
    const gatewayCookie = sessionCookie(signedIn);
    const session = await request('/api/admin/recovery/session', { headers: { Cookie: gatewayCookie } });
    assert.equal(session.data.authenticated, true);
    assert.equal(session.data.canReset, false);
    const denied = await request('/api/admin/recovery', { method: 'POST', headers: { Cookie: gatewayCookie },
      data: { newPassword: changedPassword, confirmPassword: changedPassword }, expected: 403 });
    assert.equal(denied.data.code, 'recovery_forbidden');
    assert.equal((await request('/api/admin/account', { useCookie: true })).data.email, original.email);
  });

  await check('Changing the email invalidates the previous session and preserves the recovery owner', async () => {
    await update({ email: changedEmail });
    await login();
    const result = await request('/api/admin/account', { useCookie: true });
    assert.equal(result.data.email, changedEmail);
    assert.equal(result.data.recoveryEmail, recoveryOwner);
  });

  await check('Changing the password invalidates old sessions and rejects the previous password', async () => {
    await update({ newPassword: changedPassword, confirmPassword: changedPassword });
    const denied = await login({ email: current.email, password: original.password }, 401);
    assert.equal(denied.data.code, 'invalid_credentials');
    assert.equal(denied.response.headers.get('Set-Cookie'), null);
    await login();
    assert.equal((await request('/api/admin/account', { useCookie: true })).data.email, changedEmail);
  });
} finally {
  if (changed) {
    if (!cookie) await login();
    await update({ email: original.email, newPassword: original.password, confirmPassword: original.password });
    console.log('✓ Original local administrator email and password restored');
  }
}

await check('The restored original credentials can sign in again', async () => {
  await login(original);
  assert.equal((await request('/api/admin/account', { useCookie: true })).data.email, original.email);
  await request('/api/admin/logout', { method: 'POST', useCookie: true });
});
console.log(`${passed} administrator account integration checks passed (${loginAttempts} login attempts).`);
