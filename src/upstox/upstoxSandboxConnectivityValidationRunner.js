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

const token = process.env.UPSTOX_SANDBOX_ACCESS_TOKEN;
const baseUrl = 'https://api-hft.upstox.com';
const instrumentToken = process.env.UPSTOX_SANDBOX_TEST_INSTRUMENT || 'NSE_EQ|INE669E01016';
const testPrice = Number(process.env.UPSTOX_SANDBOX_TEST_PRICE || '9.12');

if (!token) {
  console.error('UPSTOX_SANDBOX_ACCESS_TOKEN_REQUIRED');
  process.exit(2);
}

if (process.env.UPSTOX_ENVIRONMENT === 'LIVE' || process.env.PRODUCTION_REAL_TRADING_ENABLED === 'true') {
  console.error('SAFETY_BLOCK_LIVE_ENVIRONMENT');
  process.exit(3);
}

async function request(path, { method = 'GET', body } = {}) {
  const response = await fetch(baseUrl + path, {
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

const placed = await request('/v3/order/place', { method: 'POST', body: placeBody });

if (!placed.ok) {
  console.error('SANDBOX_PLACE_FAILED status=' + placed.status);
  console.error('SANDBOX_PLACE_MESSAGE=' + apiMessage(placed.payload));
  process.exit(1);
}

const orderId = placed.payload?.data?.order_id ?? placed.payload?.order_id;
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
