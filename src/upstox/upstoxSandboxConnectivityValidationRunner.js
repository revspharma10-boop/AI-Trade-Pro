/* AI TRADE PRO — UPSTOX SANDBOX CONNECTIVITY VALIDATION
 * Uses ONLY an Upstox SANDBOX access token supplied through the environment.
 * This runner never enables production/live trading.
 *
 * The test performs a sandbox-only order lifecycle:
 * 1) place a tiny LIMIT BUY sandbox order using a documented NSE instrument
 * 2) verify an order id is returned
 * 3) cancel the sandbox order
 *
 * If Upstox rejects the sandbox order for a broker-side validation reason,
 * the runner fails closed and reports the response without exposing the token.
 */

const rawToken = process.env.UPSTOX_SANDBOX_ACCESS_TOKEN || '';
const token = rawToken.trim();
const baseUrl = 'https://api-sandbox.upstox.com';
const sandboxV2Url = 'https://api-sandbox.upstox.com';
const sandboxV3Url = 'https://api-sandbox.upstox.com';
const instrumentToken = process.env.UPSTOX_SANDBOX_TEST_INSTRUMENT || 'NSE_EQ|INE669E01016';
const testPrice = Number(process.env.UPSTOX_SANDBOX_TEST_PRICE || '9.12');

if (!Number.isFinite(testPrice) || testPrice <= 0) {
  console.error('UPSTOX_SANDBOX_TEST_PRICE_INVALID');
  process.exit(4);
}

if (!token) {
  console.error('UPSTOX_SANDBOX_ACCESS_TOKEN_REQUIRED');
  process.exit(2);
}

if (process.env.UPSTOX_ENVIRONMENT === 'LIVE' || process.env.PRODUCTION_REAL_TRADING_ENABLED === 'true') {
  console.error('SAFETY_BLOCK_LIVE_ENVIRONMENT');
  process.exit(3);
}

async function request(path, { method = 'GET', body, host = baseUrl } = {}) {
  const response = await fetch(host + path, {
    method,
    headers: {
      Accept: 'application/json',
      Authorization: 'Bearer ' + token,
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });

  const payload = await response.json().catch(() => ({}));
  return { status: response.status, ok: response.ok, payload };
}

function apiMessage(payload) {
  return payload?.errors?.[0]?.message ?? payload?.message ?? 'UNKNOWN_API_RESPONSE';
}

const placeBody = {
  quantity: 1,
  product: 'D',
  validity: 'DAY',
  price: testPrice,
  tag: 'AI-TRADE-PRO-SANDBOX-VALIDATION',
  instrument_token: instrumentToken,
  order_type: 'LIMIT',
  transaction_type: 'BUY',
  disclosed_quantity: 0,
  trigger_price: 0,
  is_amo: true,
  slice: true
};

console.log('UPSTOX_SANDBOX_CONNECTIVITY_START');
console.log('environment=SANDBOX');
console.log('real_order_placed=false');
console.log('production_real_trading_enabled=false');
console.log('sandbox_token_present=' + String(Boolean(token)));
console.log('sandbox_token_length=' + token.length);
console.log('sandbox_token_has_whitespace=' + /\\s/.test(rawToken));
const looksLikeClientId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token);
console.log('sandbox_token_looks_like_client_id=' + String(looksLikeClientId));
if (looksLikeClientId) {
  console.error('UPSTOX_SANDBOX_CREDENTIAL_TYPE_MISMATCH');
  console.error('ACTION_REQUIRED=STORE_THE_SANDBOX_ACCESS_TOKEN_FROM_THE_SANDBOX_APP_GENERATE_BUTTON_NOT_THE_API_KEY_CLIENT_ID');
  process.exit(8);
}

console.log('sandbox_endpoint=' + baseUrl + '/v3/order/place');
console.log('sandbox_instrument=' + instrumentToken);
console.log('sandbox_test_price=' + testPrice);

console.log('UPSTOX_SANDBOX_AUTH_PREFLIGHT_START');

// Probe both documented Sandbox order API versions with an intentionally invalid body.
// A 4xx validation response means the bearer token reached the authenticated API layer.
// A 401 means the bearer token itself was rejected.
const v2Preflight = await request('/v2/order/place', { method: 'POST', body: {}, host: sandboxV2Url });
const v3Preflight = await request('/v3/order/place', { method: 'POST', body: {}, host: sandboxV3Url });

console.log('sandbox_v2_preflight_status=' + v2Preflight.status);
console.log('sandbox_v3_preflight_status=' + v3Preflight.status);

if (v2Preflight.status === 401 && v3Preflight.status === 401) {
  console.error('UPSTOX_SANDBOX_AUTH_PREFLIGHT_FAILED');
  console.error('UPSTOX_SANDBOX_V2_AUTH_MESSAGE=' + apiMessage(v2Preflight.payload));
  console.error('UPSTOX_SANDBOX_V3_AUTH_MESSAGE=' + apiMessage(v3Preflight.payload));
  console.error('ACTION_REQUIRED=VERIFY_THE_GITHUB_SECRET_IS_THE_SANDBOX_ACCESS_TOKEN_GENERATED_BY_API_SANDBOX');
  process.exit(5);
}

if ([v2Preflight, v3Preflight].some(result => result.status >= 500)) {
  console.error('UPSTOX_SANDBOX_AUTH_PREFLIGHT_UPSTREAM_ERROR');
  process.exit(6);
}

if (v3Preflight.status < 400 || v3Preflight.status >= 500) {
  console.error('UPSTOX_SANDBOX_AUTH_PREFLIGHT_UNEXPECTED status=' + v3Preflight.status);
  console.error('UPSTOX_SANDBOX_AUTH_PREFLIGHT_MESSAGE=' + apiMessage(v3Preflight.payload));
  process.exit(7);
}

console.log('UPSTOX_SANDBOX_AUTH_PREFLIGHT_PASSED status=' + v3Preflight.status);

const placed = await request('/v3/order/place', { method: 'POST', body: placeBody, host: sandboxV3Url });

if (!placed.ok) {
  console.error('SANDBOX_PLACE_FAILED status=' + placed.status);
  console.error('SANDBOX_PLACE_MESSAGE=' + apiMessage(placed.payload));
  if (placed.status === 401) {
    console.error('ACTION_REQUIRED=ROTATE_SANDBOX_TOKEN_AND_UPDATE_GITHUB_SECRET');
  }
  if (Array.isArray(placed.payload?.errors)) {
    for (const error of placed.payload.errors) {
      console.error('SANDBOX_API_ERROR_CODE=' + (error?.errorCode ?? 'UNKNOWN'));
      console.error('SANDBOX_API_ERROR_PATH=' + (error?.propertyPath ?? 'UNKNOWN'));
      console.error('SANDBOX_API_ERROR_FIELD=' + (error?.invalidField ?? 'UNKNOWN'));
    }
  }
  process.exit(1);
}

const orderId = placed.payload?.data?.order_ids?.[0] ?? placed.payload?.data?.order_id ?? placed.payload?.order_id;
if (!orderId) {
  console.error('SANDBOX_PLACE_NO_ORDER_ID');
  process.exit(1);
}

console.log('SANDBOX_PLACE_PASSED order_id_received=true');

const cancelled = await request('/v3/order/cancel?order_id=' + encodeURIComponent(orderId), { method: 'DELETE' });

if (!cancelled.ok) {
  console.error('SANDBOX_CANCEL_FAILED status=' + cancelled.status);
  console.error('SANDBOX_CANCEL_MESSAGE=' + apiMessage(cancelled.payload));
  process.exit(1);
}

console.log('SANDBOX_CANCEL_PASSED');
console.log('UPSTOX_SANDBOX_CONNECTIVITY_PASSED');
console.log('PAPER_ONLY=true');
console.log('REAL_ORDER_PLACED=false');
console.log('PRODUCTION_REAL_TRADING_ENABLED=false');
