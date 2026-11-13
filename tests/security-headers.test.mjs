import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSecurityHeaders } from '../lib/security-headers.ts';

function headerMap(development = false) {
  return new Map(buildSecurityHeaders(development).map(({ key, value }) => [key.toLowerCase(), value]));
}

test('production browser policy blocks framing, plugins, foreign forms, and powerful device APIs', () => {
  const headers = headerMap(false);
  const csp = headers.get('content-security-policy');
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /base-uri 'none'/);
  assert.match(csp, /form-action 'self'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /upgrade-insecure-requests/);
  assert.equal(headers.get('x-frame-options'), 'DENY');
  assert.equal(headers.get('x-content-type-options'), 'nosniff');
  assert.equal(headers.get('cross-origin-opener-policy'), 'same-origin');
  assert.equal(headers.get('cross-origin-resource-policy'), 'same-origin');
  assert.equal(headers.get('strict-transport-security'), 'max-age=31536000');
  for (const feature of ['camera=()', 'microphone=()', 'geolocation=()', 'payment=()', 'usb=()', 'browsing-topics=()']) {
    assert.ok(headers.get('permissions-policy').includes(feature));
  }
});

test('development CSP permits hot reload without weakening the production policy', () => {
  const development = headerMap(true).get('content-security-policy');
  const production = headerMap(false).get('content-security-policy');
  assert.match(development, /script-src[^;]*'unsafe-eval'/);
  assert.match(development, /connect-src[^;]*ws: wss:/);
  assert.doesNotMatch(development, /upgrade-insecure-requests/);
  assert.doesNotMatch(production, /'unsafe-eval'/);
  assert.doesNotMatch(production, /connect-src[^;]*ws:/);
});
