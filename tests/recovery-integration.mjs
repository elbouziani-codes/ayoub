/** Local-only positive recovery test. Configure ADMIN_RECOVERY_EMAIL=seedy@sites.test
 * for the portable gateway fixture, and provide ADMIN_TEST_EMAIL/PASSWORD.
 * Restores the original password, uses actual gateway cookies, never fabricated identity headers.
 */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const base = new URL(process.argv[2] || 'http://127.0.0.1:5173');
if (base.protocol !== 'http:' || !['127.0.0.1','localhost','[::1]'].includes(base.hostname) || base.pathname !== '/' || base.search || base.hash || base.username || base.password) throw new Error('Recovery tests only support local HTTP development.');
const email = process.env.ADMIN_TEST_EMAIL;
const password = process.env.ADMIN_TEST_PASSWORD;
assert.ok(email && password, 'Provide the original local test credentials.');
const replacement = `Local-Recovery-${randomUUID()}!`;
let gatewayCookie = '', changed = false, cookie = '';
async function request(path, {method='GET', data, cookie:sessionCookie='', expected=200}={}) {
  const headers = new Headers();
  if(sessionCookie) headers.set('Cookie',sessionCookie);
  if(method !== 'GET') headers.set('Origin',base.origin);
  if(data) headers.set('Content-Type','application/json');
  const response = await fetch(new URL(path,base),{method,headers,body:data?JSON.stringify(data):undefined,redirect:'manual',signal:AbortSignal.timeout(30000)});
  const result = await response.json();
  assert.equal(response.status,expected,`${method} ${path}: ${response.status} ${result.code || ''}`);
  assert.equal(response.headers.get('Cache-Control'),'no-store');
  return {response,data:result};
}
const cookies = response => response.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');
async function login(value,expected=200){return request('/api/admin/login',{method:'POST',data:{email,password:value},expected});}
async function reset(value,expected=200,confirm=value,session=gatewayCookie){return request('/api/admin/recovery',{method:'POST',cookie:session,data:{newPassword:value,confirmPassword:confirm},expected});}
try {
  cookie=cookies((await login(password)).response);
  await reset(replacement,401,replacement,cookie);
  console.log('✓ A password administrator session alone cannot authorize recovery');
  const gateway=await fetch(new URL('/signin-with-chatgpt?return_to=%2Fadmin%2Freset-password',base),{headers:{'Sec-Fetch-Mode':'navigate','Sec-Fetch-Dest':'document'},redirect:'manual',signal:AbortSignal.timeout(30000)});
  assert.equal(gateway.status,302);
  gatewayCookie=cookies(gateway);
  const identity=await request('/api/admin/recovery/session',{cookie:gatewayCookie});
  assert.equal(identity.data.canReset,true,'Configure the local recovery owner as seedy@sites.test for this test');
  assert.equal(identity.data.user.email,'seedy@sites.test');
  await reset('short',400);
  await reset(replacement,400,'mismatch');
  assert.equal((await request('/api/admin/session',{cookie})).data.isAdmin,true);
  console.log('✓ Verified gateway recovery rejects short and mismatched passwords without changing access');
  changed=true;
  const result=await reset(replacement);
  assert.deepEqual(result.data,{ok:true,requiresLogin:true});
  assert.equal((await request('/api/admin/session',{cookie})).data.isAdmin,false);
  await login(password,401);
  cookie=cookies((await login(replacement)).response);
  const account=await request('/api/admin/account',{cookie});
  assert.equal(account.data.email,email);
  console.log('✓ Owner recovery resets the password, preserves the login email and revokes previous sessions');
} finally {
  if(changed){await reset(password);changed=false;console.log('✓ Original local password restored through verified recovery');}
}
assert.equal((await request('/api/admin/session',{cookie})).data.isAdmin,false);
cookie=cookies((await login(password)).response);
await request('/api/admin/logout',{method:'POST',cookie});
console.log('✓ Original credentials work and the temporary recovery session remains revoked');
